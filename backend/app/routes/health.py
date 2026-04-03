from fastapi import APIRouter
from sqlalchemy import text

from app.adapters.climate_model_adapter import ClimateModelAdapter
from app.database import SessionLocal
from app.services.altitude_service import AltitudeService
from app.services.geocoding_service import GeocodingService
from app.services.llm_service import LLMService

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, object]:
    database_status = "healthy"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        database_status = "unhealthy"

    return {
        "api": "healthy",
        "database": database_status,
        "llm": LLMService().check_health(),
        "geocoding": GeocodingService().check_health(),
        "altitude": AltitudeService().check_health(),
        "climate_model": ClimateModelAdapter().check_health(),
    }
