from app.schemas.chat import ChatRequest, ChatUpdatePayload, IntentClassification, PreviewChatRequest
from app.schemas.input import RawInput


def test_chat_modify_routes_updates_and_reruns(db_session, test_services, monkeypatch):
    initial = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    llm = test_services["llm"]
    llm.intent_response = IntentClassification(
        intent="modification",
        confidence=0.95,
        updates=ChatUpdatePayload(budget_myr=9000.0, harvest_preference="fast"),
    )

    calls = {"count": 0}
    original = test_services["recommendation"].rerun_recommendation

    def spy(*args, **kwargs):
        calls["count"] += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(test_services["recommendation"], "rerun_recommendation", spy)

    response = test_services["chat"].handle(
        db_session,
        ChatRequest(run_id=initial.run_id, message="Set budget to 9000 and make harvest fast"),
    )

    assert calls["count"] == 1
    assert response.intent == "modification"
    assert response.applied_updates.budget_myr == 9000.0
    assert response.updated_recommendation.version_number == 2
    assert response.updated_recommendation.user_preferences.harvest_preference == "fast"


def test_chat_modify_returns_update_summary_from_llm_updates(db_session, test_services):
    initial = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    llm = test_services["llm"]
    llm.intent_response = IntentClassification(
        intent="modification",
        confidence=0.95,
        updates=ChatUpdatePayload(risk_preference="low", excluded_crops=["chili"]),
    )

    response = test_services["chat"].handle(
        db_session,
        ChatRequest(run_id=initial.run_id, message="Prefer lower risk crops and exclude chili"),
    )

    assert response.intent == "modification"
    assert response.applied_updates.risk_preference == "low"
    assert response.applied_updates.excluded_crops == ["chili"]
    assert response.assistant_message.startswith("I updated the plan to")


def test_chat_modify_rechecks_revert_with_llm_for_crop_exclusion(db_session, test_services, monkeypatch):
    initial = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    llm = test_services["llm"]
    llm.intent_response = IntentClassification(intent="revert", confidence=0.95)
    llm.revert_disambiguation_response = IntentClassification(
        intent="modification",
        confidence=0.96,
        updates=ChatUpdatePayload(excluded_crops=["chili"]),
    )

    revert_calls = {"count": 0}
    rerun_calls = {"count": 0}
    original_revert = test_services["recommendation"].revert
    original_rerun = test_services["recommendation"].rerun_recommendation

    def revert_spy(*args, **kwargs):
        revert_calls["count"] += 1
        return original_revert(*args, **kwargs)

    def rerun_spy(*args, **kwargs):
        rerun_calls["count"] += 1
        return original_rerun(*args, **kwargs)

    monkeypatch.setattr(test_services["recommendation"], "revert", revert_spy)
    monkeypatch.setattr(test_services["recommendation"], "rerun_recommendation", rerun_spy)

    response = test_services["chat"].handle(
        db_session,
        ChatRequest(
            run_id=initial.run_id,
            message="I don't want chili. Remove chili from recommended crops.",
        ),
    )

    assert response.intent == "modification"
    assert response.applied_updates.excluded_crops == ["chili"]
    assert revert_calls["count"] == 0
    assert rerun_calls["count"] == 1


def test_chat_modify_blocks_tomato_as_only_preferred_crop(db_session, test_services):
    initial = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    llm = test_services["llm"]
    llm.intent_response = IntentClassification(
        intent="modification",
        confidence=0.95,
        updates=ChatUpdatePayload(preferred_crops=["tomato"]),
    )

    response = test_services["chat"].handle(
        db_session,
        ChatRequest(run_id=initial.run_id, message="I only want tomato"),
    )

    assert response.intent == "modification"
    assert response.applied_updates.preferred_crops == ["tomato"]
    assert response.updated_recommendation is not None
    assert response.updated_recommendation.user_preferences.preferred_crops == ["tomato"]
    assert [crop.crop_id for crop in response.updated_recommendation.ranked_crops] == ["tomato"]
    assert "prioritize tomato" in response.assistant_message.lower()


def test_preview_chat_modify_reruns_without_saving_version(db_session, test_services, monkeypatch):
    preview = test_services["recommendation"].preview_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    llm = test_services["llm"]
    llm.intent_response = IntentClassification(
        intent="modification",
        confidence=0.95,
        updates=ChatUpdatePayload(harvest_preference="fast"),
    )

    calls = {"count": 0}
    original = test_services["recommendation"].rerun_preview

    def spy(*args, **kwargs):
        calls["count"] += 1
        return original(*args, **kwargs)

    monkeypatch.setattr(test_services["recommendation"], "rerun_preview", spy)

    response = test_services["chat"].handle_preview(
        db_session,
        PreviewChatRequest(
            message="Make the harvest faster",
            current_recommendation=preview,
        ),
    )

    assert calls["count"] == 1
    assert response.intent == "modification"
    assert response.run_id is None
    assert response.updated_recommendation is not None
    assert response.updated_recommendation.run_id is None
    assert response.updated_recommendation.version_number is None
    assert response.updated_recommendation.user_preferences.harvest_preference == "fast"
