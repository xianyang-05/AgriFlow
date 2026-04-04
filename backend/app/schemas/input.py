from typing import Literal

from pydantic import BaseModel, Field, field_validator


SoilType = Literal["loamy", "clay", "sandy", "silt", "peat", "chalky"]


def _normalize_crop_ids(value: list[str] | str | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]

    normalized: list[str] = []
    for crop_id in value:
        if not crop_id:
            continue
        normalized_id = crop_id.strip().lower().replace("-", "_").replace(" ", "_")
        if normalized_id:
            normalized.append(normalized_id)
    return normalized


class RawInput(BaseModel):
    area_text: str | None = None
    budget_text: str | None = None
    location_text: str | None = None
    notes: str | None = None
    soil_type_text: str | None = None


class GeocodeResult(BaseModel):
    latitude: float
    longitude: float
    display_name: str
    confidence: float = 1.0


class NormalizedFarmInput(BaseModel):
    area_m2: float | None = None
    budget_myr: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    altitude_m: float | None = None
    target_month: int | None = None
    forecast_horizon_months: int | None = None
    extraction_confidence: float = 0.0
    clarification_needed: bool = False
    clarification_questions: list[str] = Field(default_factory=list)
    location_text: str | None = None
    soil_type: SoilType | None = None

    @field_validator("target_month")
    @classmethod
    def validate_target_month(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value < 1 or value > 12:
            raise ValueError("target_month must be between 1 and 12")
        return value


class UserPreferences(BaseModel):
    preferred_crops: list[str] = Field(default_factory=list)
    excluded_crops: list[str] = Field(default_factory=list)
    risk_preference: str | None = None
    harvest_preference: str | None = None
    notes: str | None = None

    @field_validator("preferred_crops", "excluded_crops", mode="before")
    @classmethod
    def normalize_crop_preferences(cls, value: list[str] | str | None) -> list[str]:
        return _normalize_crop_ids(value)
