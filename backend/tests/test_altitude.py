from app.schemas.input import RawInput


def test_altitude_service_success(test_services, climate_output):
    service = test_services["recommendation"].altitude_service
    altitude = service.get_altitude(5.9, 100.4)

    assert altitude == 12.0


def test_altitude_failure_returns_warning(db_session, test_services):
    recommendation = test_services["recommendation"]
    recommendation.altitude_service.should_fail = True

    response = recommendation.create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    assert response.status == "complete"
    assert "Altitude unavailable" in response.warnings[0]
