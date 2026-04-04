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
        reasons: list[str] = []

        # ------------------------------------------------------------------
        # Rainfall check — uses forecast interval (p10/p90) rather than the
        # point estimate so crops are only eliminated when the entire
        # plausible rainfall range falls outside the crop's tolerance.
        #
        # Too dry:  even the wettest plausible scenario (p90) is below minimum.
        # Too wet:  even the driest plausible scenario (p10) exceeds maximum.
        # ------------------------------------------------------------------
        if block.rain_p90 < crop.min_rainfall_mm:
            reasons.append(
                f"rainfall forecast (p90={block.rain_p90:.0f}mm) "
                f"below crop minimum ({crop.min_rainfall_mm:.0f}mm) — too dry even in wet scenarios"
            )
        elif block.rain_p10 > crop.max_rainfall_mm:
            reasons.append(
                f"rainfall forecast (p10={block.rain_p10:.0f}mm) "
                f"above crop maximum ({crop.max_rainfall_mm:.0f}mm) — too wet even in dry scenarios"
            )

        # ------------------------------------------------------------------
        # Planting season check
        # ------------------------------------------------------------------
        if normalized_input.target_month not in crop.planting_months:
            reasons.append(
                f"target month ({normalized_input.target_month}) "
                f"not in planting window {crop.planting_months}"
            )

        # ------------------------------------------------------------------
        # Budget check is intentionally NOT here.
        # Budget elimination is the responsibility of hard_constraint_service
        # which runs after suitability. Duplicating it here causes double
        # elimination with potentially inconsistent reasons.
        # ------------------------------------------------------------------

        if reasons:
            return SuitabilityResult(
                crop_id=crop.id,
                suitable=True,
                marginal=True,
                reason="; ".join(reasons),
            )

        # ------------------------------------------------------------------
        # Marginal check — crop passes hard bounds but sits close to the edge.
        # Threshold is proportional to the crop's own tolerance window (8%)
        # rather than a flat mm value, so sensitivity scales with the crop.
        #
        # Examples at 8%:
        #   maize     (500–800mm, window 300mm) → margin = 24mm
        #   kangkung  (100–300mm, window 200mm) → margin = 16mm
        #   spinach   (400–700mm, window 300mm) → margin = 24mm
        # ------------------------------------------------------------------
        tolerance_window = crop.max_rainfall_mm - crop.min_rainfall_mm
        margin = tolerance_window * 0.08

        marginal = (
            block.predicted_rain_mm - crop.min_rainfall_mm < margin
            or crop.max_rainfall_mm - block.predicted_rain_mm < margin
        )

        return SuitabilityResult(
            crop_id=crop.id,
            suitable=True,
            marginal=marginal,
            reason="marginal rainfall fit — close to tolerance boundary" if marginal else "meets baseline requirements",
        )

    def evaluate_all(
        self,
        crops: list[CropRecord],
        normalized_input: NormalizedFarmInput,
        climate_output: ClimateOutput,
    ) -> list[SuitabilityResult]:
        return [
            self.evaluate_crop(crop, normalized_input, climate_output)
            for crop in crops
        ]
