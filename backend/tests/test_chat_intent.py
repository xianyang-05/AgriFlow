from app.exceptions import LLMError
from app.schemas.chat import ChatRequest, ChatUpdatePayload, IntentClassification
from app.schemas.input import RawInput


def test_chat_intents_via_llm(db_session, test_services):
    recommendation = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    llm = test_services["llm"]
    chat = test_services["chat"]

    llm.intent_response = IntentClassification(intent="question", confidence=0.9)
    assert chat.handle(db_session, ChatRequest(run_id=recommendation.run_id, message="Why?")).intent == "question"

    llm.intent_response = IntentClassification(
        intent="modification",
        confidence=0.9,
        updates=ChatUpdatePayload(budget_myr=9000.0),
    )
    assert (
        chat.handle(db_session, ChatRequest(run_id=recommendation.run_id, message="Set budget to 9000")).intent
        == "modification"
    )

    llm.intent_response = IntentClassification(intent="revert", confidence=0.9)
    assert chat.handle(db_session, ChatRequest(run_id=recommendation.run_id, message="revert")).intent == "revert"


def test_chat_returns_clarification_when_llm_confidence_is_low(db_session, test_services):
    recommendation = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )
    llm = test_services["llm"]
    llm.intent_response = IntentClassification(intent="modification", confidence=0.2)

    response = test_services["chat"].handle(
        db_session,
        ChatRequest(run_id=recommendation.run_id, message="Make it lower risk"),
    )

    assert response.intent == "question"
    assert response.confidence == 0.0
    assert "couldn't confidently interpret" in response.assistant_message


def test_chat_returns_model_unavailable_message_when_llm_fails(db_session, test_services, monkeypatch):
    recommendation = test_services["recommendation"].create_recommendation(
        db_session,
        RawInput(area_text="1 acre", budget_text="10000", location_text="Penang"),
    )

    def fail_classification(*args, **kwargs):
        raise LLMError("Ollama request failed")

    monkeypatch.setattr(test_services["llm"], "classify_intent", fail_classification)

    response = test_services["chat"].handle(
        db_session,
        ChatRequest(run_id=recommendation.run_id, message="Remove chili from the recommendations"),
    )

    assert response.intent == "question"
    assert response.confidence == 0.0
    assert "plan assistant model is unavailable" in response.assistant_message
