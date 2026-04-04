from app.main import logger


def test_preview_request_logging_captures_runtime_fields(client, monkeypatch):
    events: list[dict] = []
    original_info = logger.info

    def capture(event, *args, **kwargs):
        if event == "request.completed":
            events.append(kwargs)
        return original_info(event, *args, **kwargs)

    monkeypatch.setattr(logger, "info", capture)

    response = client.post(
        "/api/v1/recommendations/preview",
        json={
            "area_text": "1 acre",
            "budget_text": "10000",
            "location_text": "3.134088697148061,101.65933330075669",
            "notes": None,
            "soil_type_text": "loamy",
        },
    )

    assert response.status_code == 200
    assert events
    payload = events[-1]
    assert payload["route"] == "/api/v1/recommendations/preview"
    assert payload["normalization_confidence"] is not None
    assert payload["geocoding_confidence"] == 1.0
    assert payload["climate_model_version"] is not None
    assert payload["horizon"] is not None
    assert payload["aggressive_filter_mode"] in {"filtered_non_down", "fallback_all_scored"}
    assert isinstance(payload["aggressive_ranked_crop_ids"], list)
    assert isinstance(payload["aggressive_downtrend_crop_ids"], list)
    assert isinstance(payload["aggressive_non_down_crop_ids"], list)
    assert isinstance(payload["available_crop_ids"], list)
    assert isinstance(payload["missing_seed_crop_ids"], list)
    assert "tomato" in payload["available_crop_ids"]
    assert payload["price_trend_snapshot"]
    assert {"crop_id", "trend", "pct_change", "aggressive_score", "conservative_score"} <= set(
        payload["price_trend_snapshot"][0]
    )
