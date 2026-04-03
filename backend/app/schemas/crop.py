from pydantic import BaseModel, ConfigDict, Field, field_validator


class CropRequirements(BaseModel):
    growth_days: int
    min_rainfall_mm: float
    max_rainfall_mm: float
    min_temp_c: float
    max_temp_c: float
    planting_months: list[int] = Field(default_factory=list)
    min_budget_per_m2: float
    drought_sensitive: bool
    flood_sensitive: bool

    @field_validator("planting_months")
    @classmethod
    def validate_months(cls, value: list[int]) -> list[int]:
        for month in value:
            if month < 1 or month > 12:
                raise ValueError("planting months must be between 1 and 12")
        return value


class CropRecord(CropRequirements):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    enabled: bool = True
