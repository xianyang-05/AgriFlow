from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.input import SoilType
from app.schemas.plan import RecommendationResponse, ResponseEnvelope


class ChatRequest(BaseModel):
    run_id: str
    message: str


class ChatUpdatePayload(BaseModel):
    budget_myr: float | None = None
    area_m2: float | None = None
    target_month: int | None = None
    forecast_horizon_months: int | None = None
    soil_type: SoilType | None = None
    preferred_crops: list[str] | None = None
    excluded_crops: list[str] | None = None
    risk_preference: str | None = None
    harvest_preference: str | None = None
    notes: str | None = None

    @field_validator("target_month")
    @classmethod
    def validate_target_month(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value < 1 or value > 12:
            raise ValueError("target_month must be between 1 and 12")
        return value


class IntentClassification(BaseModel):
    intent: Literal["question", "modification", "revert"]
    confidence: float
    updates: ChatUpdatePayload = Field(default_factory=ChatUpdatePayload)


class ChatResponse(ResponseEnvelope):
    run_id: str
    intent: Literal["question", "modification", "revert"]
    confidence: float
    applied_updates: ChatUpdatePayload = Field(default_factory=ChatUpdatePayload)
    updated_recommendation: RecommendationResponse | None = None
    assistant_message: str
    has_previous_version: bool = False
