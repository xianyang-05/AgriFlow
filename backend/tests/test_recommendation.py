from sqlalchemy import delete

from app.exceptions import GeocodingError
from app.models.crop import Crop
from app.schemas.input import RawInput, UserPreferences
from app.schemas.suitability import SuitabilityResult


def test_recommendation_happy_path(db_session, test_services):
    response = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    assert response.status == "complete"
    assert response.aggressive_plan is not None
    assert response.conservative_plan is not None
    assert response.version_number == 1


def test_recommendation_preview_does_not_create_persisted_run(db_session, test_services):
    response = test_services["recommendation"].preview_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    assert response.status == "complete"
    assert response.run_id is None
    assert response.version_number is None


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


def test_recommendation_low_budget_still_returns_scored_crops(db_session, test_services):
    response = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="100 acre", budget_text="100", location_text="Penang"),
    )

    assert response.status == "complete"
    assert response.aggressive_plan is not None
    assert response.conservative_plan is not None
    assert response.ranked_crops


def test_recommendation_low_suitability_still_returns_scored_crops(db_session, test_services):
    class ForcedUnsuitableService:
        def evaluate_all(self, crops, normalized_input, climate_output):
            return [
                SuitabilityResult(crop_id=crop.id, suitable=False, reason="forced low suitability")
                for crop in crops
            ]

    test_services["recommendation"].suitability_service = ForcedUnsuitableService()

    response = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    assert response.status == "complete"
    assert response.aggressive_plan is not None
    assert response.conservative_plan is not None
    assert response.ranked_crops
    assert not response.eliminated_crops
    assert all(crop.score_breakdown.suitability_score == 0.25 for crop in response.ranked_crops)


def test_recommendation_returns_no_viable_crops_when_user_filters_out_every_crop(db_session, test_services):
    initial = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    response = test_services["recommendation"].rerun_recommendation(
        db_session,
        initial.run_id,
        initial.normalized_input,
        UserPreferences(
            excluded_crops=[
                "tomato",
                "kangkung",
                "spinach",
                "chili",
                "long_bean",
                "okra",
                "cucumber",
                "eggplant",
                "maize",
            ]
        ),
    )

    assert response.status == "no_viable_crops"
    assert response.aggressive_plan is None
    assert response.conservative_plan is None
    assert not response.ranked_crops
    assert len(response.eliminated_crops) > 0
    assert "No crops passed the current hard filters" in response.explanation
    assert "harvest-speed filters" in response.explanation


def test_recommendation_can_score_a_single_user_selected_crop(db_session, test_services):
    initial = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    response = test_services["recommendation"].rerun_recommendation(
        db_session,
        initial.run_id,
        initial.normalized_input,
        UserPreferences(preferred_crops=["tomato"]),
    )

    assert response.status == "complete"
    assert [crop.crop_id for crop in response.ranked_crops] == ["tomato"]
    assert response.aggressive_plan is not None
    assert response.conservative_plan is not None
    assert response.aggressive_plan.top_crop.crop_id == "tomato"
    assert response.conservative_plan.top_crop.crop_id == "tomato"


def test_recommendation_mock_climate_keeps_crops_in_scoring_pool(db_session, test_services):
    response = test_services["recommendation"].preview_recommendation(
        db_session,
        RawInput(
            area_text="1 acre",
            budget_text="20000",
            location_text="Penang",
            soil_type_text="loamy",
        ),
    )

    assert response.status == "complete"
    assert response.aggressive_plan is not None
    assert response.conservative_plan is not None
    assert not response.eliminated_crops


def test_recommendation_restores_missing_seed_tomato_and_filters_aggressive_to_it(db_session, test_services):
    db_session.execute(delete(Crop).where(Crop.id == "tomato"))
    db_session.commit()

    response = test_services["recommendation"].preview_recommendation(
        db_session,
        RawInput(
            area_text="1 acre",
            budget_text="10000",
            location_text="Penang",
            soil_type_text="loamy",
        ),
    )

    available_crop_ids = {
        crop.id for crop in test_services["recommendation"].crop_repository.list_crops(db_session, enabled=True)
    }

    assert "tomato" in available_crop_ids
    assert response.status == "complete"
    assert response.aggressive_plan is not None
    assert response.aggressive_plan.top_crop.crop_id == "tomato"
    assert [crop.crop_id for crop in response.ranked_crops] == ["tomato"]
