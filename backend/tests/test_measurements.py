def test_measurement_round_trip(client):
    response = client.post(
        "/api/v1/measurements",
        json={
            "session_id": "session-123",
            "plant_id": "tomato_1",
            "height_cm": 42,
        },
    )

    assert response.status_code == 200
    assert response.json() == {"success": True, "message": "Measurement saved."}

    first_poll = client.get("/api/v1/measurements/session-123")

    assert first_poll.status_code == 200
    assert first_poll.json() == {
        "success": True,
        "data": {
            "session_id": "session-123",
            "plant_id": "tomato_1",
            "height_cm": 42.0,
            "timestamp": first_poll.json()["data"]["timestamp"],
        },
        "message": None,
    }

    second_poll = client.get("/api/v1/measurements/session-123")

    assert second_poll.status_code == 202
    assert second_poll.json() == {"success": False, "data": None, "message": "Waiting for data..."}
