from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.exceptions import DomainError
from app.logging_config import (
    configure_logging,
    get_logger,
    get_request_logging_context,
    init_request_logging,
    update_request_logging,
)
from app.routes import api_router

settings = get_settings()
configure_logging()
logger = get_logger()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid4())
    start = perf_counter()
    init_request_logging(request_id, request.url.path)
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        latency_ms = round((perf_counter() - start) * 1000, 2)
        update_request_logging(latency_ms=latency_ms)
        logger.info(
            "request.completed",
            status_code=response.status_code if response else 500,
            **get_request_logging_context(),
        )
        if response is not None:
            response.headers["X-Request-ID"] = request_id


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
    if exc.http_status >= 400 and exc.http_status != 200:
        return JSONResponse(status_code=exc.http_status, content={"detail": exc.message})
    return JSONResponse(status_code=exc.http_status, content=exc.to_response())


@app.exception_handler(Exception)
async def generic_error_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("request.failed", error=str(exc), **get_request_logging_context())
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

