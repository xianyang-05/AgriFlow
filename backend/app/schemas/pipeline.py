from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.climate import ClimateOutput
from app.schemas.crop import CropRecord
from app.schemas.decision import CropPlan, ScoredCrop
from app.schemas.input import GeocodeResult, NormalizedFarmInput, UserPreferences
from app.schemas.suitability import EliminationReason, SuitabilityResult


class PipelineResult(BaseModel):
    normalized_input: NormalizedFarmInput | None = None
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)
    geocode_result: GeocodeResult | None = None
    altitude_m: float | None = None
    climate_output: ClimateOutput | None = None
    suitability_results: list[SuitabilityResult] = Field(default_factory=list)
    eliminated_crops: list[EliminationReason] = Field(default_factory=list)
    eligible_crops: list[CropRecord] = Field(default_factory=list)
    scored_crops: list[ScoredCrop] = Field(default_factory=list)
    aggressive_plan: CropPlan | None = None
    conservative_plan: CropPlan | None = None
    explanation: str = ""
    warnings: list[str] = Field(default_factory=list)
    status: Literal["complete", "incomplete", "no_viable_crops"] = "incomplete"
