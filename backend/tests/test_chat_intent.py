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


def test_chat_intents_via_keyword_fallback(test_services):
    chat = test_services["chat"]

    assert chat._keyword_fallback("undo that change").intent == "revert"
    assert chat._keyword_fallback("set budget 5000").intent == "modification"
    assert chat._keyword_fallback("why was maize chosen?").intent == "question"
