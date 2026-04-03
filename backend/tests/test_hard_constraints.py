from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.schemas.suitability import SuitabilityResult
from app.services.hard_constraint_service import HardConstraintService


def test_hard_constraints_eliminate_each_constraint_type():
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
            id="expensive",
            name="Expensive",
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
        SuitabilityResult(crop_id="expensive", suitable=True, reason="ok"),
        SuitabilityResult(crop_id="excluded", suitable=True, reason="ok"),
        SuitabilityResult(crop_id="slow", suitable=True, reason="ok"),
    ]
    normalized = NormalizedFarmInput(area_m2=100.0, budget_myr=200.0, target_month=4)
    preferences = UserPreferences(excluded_crops=["excluded"], harvest_preference="fast")

    eligible, eliminated = HardConstraintService().apply(crops, results, normalized, preferences)

    assert eligible == []
    reasons = {item.crop_id: item.reason for item in eliminated}
    assert reasons["unsuitable"] == "rainfall outside crop tolerance"
    assert reasons["expensive"] == "budget below minimum viable cost"
    assert reasons["excluded"] == "crop excluded by user"
    assert "60 days" in reasons["slow"]
