from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AgriFlow Backend"
    environment: str = "development"
    debug: bool = Field(default=False, validation_alias=AliasChoices("APP_DEBUG", "DEBUG"))
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/agriflow"
    ollama_base_url: str = "https://ollama.com"
    ollama_api_key: str = ""
    ollama_model: str = "llava"
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    open_elevation_base_url: str = "https://api.open-elevation.com/api/v1"
    climate_model_path: str | None = "climate_model_v2.joblib"
    request_timeout_seconds: float = 10.0
    altitude_required: bool = False
    default_forecast_horizon_months: int = 3
    default_currency: str = "MYR"
    cors_origins: list[str] = Field(default_factory=list)

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../.env.local", ".env.local"),
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
