from app.exceptions import LLMError
from app.logging_config import update_request_logging
from app.repositories.chat_repository import ChatRepository
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatUpdatePayload,
    IntentClassification,
    PreviewChatRequest,
)
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
        except LLMError:
            return self._handle_unclassified(
                db,
                request,
                current,
                message=(
                    "I couldn't analyze that request because the plan assistant model is unavailable right now. "
                    "Please check the Ollama service and configured model, then try again."
                ),
            )

        if classification.confidence < 0.5:
            return self._handle_unclassified(
                db,
                request,
                current,
                message=(
                    "I couldn't confidently interpret that request. Please rephrase it as a question, "
                    "a plan change, or a revert request."
                ),
            )

        if classification.intent == "revert":
            try:
                classification = self.llm_service.disambiguate_revert_intent(
                    request.message,
                    history_payload,
                    context,
                )
            except LLMError:
                return self._handle_unclassified(
                    db,
                    request,
                    current,
                    message=(
                        "I couldn't confirm whether you wanted to revert a previous version or modify the current plan "
                        "because the plan assistant model is unavailable right now. Please try again after checking Ollama."
                    ),
                )

            if classification.confidence < 0.5:
                return self._handle_unclassified(
                    db,
                    request,
                    current,
                    message=(
                        "I couldn't confidently tell whether you wanted to revert the previous version or modify the current plan. "
                        "Please say either 'revert to the previous version' or describe the change you want."
                    ),
                )

        update_request_logging(chat_intent=classification.intent)

        if classification.intent == "question":
            return self._handle_question(db, request, current, history_payload, classification)
        if classification.intent == "revert":
            return self._handle_revert(db, request, classification)
        return self._handle_modification(db, request, current, classification)

    def handle_preview(self, db, request: PreviewChatRequest) -> ChatResponse:
        current = request.current_recommendation
        history_payload: list[dict[str, str]] = []
        context = current.model_dump()

        try:
            classification = self.llm_service.classify_intent(request.message, history_payload, context)
        except LLMError:
            return self._preview_unclassified(
                request,
                current,
                message=(
                    "I couldn't analyze that request because the plan assistant model is unavailable right now. "
                    "Please check the Ollama service and configured model, then try again."
                ),
            )

        if classification.confidence < 0.5:
            return self._preview_unclassified(
                request,
                current,
                message=(
                    "I couldn't confidently interpret that request. Please rephrase it as a question, "
                    "a plan change, or a revert request."
                ),
            )

        if classification.intent == "revert":
            try:
                classification = self.llm_service.disambiguate_revert_intent(
                    request.message,
                    history_payload,
                    context,
                )
            except LLMError:
                return self._preview_unclassified(
                    request,
                    current,
                    message=(
                        "I couldn't confirm whether you wanted to revert a previous version or modify the current plan "
                        "because the plan assistant model is unavailable right now. Please try again after checking Ollama."
                    ),
                )

            if classification.confidence < 0.5:
                return self._preview_unclassified(
                    request,
                    current,
                    message=(
                        "I couldn't confidently tell whether you wanted to revert the previous version or modify the current plan. "
                        "Please say either 'revert to the previous version' or describe the change you want."
                    ),
                )

        update_request_logging(chat_intent=classification.intent)

        if classification.intent == "question":
            return self._handle_preview_question(request, current, history_payload, classification)
        if classification.intent == "revert":
            return self._handle_preview_revert(request, current, classification)
        return self._handle_preview_modification(db, request, current, classification)

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

    def _handle_unclassified(self, db, request: ChatRequest, current, *, message: str) -> ChatResponse:
        self._save_message_pair(db, request.run_id, request.message, message, "question")
        update_request_logging(chat_intent="question")
        return ChatResponse(
            run_id=request.run_id,
            intent="question",
            confidence=0.0,
            assistant_message=message,
            has_previous_version=current.has_previous_version,
            status=current.status,
            clarification_needed=current.clarification_needed,
            clarification_questions=current.clarification_questions,
            warnings=current.warnings,
        )

    def _preview_unclassified(self, request: PreviewChatRequest, current, *, message: str) -> ChatResponse:
        update_request_logging(chat_intent="question")
        return ChatResponse(
            run_id=None,
            intent="question",
            confidence=0.0,
            assistant_message=message,
            updated_recommendation=current,
            has_previous_version=False,
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
        assistant_message = self._build_modification_message(
            classification.updates,
            updated_recommendation,
        )
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
        current = self.plan_history_service.get_current(db, request.run_id)
        if not current.has_previous_version:
            assistant_message = (
                "There isn't a previous saved recommendation version to revert to yet. "
                "If you want to change the current plan, tell me what you want adjusted."
            )
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

    def _handle_preview_question(
        self,
        request: PreviewChatRequest,
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

        return ChatResponse(
            run_id=None,
            intent=classification.intent,
            confidence=classification.confidence,
            assistant_message=assistant_message,
            updated_recommendation=current,
            has_previous_version=False,
            status=current.status,
            clarification_needed=current.clarification_needed,
            clarification_questions=current.clarification_questions,
            warnings=current.warnings,
        )

    def _handle_preview_modification(
        self,
        db,
        request: PreviewChatRequest,
        current,
        classification: IntentClassification,
    ) -> ChatResponse:
        updated_normalized = self._apply_normalized_updates(
            current.normalized_input or NormalizedFarmInput(),
            classification.updates,
        )
        updated_preferences = self._apply_preference_updates(
            current.user_preferences,
            classification.updates,
        )
        updated_recommendation = self.recommendation_service.rerun_preview(
            db,
            updated_normalized,
            updated_preferences,
        )
        assistant_message = self._build_modification_message(
            classification.updates,
            updated_recommendation,
        )
        return ChatResponse(
            run_id=None,
            intent=classification.intent,
            confidence=classification.confidence,
            applied_updates=classification.updates,
            updated_recommendation=updated_recommendation,
            assistant_message=assistant_message,
            has_previous_version=False,
            status=updated_recommendation.status,
            clarification_needed=updated_recommendation.clarification_needed,
            clarification_questions=updated_recommendation.clarification_questions,
            warnings=updated_recommendation.warnings,
        )

    def _handle_preview_revert(
        self,
        request: PreviewChatRequest,
        current,
        classification: IntentClassification,
    ) -> ChatResponse:
        assistant_message = (
            "Preview chat can answer questions and tune the draft plan, but revert is only available after you save the plan."
        )
        return ChatResponse(
            run_id=None,
            intent=classification.intent,
            confidence=classification.confidence,
            assistant_message=assistant_message,
            updated_recommendation=current,
            has_previous_version=False,
            status=current.status,
            clarification_needed=current.clarification_needed,
            clarification_questions=current.clarification_questions,
            warnings=current.warnings,
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

    def _build_modification_message(
        self,
        updates: ChatUpdatePayload,
        updated_recommendation,
    ) -> str:
        change_summary: list[str] = []

        if updates.budget_myr is not None:
            change_summary.append(f"budget to MYR {updates.budget_myr:,.0f}")
        if updates.area_m2 is not None:
            change_summary.append(f"area to {updates.area_m2:,.0f} m2")
        if updates.target_month is not None:
            change_summary.append(f"planting month to {updates.target_month}")
        if updates.forecast_horizon_months is not None:
            change_summary.append(f"forecast horizon to {updates.forecast_horizon_months} months")
        if updates.soil_type is not None:
            change_summary.append(f"soil type to {updates.soil_type}")
        if updates.harvest_preference == "fast":
            change_summary.append("favor faster harvest crops")
        if updates.risk_preference == "low":
            change_summary.append("favor safer, lower-risk crops")
        elif updates.risk_preference == "high":
            change_summary.append("favor higher-upside crops")
        if updates.excluded_crops:
            change_summary.append(f"exclude {', '.join(updates.excluded_crops)}")
        if updates.preferred_crops:
            change_summary.append(f"prioritize {', '.join(updates.preferred_crops)}")

        intro = "I updated the plan."
        if change_summary:
            intro = f"I updated the plan to {', '.join(change_summary)}."

        if updated_recommendation.status != "complete":
            return intro

        aggressive_crop = updated_recommendation.aggressive_plan.top_crop.crop_name if updated_recommendation.aggressive_plan else None
        conservative_crop = updated_recommendation.conservative_plan.top_crop.crop_name if updated_recommendation.conservative_plan else None

        if aggressive_crop and conservative_crop and aggressive_crop != conservative_crop:
            return (
                f"{intro} The higher-upside option is now {aggressive_crop}, and the safer option is {conservative_crop}."
            )
        if aggressive_crop:
            return f"{intro} The top recommendation is now {aggressive_crop}."
        if conservative_crop:
            return f"{intro} The safer recommendation is now {conservative_crop}."
        return intro
