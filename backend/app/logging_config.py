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
    "aggressive_filter_mode": None,
    "aggressive_non_down_crop_ids": [],
    "aggressive_downtrend_crop_ids": [],
    "aggressive_ranked_crop_ids": [],
    "price_trend_snapshot": [],
    "available_crop_ids": [],
    "missing_seed_crop_ids": [],
    "chat_intent": None,
    "reverted_version": None,
    "latency_ms": 0,
}

_active_request_id: ContextVar[str | None] = ContextVar("active_request_id", default=None)
_request_log_store: dict[str, dict[str, Any]] = {}


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
    _request_log_store[request_id] = context
    _active_request_id.set(request_id)


def update_request_logging(**kwargs: Any) -> None:
    request_id = _active_request_id.get()
    if request_id is None:
        return
    context = _request_log_store.get(request_id)
    if context is None:
        context = _DEFAULT_REQUEST_LOG_CONTEXT.copy()
        context.update({"request_id": request_id})
        _request_log_store[request_id] = context
    context.update(kwargs)


def get_request_logging_context(request_id: str | None = None) -> dict[str, Any]:
    context = _DEFAULT_REQUEST_LOG_CONTEXT.copy()
    active_request_id = request_id or _active_request_id.get()
    if active_request_id is None:
        return context
    context.update(_request_log_store.get(active_request_id, {}))
    return context


def clear_request_logging(request_id: str | None = None) -> None:
    active_request_id = request_id or _active_request_id.get()
    if active_request_id is None:
        return
    _request_log_store.pop(active_request_id, None)
    if _active_request_id.get() == active_request_id:
        _active_request_id.set(None)
    structlog.contextvars.clear_contextvars()


def get_logger() -> structlog.stdlib.BoundLogger:
    return structlog.get_logger()
