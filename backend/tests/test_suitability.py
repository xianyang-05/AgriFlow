from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput
from app.services.suitability_service import SuitabilityService


def test_suitability_rules_fire_for_correct_reasons(climate_output):
    service = SuitabilityService()

    rainfall_fail_crop = CropRecord(
        id="rain_fail",
        name="Rain Fail",
        growth_days=30,
        min_rainfall_mm=300.0,
        max_rainfall_mm=400.0,
        min_temp_c=20.0,
        max_temp_c=30.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )
    month_fail_crop = rainfall_fail_crop.model_copy(update={"id": "month_fail", "min_rainfall_mm": 100.0, "max_rainfall_mm": 300.0, "planting_months": [6]})
    budget_fail_crop = rainfall_fail_crop.model_copy(update={"id": "budget_fail", "min_rainfall_mm": 100.0, "max_rainfall_mm": 300.0, "planting_months": [4], "min_budget_per_m2": 20.0})
    success_crop = rainfall_fail_crop.model_copy(update={"id": "success", "min_rainfall_mm": 100.0, "max_rainfall_mm": 300.0, "planting_months": [4], "min_budget_per_m2": 1.0})
    normalized = NormalizedFarmInput(area_m2=100.0, budget_myr=500.0, target_month=4)

    rainfall_result = service.evaluate_crop(rainfall_fail_crop, normalized, climate_output)
    month_result = service.evaluate_crop(month_fail_crop, normalized, climate_output)
    budget_result = service.evaluate_crop(budget_fail_crop, normalized, climate_output)
    success_result = service.evaluate_crop(success_crop, normalized, climate_output)

    assert rainfall_result.suitable is True
    assert rainfall_result.marginal is True
    assert "below crop minimum" in rainfall_result.reason
    assert month_result.suitable is True
    assert month_result.marginal is True
    assert "target month (4) not in planting window [6]" == month_result.reason
    assert budget_result.suitable is True
    assert success_result.suitable is True
