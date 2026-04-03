from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput
from app.schemas.suitability import SuitabilityResult
from app.services.decision_service import DecisionService
from app.services.price_service import PriceService


class FakeClimateService:
    def score_crop(self, crop, climate_output):
        return {"spinach": 0.2, "chili": 1.0}[crop.id]


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
    decision_service = DecisionService(climate_service=FakeClimateService(), price_service=PriceService())
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
        price_service=PriceService(),
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
    decision_service = DecisionService(climate_service=FakeClimateService(), price_service=PriceService())

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
    assert unsuitable.ranked_crops[0].score_breakdown.suitability_score == 0.0
