from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.schemas.price import PriceResult
from app.schemas.suitability import SuitabilityResult
from app.services.decision_service import DecisionService
from app.services.price_service import PriceService


class FakeClimateService:
    def score_crop(self, crop, climate_output):
        return {"spinach": 0.2, "chili": 1.0}[crop.id]


class RewardBiasedPriceService:
    def get_price(self, crop):
        predicted_price = {"spinach": 12.0, "chili": 6.0, "kangkung": 5.0}[crop.id]
        return PriceResult(
            crop_id=crop.id,
            current_price=predicted_price,
            predicted_price=predicted_price,
            pct_change=0.0,
            trend="STABLE",
            confidence="LOW",
            method="baseline_fallback",
        )

    def build_rank_scores(self, crops):
        scores = {"spinach": 1.0, "chili": 0.0, "kangkung": 0.2}
        return {crop.id: scores[crop.id] for crop in crops}


def test_decision_weights_sum_to_one():
    assert sum(DecisionService.AGGRESSIVE_WEIGHTS.values()) == 1.0
    assert sum(DecisionService.CONSERVATIVE_WEIGHTS.values()) == 1.0


def test_aggressive_picks_highest_reward_and_conservative_picks_lowest_risk():
    fast_crop = CropRecord(
        id="spinach",
        name="Spinach",
        growth_days=30,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    safe_crop = CropRecord(
        id="chili",
        name="Chili",
        growth_days=170,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    decision_service = DecisionService(
        climate_service=FakeClimateService(),
        price_service=RewardBiasedPriceService(),
    )
    output = decision_service.decide(
        [fast_crop, safe_crop],
        [
            SuitabilityResult(crop_id="spinach", suitable=True, reason="ok"),
            SuitabilityResult(crop_id="chili", suitable=True, reason="ok"),
        ],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
    )

    assert output.aggressive_plan.top_crop.crop_id == "spinach"
    assert output.conservative_plan.top_crop.crop_id == "chili"
    assert output.aggressive_plan.top_crop.reward_score > output.conservative_plan.top_crop.reward_score
    assert output.conservative_plan.top_crop.risk_score < output.aggressive_plan.top_crop.risk_score


def test_conservative_prefers_next_lowest_risk_when_best_reward_crop_is_also_safest():
    fast_safe_crop = CropRecord(
        id="spinach",
        name="Spinach",
        growth_days=30,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    second_safe_crop = CropRecord(
        id="kangkung",
        name="Kangkung",
        growth_days=45,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )

    class UniformClimateService:
        def score_crop(self, crop, climate_output):
            return 1.0

    output = DecisionService(
        climate_service=UniformClimateService(),
        price_service=RewardBiasedPriceService(),
    ).decide(
        [fast_safe_crop, second_safe_crop],
        [
            SuitabilityResult(crop_id="spinach", suitable=True, reason="ok"),
            SuitabilityResult(crop_id="kangkung", suitable=True, reason="ok"),
        ],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
    )

    assert output.aggressive_plan.top_crop.crop_id == "spinach"
    assert output.conservative_plan.top_crop.crop_id == "kangkung"


def test_unsuitable_crop_receives_lower_suitability_score():
    crop = CropRecord(
        id="spinach",
        name="Spinach",
        growth_days=30,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    class StableSingleCropPriceService:
        def get_price(self, crop, normalized_input=None):
            return PriceResult(
                crop_id=crop.id,
                current_price=10.0,
                predicted_price=10.1,
                pct_change=1.0,
                trend="STABLE",
                confidence="HIGH",
                method="xgboost_saved_model",
            )

        def build_rank_scores(self, crops, normalized_input=None):
            return {crop.id: 0.4 for crop in crops}

    decision_service = DecisionService(
        climate_service=FakeClimateService(),
        price_service=StableSingleCropPriceService(),
    )

    suitable = decision_service.decide(
        [crop],
        [SuitabilityResult(crop_id="spinach", suitable=True, reason="ok")],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
    )
    unsuitable = decision_service.decide(
        [crop],
        [SuitabilityResult(crop_id="spinach", suitable=False, reason="outside tolerance")],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
    )

    assert suitable.ranked_crops[0].score_breakdown.suitability_score == 1.0
    assert unsuitable.ranked_crops[0].score_breakdown.suitability_score == 0.25


def test_low_risk_preference_biases_scores_toward_safer_crop():
    fast_risky_crop = CropRecord(
        id="spinach",
        name="Spinach",
        growth_days=35,
        min_rainfall_mm=100.0,
        max_rainfall_mm=180.0,
        min_temp_c=18.0,
        max_temp_c=28.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    safe_crop = CropRecord(
        id="chili",
        name="Chili",
        growth_days=110,
        min_rainfall_mm=120.0,
        max_rainfall_mm=220.0,
        min_temp_c=21.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    decision_service = DecisionService(
        climate_service=FakeClimateService(),
        price_service=RewardBiasedPriceService(),
    )

    baseline = decision_service.decide(
        [fast_risky_crop, safe_crop],
        [
            SuitabilityResult(crop_id="spinach", suitable=True, reason="ok"),
            SuitabilityResult(crop_id="chili", suitable=True, reason="ok"),
        ],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
        user_preferences=UserPreferences(),
    )
    low_risk = decision_service.decide(
        [fast_risky_crop, safe_crop],
        [
            SuitabilityResult(crop_id="spinach", suitable=True, reason="ok"),
            SuitabilityResult(crop_id="chili", suitable=True, reason="ok"),
        ],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
        user_preferences=UserPreferences(risk_preference="low"),
    )

    baseline_scores = {crop.crop_id: crop.aggressive_score for crop in baseline.ranked_crops}
    low_risk_scores = {crop.crop_id: crop.aggressive_score for crop in low_risk.ranked_crops}

    assert baseline.aggressive_plan.top_crop.crop_id == "spinach"
    assert low_risk.conservative_plan.top_crop.crop_id == "chili"
    assert low_risk_scores["chili"] > baseline_scores["chili"]
    assert low_risk_scores["spinach"] < baseline_scores["spinach"]


def test_aggressive_filters_out_downtrend_crops_when_non_downtrend_exists():
    strong_downtrend_crop = CropRecord(
        id="spinach",
        name="Spinach",
        growth_days=30,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    stable_crop = CropRecord(
        id="chili",
        name="Chili",
        growth_days=120,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )

    class DowntrendFilteredPriceService:
        def get_price(self, crop, normalized_input=None):
            table = {
                "spinach": PriceResult(
                    crop_id="spinach",
                    current_price=10.0,
                    predicted_price=8.2,
                    pct_change=-18.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "chili": PriceResult(
                    crop_id="chili",
                    current_price=10.0,
                    predicted_price=10.1,
                    pct_change=1.0,
                    trend="STABLE",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

        def build_rank_scores(self, crops, normalized_input=None):
            scores = {"spinach": 0.95, "chili": 0.4}
            return {crop.id: scores[crop.id] for crop in crops}

    output = DecisionService(
        climate_service=FakeClimateService(),
        price_service=DowntrendFilteredPriceService(),
    ).decide(
        [strong_downtrend_crop, stable_crop],
        [
            SuitabilityResult(crop_id="spinach", suitable=True, reason="ok"),
            SuitabilityResult(crop_id="chili", suitable=True, reason="ok"),
        ],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
    )

    assert output.aggressive_plan.top_crop.crop_id == "chili"
    assert output.conservative_plan.top_crop.crop_id == "spinach"
    assert [crop.crop_id for crop in output.ranked_crops] == ["chili"]


def test_aggressive_falls_back_to_best_scored_downtrend_when_every_price_trend_is_down():
    first_crop = CropRecord(
        id="spinach",
        name="Spinach",
        growth_days=30,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    second_crop = CropRecord(
        id="chili",
        name="Chili",
        growth_days=120,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )

    class AllDowntrendPriceService:
        def get_price(self, crop, normalized_input=None):
            table = {
                "spinach": PriceResult(
                    crop_id="spinach",
                    current_price=10.0,
                    predicted_price=8.2,
                    pct_change=-18.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "chili": PriceResult(
                    crop_id="chili",
                    current_price=10.0,
                    predicted_price=8.8,
                    pct_change=-12.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

        def build_rank_scores(self, crops, normalized_input=None):
            scores = {"spinach": 0.8, "chili": 0.3}
            return {crop.id: scores[crop.id] for crop in crops}

    output = DecisionService(
        climate_service=FakeClimateService(),
        price_service=AllDowntrendPriceService(),
    ).decide(
        [first_crop, second_crop],
        [
            SuitabilityResult(crop_id="spinach", suitable=True, reason="ok"),
            SuitabilityResult(crop_id="chili", suitable=True, reason="ok"),
        ],
        climate_output=None,
        normalized_input=NormalizedFarmInput(area_m2=100.0, budget_myr=1000.0, target_month=4),
    )

    assert output.aggressive_plan.top_crop.crop_id == "spinach"
    assert output.conservative_plan.top_crop.crop_id == "chili"
    assert [crop.crop_id for crop in output.ranked_crops] == ["spinach", "chili"]
    assert output.ranked_crops[0].aggressive_score > output.ranked_crops[1].aggressive_score
