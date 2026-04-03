from pydantic import BaseModel, Field, field_validator


class ClimateRequest(BaseModel):
    lat: float
    lon: float
    target_month: int
    horizon_months: int


class ForecastBlock(BaseModel):
    horizon_months: int
    predicted_rain_mm: float
    rain_p10: float
    rain_p50: float
    rain_p90: float
    dry_risk: float
    normal_risk: float
    wet_risk: float
    top_analog_years: list[int] = Field(default_factory=list)

    @field_validator("dry_risk", "normal_risk", "wet_risk")
    @classmethod
    def validate_probability(cls, value: float) -> float:
        if value < 0 or value > 1:
            raise ValueError("probability values must be between 0 and 1")
        return value


class ClimateOutput(BaseModel):
    model_type: str
    request_location: dict[str, float]
    target_month: int
    forecast_horizon_months: int
    forecast_blocks: list[ForecastBlock] = Field(default_factory=list)
