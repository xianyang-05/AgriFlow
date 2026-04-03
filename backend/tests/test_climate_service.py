import pytest

from app.exceptions import ClimateError
from app.schemas.climate import ClimateOutput, ForecastBlock
from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput
from app.services.climate_service import ClimateService


def make_crop(**overrides) -> CropRecord:
    payload = {
        "id": "test_crop",
        "name": "Test Crop",
        "growth_days": 60,
        "min_rainfall_mm": 100.0,
        "max_rainfall_mm": 200.0,
        "min_temp_c": 20.0,
        "max_temp_c": 30.0,
        "planting_months": [4],
        "min_budget_per_m2": 1.0,
        "drought_sensitive": False,
        "flood_sensitive": False,
        "enabled": True,
    }
    payload.update(overrides)
    return CropRecord(**payload)


def make_climate_output(blocks: list[ForecastBlock]) -> ClimateOutput:
    return ClimateOutput(
        model_type="stub",
        request_location={"lat": 5.9, "lon": 100.4},
        target_month=4,
        forecast_horizon_months=len(blocks),
        forecast_blocks=blocks,
    )


def test_get_output_raises_when_coordinates_are_missing():
    service = ClimateService()

    with pytest.raises(ClimateError):
        service.get_output(NormalizedFarmInput(target_month=4, forecast_horizon_months=3))


def test_rainfall_score_reaches_zero_at_tolerance_boundary():
    service = ClimateService()

    assert service._rainfall_score(100.0, 100.0, 200.0) == 0.0
    assert service._rainfall_score(150.0, 100.0, 200.0) == 1.0
    assert service._rainfall_score(200.0, 100.0, 200.0) == 0.0


def test_score_crop_penalty_scales_with_risk_severity():
    service = ClimateService()
    crop = make_crop(drought_sensitive=True)
    lower_risk_output = make_climate_output(
        [
            ForecastBlock(
                horizon_months=2,
                predicted_rain_mm=150.0,
                rain_p10=120.0,
                rain_p50=150.0,
                rain_p90=180.0,
                dry_risk=0.35,
                normal_risk=0.45,
                wet_risk=0.20,
            )
        ]
    )
    higher_risk_output = make_climate_output(
        [
            ForecastBlock(
                horizon_months=2,
                predicted_rain_mm=150.0,
                rain_p10=120.0,
                rain_p50=150.0,
                rain_p90=180.0,
                dry_risk=0.80,
                normal_risk=0.10,
                wet_risk=0.10,
            )
        ]
    )

    assert service.score_crop(crop, higher_risk_output) < service.score_crop(crop, lower_risk_output)


def test_summarize_uses_average_rainfall_across_blocks():
    service = ClimateService()
    climate_output = make_climate_output(
        [
            ForecastBlock(
                horizon_months=1,
                predicted_rain_mm=120.0,
                rain_p10=100.0,
                rain_p50=120.0,
                rain_p90=140.0,
                dry_risk=0.2,
                normal_risk=0.5,
                wet_risk=0.3,
            ),
            ForecastBlock(
                horizon_months=2,
                predicted_rain_mm=240.0,
                rain_p10=200.0,
                rain_p50=240.0,
                rain_p90=280.0,
                dry_risk=0.1,
                normal_risk=0.4,
                wet_risk=0.5,
            ),
        ]
    )

    assert service.summarize(climate_output) == "Average projected rainfall is 180mm across 2 months."
