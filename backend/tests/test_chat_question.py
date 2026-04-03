from app.schemas.chat import ChatRequest, IntentClassification
from app.schemas.input import RawInput


def test_chat_question_does_not_rerun_pipeline_and_passes_history(db_session, test_services, monkeypatch):
    initial = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    chat = test_services["chat"]
    llm = test_services["llm"]
    llm.intent_response = IntentClassification(intent="question", confidence=0.9)

    chat.chat_repository.create(db_session, initial.run_id, "user", "hello", "question")
    chat.chat_repository.create(db_session, initial.run_id, "assistant", "hi", "question")

    def fail_rerun(*args, **kwargs):
        raise AssertionError("pipeline should not rerun for questions")

    monkeypatch.setattr(test_services["recommendation"], "rerun_recommendation", fail_rerun)
    response = chat.handle(db_session, ChatRequest(run_id=initial.run_id, message="Why this crop?"))

    assert response.intent == "question"
    assert response.assistant_message == "Question answered"
    assert len(llm.last_history) >= 2
