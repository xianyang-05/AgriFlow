import re

from app.exceptions import LLMError
from app.logging_config import update_request_logging
from app.repositories.chat_repository import ChatRepository
from app.schemas.chat import ChatRequest, ChatResponse, ChatUpdatePayload, IntentClassification
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.services.llm_service import LLMService
from app.services.plan_history_service import PlanHistoryService
from app.services.recommendation_service import RecommendationService


class ChatService:
    def __init__(
        self,
        llm_service: LLMService | None = None,
        chat_repository: ChatRepository | None = None,
        recommendation_service: RecommendationService | None = None,
        plan_history_service: PlanHistoryService | None = None,
    ) -> None:
        self.llm_service = llm_service or LLMService()
        self.chat_repository = chat_repository or ChatRepository()
        self.recommendation_service = recommendation_service or RecommendationService()
        self.plan_history_service = plan_history_service or PlanHistoryService()

    def handle(self, db, request: ChatRequest) -> ChatResponse:
        current = self.plan_history_service.get_current(db, request.run_id)
        history = self.chat_repository.list_recent(db, request.run_id, limit=10)
        history_payload = [{"role": item.role, "message": item.message} for item in history]
        context = current.model_dump()

        try:
            classification = self.llm_service.classify_intent(request.message, history_payload, context)
            if classification.confidence < 0.5:
                raise LLMError("Low-confidence chat intent")
        except LLMError:
            classification = self._keyword_fallback(request.message)

        update_request_logging(chat_intent=classification.intent)

        if classification.intent == "question":
            return self._handle_question(db, request, current, history_payload, classification)
        if classification.intent == "revert":
            return self._handle_revert(db, request, classification)
        return self._handle_modification(db, request, current, classification)

    def _handle_question(
        self,
        db,
        request: ChatRequest,
        current,
        history_payload: list[dict[str, str]],
        classification: IntentClassification,
    ) -> ChatResponse:
        try:
            assistant_message = self.llm_service.answer_question(
                request.message,
                history_payload,
                current.model_dump(),
            )
        except LLMError:
            assistant_message = current.explanation or "I can answer questions about the current recommendation."

        self._save_message_pair(db, request.run_id, request.message, assistant_message, classification.intent)
        return ChatResponse(
            run_id=request.run_id,
            intent=classification.intent,
            confidence=classification.confidence,
            assistant_message=assistant_message,
            has_previous_version=current.has_previous_version,
            status=current.status,
            clarification_needed=current.clarification_needed,
            clarification_questions=current.clarification_questions,
            warnings=current.warnings,
        )

    def _handle_modification(self, db, request: ChatRequest, current, classification: IntentClassification) -> ChatResponse:
        updated_normalized = self._apply_normalized_updates(
            current.normalized_input or NormalizedFarmInput(),
            classification.updates,
        )
        updated_preferences = self._apply_preference_updates(
            current.user_preferences,
            classification.updates,
        )
        updated_recommendation = self.recommendation_service.rerun_recommendation(
            db,
            request.run_id,
            updated_normalized,
            updated_preferences,
        )
        assistant_message = updated_recommendation.explanation or "Recommendation updated."
        self._save_message_pair(db, request.run_id, request.message, assistant_message, classification.intent)
        return ChatResponse(
            run_id=request.run_id,
            intent=classification.intent,
            confidence=classification.confidence,
            applied_updates=classification.updates,
            updated_recommendation=updated_recommendation,
            assistant_message=assistant_message,
            has_previous_version=updated_recommendation.has_previous_version,
            status=updated_recommendation.status,
            clarification_needed=updated_recommendation.clarification_needed,
            clarification_questions=updated_recommendation.clarification_questions,
            warnings=updated_recommendation.warnings,
        )

    def _handle_revert(self, db, request: ChatRequest, classification: IntentClassification) -> ChatResponse:
        reverted = self.recommendation_service.revert(db, request.run_id)
        assistant_message = f"Reverted to the previous recommendation snapshot."
        self._save_message_pair(db, request.run_id, request.message, assistant_message, classification.intent)
        return ChatResponse(
            run_id=request.run_id,
            intent=classification.intent,
            confidence=classification.confidence,
            assistant_message=assistant_message,
            updated_recommendation=reverted,
            has_previous_version=reverted.has_previous_version,
            status=reverted.status,
            clarification_needed=reverted.clarification_needed,
            clarification_questions=reverted.clarification_questions,
            warnings=reverted.warnings,
        )

    def _apply_normalized_updates(
        self,
        normalized_input: NormalizedFarmInput,
        updates: ChatUpdatePayload,
    ) -> NormalizedFarmInput:
        payload = normalized_input.model_dump()
        for field in ("budget_myr", "area_m2", "target_month", "forecast_horizon_months", "soil_type"):
            value = getattr(updates, field)
            if value is not None:
                payload[field] = value
        return NormalizedFarmInput.model_validate(payload)

    def _apply_preference_updates(
        self,
        user_preferences: UserPreferences,
        updates: ChatUpdatePayload,
    ) -> UserPreferences:
        payload = user_preferences.model_dump()
        for field in (
            "preferred_crops",
            "excluded_crops",
            "risk_preference",
            "harvest_preference",
            "notes",
        ):
            value = getattr(updates, field)
            if value is not None:
                payload[field] = value
        return UserPreferences.model_validate(payload)

    def _save_message_pair(self, db, run_id: str, user_message: str, assistant_message: str, intent: str) -> None:
        self.chat_repository.create(db, run_id, "user", user_message, intent)
        self.chat_repository.create(db, run_id, "assistant", assistant_message, intent)

    def _keyword_fallback(self, message: str) -> IntentClassification:
        lowered = message.lower()
        updates = self._extract_updates_from_text(lowered)
        if any(keyword in lowered for keyword in ("revert", "go back", "undo")):
            intent = "revert"
        elif updates.model_dump(exclude_none=True):
            intent = "modification"
        else:
            intent = "question"
        return IntentClassification(intent=intent, confidence=0.4, updates=updates)

    def _extract_updates_from_text(self, message: str) -> ChatUpdatePayload:
        payload: dict[str, object] = {}

        budget_match = re.search(r"budget(?: to| is)?\s+(\d+(?:\.\d+)?)", message)
        area_match = re.search(r"area(?: to| is)?\s+(\d+(?:\.\d+)?)", message)
        month_match = re.search(r"month(?: to| is)?\s+(\d{1,2})", message)
        horizon_match = re.search(r"horizon(?: to| is)?\s+(\d+)", message)
        exclude_match = re.findall(r"exclude\s+([a-z_ ]+)", message)
        prefer_match = re.findall(r"prefer\s+([a-z_ ]+)", message)

        if budget_match:
            payload["budget_myr"] = float(budget_match.group(1))
        if area_match:
            payload["area_m2"] = float(area_match.group(1))
        if month_match:
            payload["target_month"] = int(month_match.group(1))
        if horizon_match:
            payload["forecast_horizon_months"] = int(horizon_match.group(1))

        for soil_type in ("loamy", "clay", "sandy", "silt", "peat", "chalky"):
            if soil_type in message:
                payload["soil_type"] = soil_type
                break

        if "fast" in message:
            payload["harvest_preference"] = "fast"
        if exclude_match:
            payload["excluded_crops"] = [item.strip().replace(" ", "_") for item in exclude_match]
        if prefer_match:
            payload["preferred_crops"] = [item.strip().replace(" ", "_") for item in prefer_match]
        if "note" in message:
            payload["notes"] = message

        return ChatUpdatePayload(**payload)
