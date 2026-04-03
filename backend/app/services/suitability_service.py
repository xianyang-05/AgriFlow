from app.schemas.climate import ClimateOutput
from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput
from app.schemas.suitability import SuitabilityResult
from app.services.climate_service import ClimateService


class SuitabilityService:
    def __init__(self, climate_service: ClimateService | None = None) -> None:
        self.climate_service = climate_service or ClimateService()

    def evaluate_crop(
        self,
        crop: CropRecord,
        normalized_input: NormalizedFarmInput,
        climate_output: ClimateOutput,
    ) -> SuitabilityResult:
        block = self.climate_service.select_forecast_block(crop, climate_output)
        crop_min_cost = crop.min_budget_per_m2 * (normalized_input.area_m2 or 0.0)

        if block.predicted_rain_mm < crop.min_rainfall_mm or block.predicted_rain_mm > crop.max_rainfall_mm:
            return SuitabilityResult(
                crop_id=crop.id,
                suitable=False,
                reason="rainfall outside crop tolerance",
            )

        if normalized_input.target_month not in crop.planting_months:
            return SuitabilityResult(
                crop_id=crop.id,
                suitable=False,
                reason="target month not in planting window",
            )

        if (normalized_input.budget_myr or 0.0) < crop_min_cost:
            return SuitabilityResult(
                crop_id=crop.id,
                suitable=False,
                reason="budget below minimum viable cost",
            )

        marginal = (
            block.predicted_rain_mm - crop.min_rainfall_mm < 10.0
            or crop.max_rainfall_mm - block.predicted_rain_mm < 10.0
        )
        return SuitabilityResult(
            crop_id=crop.id,
            suitable=True,
            marginal=marginal,
            reason="meets baseline requirements",
        )

    def evaluate_all(
        self,
        crops: list[CropRecord],
        normalized_input: NormalizedFarmInput,
        climate_output: ClimateOutput,
    ) -> list[SuitabilityResult]:
        return [self.evaluate_crop(crop, normalized_input, climate_output) for crop in crops]
