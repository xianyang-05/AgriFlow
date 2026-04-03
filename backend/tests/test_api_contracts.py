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
