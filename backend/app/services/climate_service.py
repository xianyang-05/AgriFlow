from app.adapters.climate_model_adapter import ClimateModelAdapter
from app.logging_config import update_request_logging
from app.schemas.climate import ClimateOutput, ClimateRequest, ForecastBlock
from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput


class ClimateService:
    def __init__(self, adapter: ClimateModelAdapter | None = None) -> None:
        self.adapter = adapter or ClimateModelAdapter()

    def get_output(self, normalized_input: NormalizedFarmInput) -> ClimateOutput:
        request = ClimateRequest(
            lat=normalized_input.latitude or 0.0,
            lon=normalized_input.longitude or 0.0,
            target_month=normalized_input.target_month or 1,
            horizon_months=normalized_input.forecast_horizon_months or 3,
        )
        climate_output = self.adapter.fetch(request)
        update_request_logging(
            climate_model_version=climate_output.model_type,
            horizon=climate_output.forecast_horizon_months,
        )
        return climate_output

    def select_forecast_block(self, crop: CropRecord, climate_output: ClimateOutput) -> ForecastBlock:
        target_horizon = max(1, round(crop.growth_days / 30))
        return min(
            climate_output.forecast_blocks,
            key=lambda block: abs(block.horizon_months - target_horizon),
        )

    def score_crop(self, crop: CropRecord, climate_output: ClimateOutput) -> float:
        block = self.select_forecast_block(crop, climate_output)
        rainfall_score = self._rainfall_score(
            block.predicted_rain_mm,
            crop.min_rainfall_mm,
            crop.max_rainfall_mm,
        )
        penalty = 0.0
        if crop.drought_sensitive and block.dry_risk > 0.30:
            penalty += 0.20
        if crop.flood_sensitive and block.wet_risk > 0.35:
            penalty += 0.20
        return max(0.0, min(1.0, rainfall_score - penalty))

    def summarize(self, climate_output: ClimateOutput | None) -> str:
        if not climate_output or not climate_output.forecast_blocks:
            return "Climate outlook unavailable."
        first = climate_output.forecast_blocks[0]
        last = climate_output.forecast_blocks[-1]
        return (
            f"Rainfall is projected between {first.predicted_rain_mm:.0f}mm and "
            f"{last.predicted_rain_mm:.0f}mm across {climate_output.forecast_horizon_months} months."
        )

    def _rainfall_score(self, predicted_rainfall: float, minimum: float, maximum: float) -> float:
        if minimum <= predicted_rainfall <= maximum:
            midpoint = (minimum + maximum) / 2
            half_span = max((maximum - minimum) / 2, 1.0)
            return max(0.5, 1.0 - abs(predicted_rainfall - midpoint) / half_span)

        if predicted_rainfall < minimum:
            return max(0.0, 1.0 - ((minimum - predicted_rainfall) / max(minimum, 1.0)))
        return max(0.0, 1.0 - ((predicted_rainfall - maximum) / max(maximum, 1.0)))
