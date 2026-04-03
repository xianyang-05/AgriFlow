from app.schemas.climate import ClimateOutput
from app.schemas.crop import CropRecord
from app.schemas.decision import CropPlan, DecisionOutput, ScoreBreakdown, ScoredCrop
from app.schemas.input import NormalizedFarmInput
from app.schemas.suitability import SuitabilityResult
from app.services.climate_service import ClimateService
from app.services.price_service import PriceService


class DecisionService:
    REWARD_WEIGHTS = {
        "suitability_score": 0.25,
        "climate_score": 0.20,
        "budget_fit_score": 0.20,
        "price_score": 0.05,
        "duration_fit_score": 0.30,
    }
    RISK_WEIGHTS = {
        "suitability_score": 0.35,
        "climate_score": 0.35,
        "budget_fit_score": 0.20,
        "price_score": 0.05,
        "duration_fit_score": 0.05,
    }
    AGGRESSIVE_WEIGHTS = REWARD_WEIGHTS
    CONSERVATIVE_WEIGHTS = RISK_WEIGHTS

    def __init__(
        self,
        climate_service: ClimateService | None = None,
        price_service: PriceService | None = None,
    ) -> None:
        self.climate_service = climate_service or ClimateService()
        self.price_service = price_service or PriceService()

    def decide(
        self,
        eligible_crops: list[CropRecord],
        suitability_results: list[SuitabilityResult],
        climate_output: ClimateOutput,
        normalized_input: NormalizedFarmInput,
    ) -> DecisionOutput:
        if not eligible_crops:
            return DecisionOutput()

        suitability_map = {result.crop_id: result for result in suitability_results}
        price_scores = self.price_service.build_rank_scores(eligible_crops)
        scored_crops: list[ScoredCrop] = []

        for crop in eligible_crops:
            suitability = suitability_map[crop.id]
            breakdown = ScoreBreakdown(
                suitability_score=self._suitability_score(suitability),
                climate_score=self.climate_service.score_crop(crop, climate_output),
                budget_fit_score=self._budget_fit_score(crop, normalized_input),
                price_score=price_scores[crop.id],
                duration_fit_score=max(0.0, min(1.0, 1.0 - (crop.growth_days / 180.0))),
            )
            reward_score = self._weighted_score(breakdown, self.REWARD_WEIGHTS)
            risk_score = self._risk_score(breakdown, self.RISK_WEIGHTS)
            safety_score = round(1.0 - risk_score, 4)
            scored_crops.append(
                ScoredCrop(
                    crop_id=crop.id,
                    crop_name=crop.name,
                    aggressive_score=reward_score,
                    conservative_score=safety_score,
                    reward_score=reward_score,
                    risk_score=risk_score,
                    score_breakdown=breakdown,
                    price_result=self.price_service.get_price(crop),
                    growth_days=crop.growth_days,
                )
            )

        ranked_crops = sorted(
            scored_crops,
            key=lambda crop: (crop.reward_score, -crop.risk_score, crop.conservative_score),
            reverse=True,
        )
        aggressive_top = ranked_crops[0]
        conservative_top = self._pick_lowest_risk_crop(scored_crops, exclude_crop_id=aggressive_top.crop_id)

        return DecisionOutput(
            ranked_crops=ranked_crops,
            aggressive_plan=CropPlan(
                strategy="aggressive",
                top_crop=aggressive_top,
                rationale="Selected for the highest reward potential, prioritizing faster harvests and stronger upside.",
            ),
            conservative_plan=CropPlan(
                strategy="conservative",
                top_crop=conservative_top,
                rationale="Selected for the lowest overall risk, prioritizing climate stability and dependable fit.",
            ),
        )

    def _suitability_score(self, suitability: SuitabilityResult) -> float:
        if not suitability.suitable:
            return 0.0
        if suitability.marginal:
            return 0.6
        return 1.0

    def _budget_fit_score(self, crop: CropRecord, normalized_input: NormalizedFarmInput) -> float:
        crop_min_cost = crop.min_budget_per_m2 * (normalized_input.area_m2 or 0.0)
        if crop_min_cost <= 0:
            return 0.0
        budget = normalized_input.budget_myr or 0.0
        return max(0.0, min(1.0, (budget - crop_min_cost) / crop_min_cost))

    def _weighted_score(self, breakdown: ScoreBreakdown, weights: dict[str, float]) -> float:
        return round(
            sum(getattr(breakdown, metric) * weight for metric, weight in weights.items()),
            4,
        )

    def _risk_score(self, breakdown: ScoreBreakdown, weights: dict[str, float]) -> float:
        return round(
            sum((1.0 - getattr(breakdown, metric)) * weight for metric, weight in weights.items()),
            4,
        )

    def _pick_lowest_risk_crop(
        self,
        scored_crops: list[ScoredCrop],
        *,
        exclude_crop_id: str | None = None,
    ) -> ScoredCrop:
        candidates = [
            crop for crop in scored_crops if crop.crop_id != exclude_crop_id
        ] or scored_crops
        return min(
            candidates,
            key=lambda crop: (crop.risk_score, -crop.reward_score, -crop.conservative_score),
        )
