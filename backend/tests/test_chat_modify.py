from app.schemas.chat import ChatRequest, ChatUpdatePayload, IntentClassification
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
