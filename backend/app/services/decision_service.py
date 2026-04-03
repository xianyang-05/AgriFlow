from app.schemas.climate import ClimateOutput
from app.schemas.crop import CropRecord
from app.schemas.decision import CropPlan, DecisionOutput, ScoreBreakdown, ScoredCrop
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.schemas.suitability import SuitabilityResult
from app.exceptions import NoViableCropsError
from app.logging_config import get_logger, update_request_logging
from app.services.climate_service import ClimateService
from app.services.price_service import PriceService

logger = get_logger()


class DecisionService:
    FASTEST_GROWTH_DAYS = 30
    SLOWEST_GROWTH_DAYS = 120

    # ------------------------------------------------------------------
    # Aggressive: price yield is dominant (0.55).
    # Climate and duration still contribute at low weights so catastrophic
    # weather risk is not completely invisible — but they are minor enough
    # that a high-price crop with elevated risk still wins over a low-price
    # safe crop. The farmer is yield-chasing, not risk-blind.
    #
    # Weight reasoning:
    #   price_score      0.55  dominant signal — drives the ranking
    #   suitability      0.20  ensures crop is genuinely growable
    #   budget_fit       0.10  ensures budget headroom exists
    #   climate_score    0.10  survival floor — prevents total blind spots
    #   duration_fit     0.05  minor preference signal when set by user
    # ------------------------------------------------------------------
    AGGRESSIVE_WEIGHTS: dict[str, float] = {
        "price_score": 0.55,
        "suitability_score": 0.20,
        "budget_fit_score": 0.10,
        "climate_score": 0.10,
        "duration_fit_score": 0.05,
    }

    # ------------------------------------------------------------------
    # Conservative: risk safety is dominant (climate 0.40 + suitability 0.30 = 0.70).
    # Price is kept at 0.10 so the plan does not recommend the safest crop
    # with negligible return when a slightly riskier crop offers meaningfully
    # better profit at low extra risk.
    #
    # Weight reasoning:
    #   climate_score    0.40  primary safety signal
    #   suitability      0.30  agronomic fit
    #   budget_fit       0.15  ensures financial viability
    #   price_score      0.10  not zero-profit — rewards better-paying safe crops
    #   duration_fit     0.05  minor preference signal when set by user
    # ------------------------------------------------------------------
    CONSERVATIVE_WEIGHTS: dict[str, float] = {
        "climate_score": 0.40,
        "suitability_score": 0.30,
        "budget_fit_score": 0.15,
        "price_score": 0.10,
        "duration_fit_score": 0.05,
    }

    LOW_RISK_PREFERENCE_WEIGHTS: dict[str, float] = {
        "climate_score": 0.45,
        "suitability_score": 0.30,
        "budget_fit_score": 0.15,
        "duration_fit_score": 0.10,
        "price_score": 0.00,
    }

    HIGH_UPSIDE_PREFERENCE_WEIGHTS: dict[str, float] = {
        "price_score": 0.65,
        "suitability_score": 0.15,
        "budget_fit_score": 0.10,
        "climate_score": 0.05,
        "duration_fit_score": 0.05,
    }

    PREFERRED_CROP_BONUS = 0.08

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
        user_preferences: UserPreferences | None = None,
    ) -> DecisionOutput:
        user_preferences = user_preferences or UserPreferences()
        if not eligible_crops:
            raise NoViableCropsError(
                "No crops remained after hard constraint filtering. "
                "Consider adjusting budget, location, or planting month."
            )

        suitability_map = {r.crop_id: r for r in suitability_results}
        try:
            price_scores = self.price_service.build_rank_scores(
                eligible_crops,
                normalized_input=normalized_input,
            )
        except TypeError:
            price_scores = self.price_service.build_rank_scores(eligible_crops)
        scored_crops: list[ScoredCrop] = []

        for crop in eligible_crops:
            suitability = suitability_map[crop.id]
            price_result = self._get_price_result(crop, normalized_input)

            breakdown = ScoreBreakdown(
                suitability_score=self._suitability_score(suitability),
                climate_score=self.climate_service.score_crop(crop, climate_output),
                budget_fit_score=self._budget_fit_score(crop, normalized_input),
                price_score=price_scores[crop.id],
                duration_fit_score=self._duration_fit_score(crop, user_preferences),
            )

            aggressive_score = self._weighted_score(breakdown, self.AGGRESSIVE_WEIGHTS)
            conservative_score = self._weighted_score(breakdown, self.CONSERVATIVE_WEIGHTS)
            aggressive_score, conservative_score = self._apply_user_preference_bias(
                crop,
                breakdown,
                aggressive_score,
                conservative_score,
                user_preferences,
            )

            scored_crops.append(
                ScoredCrop(
                    crop_id=crop.id,
                    crop_name=crop.name,
                    aggressive_score=aggressive_score,
                    conservative_score=conservative_score,
                    reward_score=aggressive_score,
                    risk_score=round(max(0.0, min(1.0, 1.0 - conservative_score)), 4),
                    score_breakdown=breakdown,
                    price_result=price_result,
                    growth_days=crop.growth_days,
                )
            )

        # Each plan is ranked independently by its own scoring axis.
        # Aggressive: price-led, climate visible but minor.
        # Conservative: safety-led, price as tiebreaker.
        aggressive_candidates = [
            crop for crop in scored_crops if crop.price_result.trend != "DOWN"
        ]
        aggressive_ranked = sorted(
            aggressive_candidates or scored_crops,
            key=lambda c: c.aggressive_score,
            reverse=True,
        )
        conservative_ranked = sorted(
            scored_crops,
            key=lambda c: (c.conservative_score, c.score_breakdown.price_score),
            reverse=True,
        )
        aggressive_downtrend_crops = [
            crop.crop_id for crop in scored_crops if crop.price_result.trend == "DOWN"
        ]
        aggressive_non_down_crops = [
            crop.crop_id for crop in scored_crops if crop.price_result.trend != "DOWN"
        ]
        aggressive_filter_mode = (
            "filtered_non_down" if aggressive_candidates else "fallback_all_scored"
        )
        price_trend_snapshot = [
            {
                "crop_id": crop.crop_id,
                "trend": crop.price_result.trend,
                "pct_change": crop.price_result.pct_change,
                "aggressive_score": crop.aggressive_score,
                "conservative_score": crop.conservative_score,
            }
            for crop in scored_crops
        ]
        update_request_logging(
            aggressive_filter_mode=aggressive_filter_mode,
            aggressive_non_down_crop_ids=aggressive_non_down_crops,
            aggressive_downtrend_crop_ids=aggressive_downtrend_crops,
            aggressive_ranked_crop_ids=[crop.crop_id for crop in aggressive_ranked],
            price_trend_snapshot=price_trend_snapshot,
        )
        logger.info(
            "decision.aggressive_filter",
            aggressive_filter_mode=aggressive_filter_mode,
            aggressive_non_down_crop_ids=aggressive_non_down_crops,
            aggressive_downtrend_crop_ids=aggressive_downtrend_crops,
            aggressive_ranked_crop_ids=[crop.crop_id for crop in aggressive_ranked],
            price_trend_snapshot=price_trend_snapshot,
        )

        aggressive_top = aggressive_ranked[0] if aggressive_ranked else None

        # Prefer a different crop for the conservative plan so both plans
        # offer the farmer a genuine choice. Fall back to the same crop
        # only when there is no alternative.
        conservative_candidates = [
            c for c in conservative_ranked if aggressive_top is None or c.crop_id != aggressive_top.crop_id
        ]
        conservative_top = (
            conservative_candidates[0] if conservative_candidates else conservative_ranked[0]
        )

        return DecisionOutput(
            ranked_crops=aggressive_ranked,
            aggressive_plan=(
                CropPlan(
                    strategy="aggressive",
                    top_crop=aggressive_top,
                    rationale=(
                        "Selected for the highest expected price yield. "
                        "Climate risk is considered but does not override price as the primary driver."
                    ),
                )
                if aggressive_top is not None
                else None
            ),
            conservative_plan=CropPlan(
                strategy="conservative",
                top_crop=conservative_top,
                rationale=(
                    "Selected for the strongest climate safety and suitability profile. "
                    "Offers reliable growing conditions with reasonable return potential."
                ),
            ),
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _suitability_score(self, suitability: SuitabilityResult) -> float:
        if not suitability.suitable:
            return 0.25
        if suitability.marginal:
            return 0.6
        return 1.0

    def _budget_fit_score(
        self,
        crop: CropRecord,
        normalized_input: NormalizedFarmInput,
    ) -> float:
        crop_min_cost = crop.min_budget_per_m2 * (normalized_input.area_m2 or 0.0)
        if crop_min_cost <= 0:
            return 0.0
        budget = normalized_input.budget_myr or 0.0
        return max(0.0, min(1.0, budget / crop_min_cost))

    def _duration_fit_score(
        self,
        crop: CropRecord,
        user_preferences: UserPreferences,
    ) -> float:
        span = max(1, self.SLOWEST_GROWTH_DAYS - self.FASTEST_GROWTH_DAYS)
        base_score = 1.0 - ((crop.growth_days - self.FASTEST_GROWTH_DAYS) / span)
        base_score = max(0.0, min(1.0, base_score))
        if user_preferences.harvest_preference == "fast":
            return min(1.0, round((base_score * 0.85) + 0.15, 4))
        return round(base_score, 4)

    def _weighted_score(
        self,
        breakdown: ScoreBreakdown,
        weights: dict[str, float],
    ) -> float:
        return round(
            sum(
                getattr(breakdown, metric) * weight
                for metric, weight in weights.items()
            ),
            4,
        )

    def _apply_user_preference_bias(
        self,
        crop: CropRecord,
        breakdown: ScoreBreakdown,
        aggressive_score: float,
        conservative_score: float,
        user_preferences: UserPreferences,
    ) -> tuple[float, float]:
        if crop.id in user_preferences.preferred_crops:
            aggressive_score = min(1.0, aggressive_score + self.PREFERRED_CROP_BONUS)
            conservative_score = min(1.0, conservative_score + self.PREFERRED_CROP_BONUS)

        if user_preferences.risk_preference == "low":
            safer_score = self._weighted_score(breakdown, self.LOW_RISK_PREFERENCE_WEIGHTS)
            aggressive_score = self._blend_scores(aggressive_score, safer_score, 0.55)
            conservative_score = self._blend_scores(conservative_score, safer_score, 0.7)
        elif user_preferences.risk_preference == "high":
            upside_score = self._weighted_score(breakdown, self.HIGH_UPSIDE_PREFERENCE_WEIGHTS)
            aggressive_score = self._blend_scores(aggressive_score, upside_score, 0.7)
            conservative_score = self._blend_scores(conservative_score, upside_score, 0.35)

        return aggressive_score, conservative_score

    def _get_price_result(
        self,
        crop: CropRecord,
        normalized_input: NormalizedFarmInput,
    ):
        try:
            return self.price_service.get_price(crop, normalized_input=normalized_input)
        except TypeError:
            return self.price_service.get_price(crop)

    def _blend_scores(self, base_score: float, preference_score: float, preference_weight: float) -> float:
        blended = (base_score * (1.0 - preference_weight)) + (preference_score * preference_weight)
        return round(max(0.0, min(1.0, blended)), 4)
