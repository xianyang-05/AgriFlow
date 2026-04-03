import pytest

from app.adapters.climate_model_adapter import ClimateModelAdapter
from app.exceptions import ClimateError
from app.schemas.climate import ClimateRequest


def test_climate_adapter_parses_stub_correctly(climate_payload):
    adapter = ClimateModelAdapter()
    output = adapter.parse(
        climate_payload,
        ClimateRequest(lat=5.9, lon=100.4, target_month=4, horizon_months=3),
    )

    assert output.model_type == "seasonal_v1"
    assert output.forecast_horizon_months == 3
    assert len(output.forecast_blocks) == 3
    assert output.forecast_blocks[0].predicted_rain_mm == 180.0
    assert output.forecast_blocks[2].wet_risk == 0.45


def test_climate_adapter_handles_incomplete_blocks(climate_payload):
    adapter = ClimateModelAdapter()
    climate_payload["forecasts"].append({"horizon_months": 4})
    output = adapter.parse(
        climate_payload,
        ClimateRequest(lat=5.9, lon=100.4, target_month=4, horizon_months=3),
    )

    assert len(output.forecast_blocks) == 3


def test_climate_adapter_raises_when_no_valid_blocks():
    adapter = ClimateModelAdapter()

    with pytest.raises(ClimateError):
        adapter.parse(
            {"model_type": "seasonal_v1", "forecasts": [{}]},
            ClimateRequest(lat=5.9, lon=100.4, target_month=4, horizon_months=3),
        )


def test_fetch_uses_local_model_prediction(monkeypatch):
    class FakeModel:
        def predict(self, payload):
            return [
                {"rainfall_mm": 180.0, "probabilities": {"dry": 0.2, "normal": 0.5, "wet": 0.3}},
                {"rainfall_mm": 190.0, "probabilities": {"dry": 0.18, "normal": 0.5, "wet": 0.32}},
            ]

    adapter = ClimateModelAdapter()
    adapter.settings.climate_model_path = "climate_model_v2.joblib"
    monkeypatch.setattr(adapter, "_load_local_artifact", lambda path: {"model": FakeModel()})

    output = adapter.fetch(
        ClimateRequest(lat=5.9, lon=100.4, target_month=4, horizon_months=2),
    )

    assert output.model_type == "FakeModel"
    assert len(output.forecast_blocks) == 2
    assert output.forecast_blocks[0].predicted_rain_mm == 180.0
    assert output.forecast_blocks[1].wet_risk == 0.32
