from types import SimpleNamespace

import httpx
import pytest

from app.exceptions import LLMError
from app.services.llm_service import LLMService


class FakeLogger:
    def __init__(self) -> None:
        self.errors: list[tuple[str, dict]] = []
        self.infos: list[tuple[str, dict]] = []
        self.warnings: list[tuple[str, dict]] = []

    def bind(self, **kwargs):
        return self

    def error(self, event: str, **kwargs) -> None:
        self.errors.append((event, kwargs))

    def info(self, event: str, **kwargs) -> None:
        self.infos.append((event, kwargs))

    def warning(self, event: str, **kwargs) -> None:
        self.warnings.append((event, kwargs))


def test_llm_service_logs_error_when_ollama_is_unreachable(monkeypatch):
    logger = FakeLogger()
    monkeypatch.setattr(
        "app.services.llm_service.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_api_key="",
            ollama_model="llama3.2:3b",
            request_timeout_seconds=1,
        ),
    )
    monkeypatch.setattr("app.services.llm_service.get_logger", lambda: logger)

    class FailingClient:
        def __init__(self, timeout, headers):
            self.timeout = timeout
            self.headers = headers

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, json):
            raise httpx.ConnectError("connection refused", request=httpx.Request("POST", url))

    monkeypatch.setattr("app.services.llm_service.httpx.Client", FailingClient)

    service = LLMService()

    with pytest.raises(LLMError):
        service._generate("system", "user")

    assert logger.errors
    event, payload = logger.errors[0]
    assert event == "ollama.generate.failed"
    assert payload["endpoint"] == "/api/generate"
    assert payload["request_method"] == "POST"
    assert "connection refused" in payload["error"]


def test_llm_service_logs_warning_when_chat_endpoint_is_missing(monkeypatch):
    logger = FakeLogger()
    monkeypatch.setattr(
        "app.services.llm_service.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="http://localhost:11434",
            ollama_api_key="",
            ollama_model="llama3.2:3b",
            request_timeout_seconds=1,
        ),
    )
    monkeypatch.setattr("app.services.llm_service.get_logger", lambda: logger)

    class FallbackClient:
        def __init__(self, timeout, headers):
            self.timeout = timeout
            self.headers = headers

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def post(self, url, json):
            request = httpx.Request("POST", url)
            if url.endswith("/api/chat"):
                return httpx.Response(404, request=request)
            return httpx.Response(200, request=request, json={"response": "fallback ok"})

    monkeypatch.setattr("app.services.llm_service.httpx.Client", FallbackClient)

    service = LLMService()
    result = service._chat("system", "user")

    assert result == "fallback ok"
    assert logger.warnings
    event, payload = logger.warnings[0]
    assert event == "ollama.chat_endpoint_unavailable"
    assert payload["endpoint"] == "/api/chat"
    assert payload["fallback_endpoint"] == "/api/generate"
    assert payload["status_code"] == 404


def test_llm_health_reports_auth_metadata(monkeypatch):
    logger = FakeLogger()
    monkeypatch.setattr(
        "app.services.llm_service.get_settings",
        lambda: SimpleNamespace(
            ollama_base_url="https://ollama.com",
            ollama_api_key="secret-key",
            ollama_model="llava",
            request_timeout_seconds=1,
        ),
    )
    monkeypatch.setattr("app.services.llm_service.get_logger", lambda: logger)

    class HealthyClient:
        def __init__(self, timeout, headers):
            self.timeout = timeout
            self.headers = headers

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url):
            request = httpx.Request("GET", url, headers=self.headers)
            return httpx.Response(200, request=request, json={"models": []})

    monkeypatch.setattr("app.services.llm_service.httpx.Client", HealthyClient)

    payload = LLMService().check_health()

    assert payload["status"] == "healthy"
    assert payload["base_url_host"] == "ollama.com"
    assert payload["authenticated"] is True
    assert payload["model"] == "llava"
    assert logger.infos
