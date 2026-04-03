from app.exceptions import GeocodingError
from app.schemas.input import RawInput


def test_recommendation_happy_path(db_session, test_services):
    response = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    assert response.status == "complete"
    assert response.aggressive_plan is not None
    assert response.conservative_plan is not None
    assert response.version_number == 1


def test_recommendation_handles_geocoding_failure(db_session, test_services):
    class FailingGeocoder:
        def geocode(self, location_text):
            raise GeocodingError()

    test_services["recommendation"].geocoding_service = FailingGeocoder()
    response = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Unknown"),
    )

    assert response.status == "incomplete"
    assert response.clarification_needed is True
    assert response.aggressive_plan is None


def test_recommendation_returns_fallback_rankings_when_no_viable_crops(db_session, test_services):
    response = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="100 acre", budget_text="100", location_text="Penang"),
    )

    assert response.status == "complete"
    assert response.aggressive_plan is not None
    assert response.conservative_plan is not None
    assert response.ranked_crops
    assert len(response.eliminated_crops) > 0
    assert any("fallback" in warning.lower() for warning in response.warnings)
