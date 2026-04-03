import logging
from contextvars import ContextVar
from typing import Any

import structlog


_DEFAULT_REQUEST_LOG_CONTEXT = {
    "request_id": None,
    "route": None,
    "normalization_confidence": None,
    "geocoding_confidence": None,
    "altitude_found": False,
    "climate_model_version": None,
    "horizon": None,
    "eligible_crop_count": 0,
    "eliminated_crop_count": 0,
    "aggressive_crop": None,
    "conservative_crop": None,
    "chat_intent": None,
    "reverted_version": None,
    "latency_ms": 0,
}

_request_log_context: ContextVar[dict[str, Any]] = ContextVar(
    "request_log_context",
    default=_DEFAULT_REQUEST_LOG_CONTEXT.copy(),
)


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def init_request_logging(request_id: str, route: str) -> None:
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id, route=route)
    context = _DEFAULT_REQUEST_LOG_CONTEXT.copy()
    context.update({"request_id": request_id, "route": route})
    _request_log_context.set(context)


def update_request_logging(**kwargs: Any) -> None:
    context = _DEFAULT_REQUEST_LOG_CONTEXT.copy()
    context.update(_request_log_context.get())
    context.update(kwargs)
    _request_log_context.set(context)


def get_request_logging_context() -> dict[str, Any]:
    context = _DEFAULT_REQUEST_LOG_CONTEXT.copy()
    context.update(_request_log_context.get())
    return context


def get_logger() -> structlog.stdlib.BoundLogger:
    return structlog.get_logger()
