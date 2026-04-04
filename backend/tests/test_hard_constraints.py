from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.schemas.suitability import SuitabilityResult
from app.services.hard_constraint_service import HardConstraintService


def test_hard_constraints_keep_low_budget_and_low_suitability_crops_in_scoring_pool():
    crops = [
        CropRecord(
            id="unsuitable",
            name="Unsuitable",
            growth_days=30,
            min_rainfall_mm=100.0,
            max_rainfall_mm=200.0,
            min_temp_c=20.0,
            max_temp_c=30.0,
            planting_months=[4],
            min_budget_per_m2=1.0,
            drought_sensitive=False,
            flood_sensitive=False,
            enabled=True,
        ),
        CropRecord(
            id="low_budget",
            name="Low Budget",
            growth_days=30,
            min_rainfall_mm=100.0,
            max_rainfall_mm=200.0,
            min_temp_c=20.0,
            max_temp_c=30.0,
            planting_months=[4],
            min_budget_per_m2=10.0,
            drought_sensitive=False,
            flood_sensitive=False,
            enabled=True,
        ),
        CropRecord(
            id="excluded",
            name="Excluded",
            growth_days=30,
            min_rainfall_mm=100.0,
            max_rainfall_mm=200.0,
            min_temp_c=20.0,
            max_temp_c=30.0,
            planting_months=[4],
            min_budget_per_m2=1.0,
            drought_sensitive=False,
            flood_sensitive=False,
            enabled=True,
        ),
        CropRecord(
            id="slow",
            name="Slow",
            growth_days=90,
            min_rainfall_mm=100.0,
            max_rainfall_mm=200.0,
            min_temp_c=20.0,
            max_temp_c=30.0,
            planting_months=[4],
            min_budget_per_m2=1.0,
            drought_sensitive=False,
            flood_sensitive=False,
            enabled=True,
        ),
    ]
    results = [
        SuitabilityResult(crop_id="unsuitable", suitable=False, reason="rainfall outside crop tolerance"),
        SuitabilityResult(crop_id="low_budget", suitable=True, reason="ok"),
        SuitabilityResult(crop_id="excluded", suitable=True, reason="ok"),
        SuitabilityResult(crop_id="slow", suitable=True, reason="ok"),
    ]
    normalized = NormalizedFarmInput(area_m2=100.0, budget_myr=200.0, target_month=4)
    preferences = UserPreferences(excluded_crops=["excluded"], harvest_preference="fast")

    eligible, eliminated = HardConstraintService().apply(crops, results, normalized, preferences)

    assert [crop.id for crop in eligible] == ["unsuitable", "low_budget"]
    reasons = {item.crop_id: item.reason for item in eliminated}
    assert "unsuitable" not in reasons
    assert reasons["excluded"] == "crop excluded by user"
    assert "60 days" in reasons["slow"]


def test_hard_constraints_limit_eligibility_to_preferred_crops():
    crops = [
        CropRecord(
            id="tomato",
            name="Tomato",
            growth_days=80,
            min_rainfall_mm=100.0,
            max_rainfall_mm=200.0,
            min_temp_c=20.0,
            max_temp_c=30.0,
            planting_months=[4],
            min_budget_per_m2=1.0,
            drought_sensitive=False,
            flood_sensitive=False,
            enabled=True,
        ),
        CropRecord(
            id="spinach",
            name="Spinach",
            growth_days=35,
            min_rainfall_mm=100.0,
            max_rainfall_mm=200.0,
            min_temp_c=20.0,
            max_temp_c=30.0,
            planting_months=[4],
            min_budget_per_m2=1.0,
            drought_sensitive=False,
            flood_sensitive=False,
            enabled=True,
        ),
    ]
    results = [
        SuitabilityResult(crop_id="tomato", suitable=True, reason="ok"),
        SuitabilityResult(crop_id="spinach", suitable=True, reason="ok"),
    ]
    normalized = NormalizedFarmInput(area_m2=100.0, budget_myr=500.0, target_month=4)
    preferences = UserPreferences(preferred_crops=["tomato"])

    eligible, eliminated = HardConstraintService().apply(crops, results, normalized, preferences)

    assert [crop.id for crop in eligible] == ["tomato"]
    reasons = {item.crop_id: item.reason for item in eliminated}
    assert reasons["spinach"] == "crop not included in the user's selected crop list"
