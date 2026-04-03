from app.schemas.chat import ChatUpdatePayload, IntentClassification


def test_revert_endpoint_and_chat_share_same_function(client, test_services, monkeypatch):
    create_response = client.post(
        "/api/v1/recommendations",
        json={"area_text": "1 acre", "budget_text": "10000", "location_text": "Penang"},
    )
    run_id = create_response.json()["run_id"]

    test_services["llm"].intent_response = IntentClassification(
        intent="modification",
        confidence=0.9,
        updates=ChatUpdatePayload(budget_myr=9000.0),
    )
    client.post("/api/v1/chat", json={"run_id": run_id, "message": "set budget to 9000"})

    calls = {"count": 0}
    original = test_services["recommendation"].revert

    def spy(*args, **kwargs):
        calls["count"] += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(test_services["recommendation"], "revert", spy)

    endpoint_response = client.post(f"/api/v1/recommendations/{run_id}/revert")
    assert endpoint_response.status_code == 200
    assert endpoint_response.json()["version_number"] == 3

    test_services["llm"].intent_response = IntentClassification(intent="revert", confidence=0.9)
    chat_response = client.post("/api/v1/chat", json={"run_id": run_id, "message": "revert"})

    assert chat_response.status_code == 200
    assert chat_response.json()["updated_recommendation"]["version_number"] == 4
    assert calls["count"] == 2


def test_chat_revert_without_previous_version_returns_message_not_404(client, test_services):
    create_response = client.post(
        "/api/v1/recommendations",
        json={"area_text": "1 acre", "budget_text": "10000", "location_text": "Penang"},
    )
    run_id = create_response.json()["run_id"]

    test_services["llm"].intent_response = IntentClassification(intent="revert", confidence=0.95)
    test_services["llm"].revert_disambiguation_response = IntentClassification(
        intent="revert",
        confidence=0.98,
    )

    chat_response = client.post("/api/v1/chat", json={"run_id": run_id, "message": "revert to the previous version"})

    assert chat_response.status_code == 200
    payload = chat_response.json()
    assert payload["intent"] == "revert"
    assert "There isn't a previous saved recommendation version" in payload["assistant_message"]
