def test_crops_returns_plain_list(client):
    response = client.get("/api/v1/crops")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert "status" not in payload[0]


def test_health_returns_component_statuses(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["api"] == "healthy"
    assert payload["database"] == "healthy"
    assert "llm" in payload


def test_health_reports_database_disabled_in_local_mode(client, monkeypatch):
    monkeypatch.setattr("app.routes.health.settings.persistence_mode", "local")

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["database"] == "disabled"


def test_saved_recommendation_routes_are_unsupported_in_local_mode(client, monkeypatch):
    monkeypatch.setattr("app.routes.recommendations.settings.persistence_mode", "local")

    response = client.post(
        "/api/v1/recommendations",
        json={
            "area_text": "1 acre",
            "budget_text": "10000",
            "location_text": "Penang",
            "notes": None,
            "soil_type_text": None,
        },
    )

    assert response.status_code == 503
    assert "local persistence mode" in response.json()["detail"].lower()


def test_saved_chat_route_is_unsupported_in_local_mode(client, monkeypatch):
    monkeypatch.setattr("app.routes.chat.settings.persistence_mode", "local")

    response = client.post(
        "/api/v1/chat",
        json={
            "run_id": "local-only",
            "message": "Why this crop?",
        },
    )

    assert response.status_code == 503
    assert "local persistence mode" in response.json()["detail"].lower()
