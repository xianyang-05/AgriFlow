import os
from collections.abc import Generator

from sqlalchemy import JSON, Text, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings


def _build_json_type() -> JSON:
    return JSON().with_variant(JSONB(astext_type=Text()), "postgresql")


def normalize_database_url(database_url: str) -> str:
    normalized = database_url.strip()
    lowered = normalized.lower()

    if lowered.startswith("postgresql+"):
        return normalized
    if lowered.startswith("postgresql://"):
        return f"postgresql+psycopg://{normalized[len('postgresql://'):]}"
    if lowered.startswith("postgres://"):
        return f"postgresql+psycopg://{normalized[len('postgres://'):]}"

    return normalized


json_type = _build_json_type()


class Base(DeclarativeBase):
    pass


settings = get_settings()
database_url = normalize_database_url(settings.database_url)
engine_kwargs: dict[str, object] = {
    "pool_pre_ping": True,
}

if database_url.startswith("postgresql+psycopg://"):
    # Supabase transaction pooler does not support prepared statements.
    engine_kwargs["connect_args"] = {"prepare_threshold": None}

if os.getenv("VERCEL"):
    # Serverless functions should not keep a process-local connection pool.
    engine_kwargs["poolclass"] = NullPool

engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
