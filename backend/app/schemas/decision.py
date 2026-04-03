from pydantic import BaseModel, Field

from app.schemas.climate import ForecastBlock
from app.schemas.price import PriceResult
from app.schemas.suitability import EliminationReason
from app.schemas.input import UserPreferences


class ScoreBreakdown(BaseModel):
    suitability_score: float
    climate_score: float
    budget_fit_score: float
    price_score: float
    duration_fit_score: float


class ScoredCrop(BaseModel):
    crop_id: str
    crop_name: str
    aggressive_score: float
    conservative_score: float
    reward_score: float = 0.0
    risk_score: float = 1.0
    score_breakdown: ScoreBreakdown
    price_result: PriceResult
    growth_days: int


class CropPlan(BaseModel):
    strategy: str
    top_crop: ScoredCrop
    rationale: str


class DecisionOutput(BaseModel):
    ranked_crops: list[ScoredCrop] = Field(default_factory=list)
    aggressive_plan: CropPlan | None = None
    conservative_plan: CropPlan | None = None


class ExplanationInput(BaseModel):
    aggressive_top_crop: ScoredCrop
    conservative_top_crop: ScoredCrop
    eliminated_crops: list[EliminationReason] = Field(default_factory=list)
    forecast_blocks: list[ForecastBlock] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    user_preferences: UserPreferences = Field(default_factory=UserPreferences)
