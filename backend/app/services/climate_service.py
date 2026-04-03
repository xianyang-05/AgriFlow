from app.adapters.climate_model_adapter import ClimateModelAdapter
from app.exceptions import ClimateError
from app.logging_config import update_request_logging
from app.schemas.climate import ClimateOutput, ClimateRequest, ForecastBlock
from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput


class ClimateService:
    def __init__(self, adapter: ClimateModelAdapter | None = None) -> None:
        self.adapter = adapter or ClimateModelAdapter()

    def get_output(self, normalized_input: NormalizedFarmInput) -> ClimateOutput:
        if normalized_input.latitude is None or normalized_input.longitude is None:
            raise ClimateError("Climate request requires resolved coordinates")

        request = ClimateRequest(
            lat=normalized_input.latitude,
            lon=normalized_input.longitude,
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
            penalty += self._scaled_risk_penalty(block.dry_risk, threshold=0.30)
        if crop.flood_sensitive and block.wet_risk > 0.35:
            penalty += self._scaled_risk_penalty(block.wet_risk, threshold=0.35)
        return max(0.0, min(1.0, rainfall_score - penalty))

    def summarize(self, climate_output: ClimateOutput | None) -> str:
        if not climate_output or not climate_output.forecast_blocks:
            return "Climate outlook unavailable."
        average_rainfall = sum(block.predicted_rain_mm for block in climate_output.forecast_blocks) / len(
            climate_output.forecast_blocks
        )
        return (
            f"Average projected rainfall is {average_rainfall:.0f}mm across "
            f"{climate_output.forecast_horizon_months} months."
        )

    def _rainfall_score(self, predicted_rainfall: float, minimum: float, maximum: float) -> float:
        if minimum <= predicted_rainfall <= maximum:
            midpoint = (minimum + maximum) / 2
            half_span = max((maximum - minimum) / 2, 1.0)
            return max(0.0, 1.0 - abs(predicted_rainfall - midpoint) / half_span)

        if predicted_rainfall < minimum:
            return max(0.0, 1.0 - ((minimum - predicted_rainfall) / max(minimum, 1.0)))
        return max(0.0, 1.0 - ((predicted_rainfall - maximum) / max(maximum, 1.0)))

    def _scaled_risk_penalty(self, risk: float, threshold: float, max_penalty: float = 0.20) -> float:
        if risk <= threshold:
            return 0.0

        return min(max_penalty, ((risk - threshold) / max(1.0 - threshold, 1e-6)) * max_penalty)
