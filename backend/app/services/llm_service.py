import json
from time import perf_counter
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import get_settings
from app.exceptions import LLMError
from app.logging_config import get_logger
from app.schemas.chat import ChatUpdatePayload, IntentClassification
from app.schemas.decision import ExplanationInput
from app.schemas.input import RawInput


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._chat_endpoint_available: bool | None = None
        self._ollama_base_url = self.settings.ollama_base_url.rstrip("/")
        self._ollama_authenticated = bool(self.settings.ollama_api_key.strip())
        self.logger = get_logger().bind(
            service="ollama",
            ollama_base_url_host=self._base_url_host(),
            ollama_model=self.settings.ollama_model,
            ollama_authenticated=self._ollama_authenticated,
        )

    def _generate(self, system_prompt: str, user_prompt: str, *, json_mode: bool = False) -> str:
        prompt = f"System: {system_prompt}\nUser: {user_prompt}\nAssistant:"
        payload: dict[str, Any] = {
            "model": self.settings.ollama_model,
            "prompt": prompt,
            "stream": False,
        }
        if json_mode:
            payload["format"] = "json"

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds, headers=self._request_headers()) as client:
                response = client.post(f"{self._ollama_base_url}/api/generate", json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            self._log_http_error(
                "ollama.generate.failed",
                exc,
                endpoint="/api/generate",
            )
            raise LLMError("Ollama request failed") from exc

        data = response.json()
        try:
            return str(data["response"])
        except (KeyError, TypeError) as exc:
            raise LLMError("Ollama response missing content") from exc

    def _extract_json(self, text: str) -> dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise LLMError("LLM did not return valid JSON")
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError as exc:
                raise LLMError("LLM did not return valid JSON") from exc

    def _chat(self, system_prompt: str, user_prompt: str, *, json_mode: bool = False) -> str:
        if self._chat_endpoint_available is False:
            return self._generate(system_prompt, user_prompt, json_mode=json_mode)

        payload: dict[str, Any] = {
            "model": self.settings.ollama_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
        }
        if json_mode:
            payload["format"] = "json"

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds, headers=self._request_headers()) as client:
                response = client.post(f"{self._ollama_base_url}/api/chat", json=payload)
                if response.status_code == 404:
                    self._chat_endpoint_available = False
                    self.logger.warning(
                        "ollama.chat_endpoint_unavailable",
                        endpoint="/api/chat",
                        fallback_endpoint="/api/generate",
                        status_code=response.status_code,
                    )
                    return self._generate(system_prompt, user_prompt, json_mode=json_mode)
                response.raise_for_status()
                self._chat_endpoint_available = True
        except httpx.HTTPError as exc:
            self._log_http_error(
                "ollama.chat.failed",
                exc,
                endpoint="/api/chat",
            )
            raise LLMError("Ollama request failed") from exc

        data = response.json()
        try:
            return str(data["message"]["content"])
        except (KeyError, TypeError) as exc:
            raise LLMError("Ollama response missing content") from exc

    def extract_normalization(self, raw_input: RawInput, prompt_notes: str | None = None) -> dict[str, Any]:
        system_prompt = (
            "Extract farm planning fields into JSON. Return keys: area_text, budget_text, "
            "location_text, target_month, forecast_horizon_months, latitude, longitude, soil_type."
        )
        user_prompt = json.dumps(
            {
                "area_text": raw_input.area_text,
                "budget_text": raw_input.budget_text,
                "location_text": raw_input.location_text,
                "notes": prompt_notes or raw_input.notes,
                "soil_type_text": raw_input.soil_type_text,
            }
        )
        return self._extract_json(self._chat(system_prompt, user_prompt, json_mode=True))

    def classify_intent(
        self,
        message: str,
        history: list[dict[str, str]],
        context: dict[str, Any],
    ) -> IntentClassification:
        system_prompt = (
            "You classify the user's latest message about an existing crop recommendation. "
            "Return strict JSON with keys: intent, confidence, updates. "
            "intent must be exactly one of: question, modification, revert. "
            "Only use revert when the user explicitly asks to undo, revert, roll back, or restore a previous version. "
            "If the user asks to remove, exclude, avoid, replace, or stop recommending a crop, that is modification, not revert. "
            "updates may contain: budget_myr, area_m2, target_month, forecast_horizon_months, soil_type, "
            "preferred_crops, excluded_crops, risk_preference, harvest_preference, notes. "
            "Use crop ids from context when available. "
            "If the message is a question about the current plan, use question with empty updates. "
            "If the message changes the plan, use modification and extract structured updates when possible. "
            "Examples: "
            "message='Why was chili selected?' -> {\"intent\":\"question\",\"confidence\":0.95,\"updates\":{}}. "
            "message='I don't want chili. Remove chili from the recommendations.' -> "
            "{\"intent\":\"modification\",\"confidence\":0.95,\"updates\":{\"excluded_crops\":[\"chili\"]}}. "
            "message='Prefer lower-risk crops and a faster harvest.' -> "
            "{\"intent\":\"modification\",\"confidence\":0.9,\"updates\":{\"risk_preference\":\"low\",\"harvest_preference\":\"fast\"}}. "
            "message='Undo the last change and go back to the previous version.' -> "
            "{\"intent\":\"revert\",\"confidence\":0.98,\"updates\":{}}. "
            "If you are unsure, lower confidence instead of guessing."
        )
        user_prompt = json.dumps({"message": message, "history": history, "context": context})
        payload = self._extract_json(self._chat(system_prompt, user_prompt, json_mode=True))
        payload["updates"] = ChatUpdatePayload(**payload.get("updates", {}))
        return IntentClassification(**payload)

    def disambiguate_revert_intent(
        self,
        message: str,
        history: list[dict[str, str]],
        context: dict[str, Any],
    ) -> IntentClassification:
        system_prompt = (
            "You are resolving an ambiguous revert classification for a crop-planning assistant. "
            "Return strict JSON with keys: intent, confidence, updates. "
            "intent must be exactly one of: modification or revert. "
            "Use revert only if the user is explicitly asking to restore, undo, roll back, or go back to a previous saved recommendation version. "
            "If the user is asking to remove a crop, exclude a crop, stop recommending a crop, change risk, budget, harvest speed, soil type, area, month, or any current plan setting, that is modification. "
            "If the user says things like 'remove chili', 'don't recommend chili', or 'exclude chili', return modification with excluded_crops set. "
            "updates may contain: budget_myr, area_m2, target_month, forecast_horizon_months, soil_type, "
            "preferred_crops, excluded_crops, risk_preference, harvest_preference, notes. "
            "Use crop ids from context when available. "
            "Examples: "
            "message='Undo the last change and restore the previous version.' -> "
            "{\"intent\":\"revert\",\"confidence\":0.98,\"updates\":{}}. "
            "message='Remove chili from the recommended crops.' -> "
            "{\"intent\":\"modification\",\"confidence\":0.96,\"updates\":{\"excluded_crops\":[\"chili\"]}}."
        )
        user_prompt = json.dumps({"message": message, "history": history, "context": context})
        payload = self._extract_json(self._chat(system_prompt, user_prompt, json_mode=True))
        payload["updates"] = ChatUpdatePayload(**payload.get("updates", {}))
        return IntentClassification(**payload)

    def answer_question(self, message: str, history: list[dict[str, str]], context: dict[str, Any]) -> str:
        system_prompt = "Answer the user's question about the current recommendation without changing rankings."
        user_prompt = json.dumps({"message": message, "history": history, "context": context})
        return self._chat(system_prompt, user_prompt)

    def generate_explanation(self, explanation_input: ExplanationInput) -> str:
        system_prompt = (
            "Explain the deterministic recommendation. "
            "Do not change rankings or scores. Mention assumptions, eliminated crops, and climate risk."
        )
        return self._chat(system_prompt, explanation_input.model_dump_json())

    def check_health(self) -> dict[str, Any]:
        started_at = perf_counter()
        try:
            with httpx.Client(timeout=3.0, headers=self._request_headers()) as client:
                response = client.get(f"{self._ollama_base_url}/api/tags")
                response.raise_for_status()
            latency_ms = round((perf_counter() - started_at) * 1000, 2)
            self.logger.info(
                "ollama.healthcheck.completed",
                endpoint="/api/tags",
                status="healthy",
                latency_ms=latency_ms,
            )
            return self._health_payload("healthy", latency_ms)
        except httpx.HTTPError as exc:
            latency_ms = round((perf_counter() - started_at) * 1000, 2)
            status = self._classify_http_error(exc)
            self._log_http_error(
                "ollama.healthcheck.failed",
                exc,
                endpoint="/api/tags",
                level="warning",
                latency_ms=latency_ms,
            )
            return self._health_payload(
                status,
                latency_ms,
                status_code=getattr(getattr(exc, "response", None), "status_code", None),
            )

    def _request_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._ollama_authenticated:
            headers["Authorization"] = f"Bearer {self.settings.ollama_api_key}"
        return headers

    def _base_url_host(self) -> str:
        parsed = urlparse(self._ollama_base_url)
        return parsed.netloc or self._ollama_base_url

    def _classify_http_error(self, exc: httpx.HTTPError) -> str:
        if isinstance(exc, httpx.TimeoutException):
            return "timeout"
        if isinstance(exc, (httpx.ConnectError, httpx.NetworkError)):
            return "unreachable"

        response = getattr(exc, "response", None)
        if response is None:
            return "unreachable"
        if response.status_code in {401, 403}:
            return "unauthorized"
        if response.status_code >= 500:
            return "provider_error"
        return "request_error"

    def _health_payload(
        self,
        status: str,
        latency_ms: float,
        *,
        status_code: int | None = None,
    ) -> dict[str, Any]:
        return {
            "status": status,
            "base_url_host": self._base_url_host(),
            "model": self.settings.ollama_model,
            "authenticated": self._ollama_authenticated,
            "latency_ms": latency_ms,
            "status_code": status_code,
        }

    def _response_preview(self, response: httpx.Response | None) -> str | None:
        if response is None:
            return None
        try:
            preview = response.text.strip()
        except Exception:
            return None
        if not preview:
            return None
        return preview[:300]

    def _log_http_error(
        self,
        event: str,
        exc: httpx.HTTPError,
        *,
        endpoint: str,
        level: str = "error",
        latency_ms: float | None = None,
    ) -> None:
        response = getattr(exc, "response", None)
        request = getattr(exc, "request", None)
        log_method = self.logger.warning if level == "warning" else self.logger.error
        log_method(
            event,
            endpoint=endpoint,
            status_code=response.status_code if response is not None else None,
            request_method=request.method if request is not None else None,
            error_kind=self._classify_http_error(exc),
            error=str(exc),
            latency_ms=latency_ms,
            response_preview=self._response_preview(response),
        )
