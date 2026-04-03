from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.climate import ClimateOutput
from app.schemas.decision import CropPlan, ScoredCrop
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.schemas.suitability import EliminationReason


class ResponseEnvelope(BaseModel):
    status: Literal["complete", "incomplete", "no_viable_crops"] = "incomplete"
    clarification_needed: bool = False
    clarification_questions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class PlanVersion(BaseModel):
    id: str
    run_id: str
    version_number: int
    normalized_input: NormalizedFarmInput
    user_preferences: UserPreferences
    climate_output: ClimateOutput | None = None
    eliminated_crops: list[EliminationReason] = Field(default_factory=list)
    ranked_crops: list[ScoredCrop] = Field(default_factory=list)
    aggressive_plan: CropPlan | None = None
    conservative_plan: CropPlan | None = None
    explanation: str = ""
    warnings: list[str] = Field(default_factory=list)
    status: str
    version_note: str
    created_at: datetime


class RecommendationResponse(ResponseEnvelope):
    run_id: str | None = None
    version_number: int | None = None
    normalized_input: NormalizedFarmInput | None = None
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)
    climate_output: ClimateOutput | None = None
    eliminated_crops: list[EliminationReason] = Field(default_factory=list)
    ranked_crops: list[ScoredCrop] = Field(default_factory=list)
    aggressive_plan: CropPlan | None = None
    conservative_plan: CropPlan | None = None
    explanation: str = ""
    has_previous_version: bool = False
