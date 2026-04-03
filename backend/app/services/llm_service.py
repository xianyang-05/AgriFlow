import json
from typing import Any

import httpx

from app.config import get_settings
from app.exceptions import LLMError
from app.schemas.chat import ChatUpdatePayload, IntentClassification
from app.schemas.decision import ExplanationInput
from app.schemas.input import RawInput


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()

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
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                response = client.post(f"{self.settings.ollama_base_url}/api/chat", json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
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
            "Classify the message intent as question, modification, or revert. "
            "Return JSON with keys intent, confidence, updates. "
            "updates may contain: budget_myr, area_m2, target_month, forecast_horizon_months, soil_type, "
            "preferred_crops, excluded_crops, risk_preference, harvest_preference, notes."
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

    def check_health(self) -> dict[str, str]:
        try:
            with httpx.Client(timeout=3.0) as client:
                response = client.get(f"{self.settings.ollama_base_url}/api/tags")
                response.raise_for_status()
            return {"status": "healthy"}
        except httpx.HTTPError:
            return {"status": "unreachable"}
