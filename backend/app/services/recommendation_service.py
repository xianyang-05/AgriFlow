from app.exceptions import AltitudeError, ClimateError, GeocodingError, NormalizationError
from app.logging_config import update_request_logging
from app.repositories.crop_repository import CropRepository
from app.repositories.run_repository import RunRepository
from app.schemas.crop import CropRecord
from app.schemas.decision import ExplanationInput
from app.schemas.input import GeocodeResult, NormalizedFarmInput, RawInput, UserPreferences
from app.schemas.pipeline import PipelineResult
from app.schemas.plan import RecommendationResponse
from app.services.altitude_service import AltitudeService
from app.services.climate_service import ClimateService
from app.services.decision_service import DecisionService
from app.services.explanation_service import ExplanationService
from app.services.geocoding_service import GeocodingService
from app.services.hard_constraint_service import HardConstraintService
from app.services.normalization_service import NormalizationService
from app.services.plan_history_service import PlanHistoryService
from app.services.price_service import PriceService
from app.services.suitability_service import SuitabilityService


class RecommendationService:
    def __init__(
        self,
        normalization_service: NormalizationService | None = None,
        geocoding_service: GeocodingService | None = None,
        altitude_service: AltitudeService | None = None,
        climate_service: ClimateService | None = None,
        suitability_service: SuitabilityService | None = None,
        hard_constraint_service: HardConstraintService | None = None,
        decision_service: DecisionService | None = None,
        explanation_service: ExplanationService | None = None,
        crop_repository: CropRepository | None = None,
        run_repository: RunRepository | None = None,
        plan_history_service: PlanHistoryService | None = None,
    ) -> None:
        self.normalization_service = normalization_service or NormalizationService()
        self.geocoding_service = geocoding_service or GeocodingService()
        self.altitude_service = altitude_service or AltitudeService()
        self.climate_service = climate_service or ClimateService()
        self.suitability_service = suitability_service or SuitabilityService(self.climate_service)
        self.hard_constraint_service = hard_constraint_service or HardConstraintService()
        self.decision_service = decision_service or DecisionService(
            climate_service=self.climate_service,
            price_service=PriceService(),
        )
        self.explanation_service = explanation_service or ExplanationService()
        self.crop_repository = crop_repository or CropRepository()
        self.run_repository = run_repository or RunRepository()
        self.plan_history_service = plan_history_service or PlanHistoryService()

    def create_recommendation(self, db, raw_input: RawInput) -> RecommendationResponse:
        run = self.run_repository.create(db, raw_input)
        response = self._run_pipeline(run.id, db, raw_input=raw_input, user_preferences=UserPreferences())
        return self.plan_history_service.save_version(db, run.id, response, "initial")

    def rerun_recommendation(
        self,
        db,
        run_id: str,
        normalized_input: NormalizedFarmInput,
        user_preferences: UserPreferences,
        *,
        version_note: str = "chat_update",
    ) -> RecommendationResponse:
        response = self._run_pipeline(
            run_id,
            db,
            normalized_input=normalized_input,
            user_preferences=user_preferences,
        )
        return self.plan_history_service.save_version(db, run_id, response, version_note)

    def get_current(self, db, run_id: str) -> RecommendationResponse:
        return self.plan_history_service.get_current(db, run_id)

    def revert(self, db, run_id: str) -> RecommendationResponse:
        return self.plan_history_service.revert(db, run_id)

    def _run_pipeline(
        self,
        run_id: str,
        db,
        *,
        raw_input: RawInput | None = None,
        normalized_input: NormalizedFarmInput | None = None,
        user_preferences: UserPreferences,
    ) -> RecommendationResponse:
        pipeline = PipelineResult(
            normalized_input=normalized_input or NormalizedFarmInput(),
            user_preferences=user_preferences,
        )

        if raw_input is not None:
            try:
                normalized, normalization_warnings = self.normalization_service.normalize(
                    raw_input,
                    prompt_notes=user_preferences.notes or raw_input.notes,
                )
                pipeline.normalized_input = normalized
                pipeline.warnings.extend(normalization_warnings)
            except NormalizationError as exc:
                pipeline.normalized_input = NormalizedFarmInput(
                    clarification_needed=True,
                    clarification_questions=exc.clarification_questions,
                )
                pipeline.warnings.extend(exc.warnings)
                pipeline.status = "incomplete"
                return self._build_response(run_id, pipeline)

        update_request_logging(
            normalization_confidence=pipeline.normalized_input.extraction_confidence
            if pipeline.normalized_input
            else None
        )

        if not pipeline.normalized_input:
            pipeline.status = "incomplete"
            return self._build_response(run_id, pipeline)

        if pipeline.normalized_input.latitude is not None and pipeline.normalized_input.longitude is not None:
            pipeline.geocode_result = GeocodeResult(
                latitude=pipeline.normalized_input.latitude,
                longitude=pipeline.normalized_input.longitude,
                display_name=pipeline.normalized_input.location_text or "Provided coordinates",
                confidence=1.0,
            )
        else:
            try:
                pipeline.geocode_result = self.geocoding_service.geocode(
                    pipeline.normalized_input.location_text or ""
                )
                pipeline.normalized_input.latitude = pipeline.geocode_result.latitude
                pipeline.normalized_input.longitude = pipeline.geocode_result.longitude
                pipeline.normalized_input.clarification_questions = [
                    question
                    for question in pipeline.normalized_input.clarification_questions
                    if "coordinates" not in question.lower()
                ]
                if not pipeline.normalized_input.clarification_questions:
                    pipeline.normalized_input.clarification_needed = False
            except GeocodingError as exc:
                pipeline.status = "incomplete"
                pipeline.normalized_input.clarification_needed = True
                pipeline.normalized_input.clarification_questions = exc.clarification_questions
                pipeline.warnings.extend(exc.warnings)
                return self._build_response(run_id, pipeline)

        try:
            pipeline.altitude_m = self.altitude_service.get_altitude(
                pipeline.normalized_input.latitude or 0.0,
                pipeline.normalized_input.longitude or 0.0,
            )
            pipeline.normalized_input.altitude_m = pipeline.altitude_m
            update_request_logging(altitude_found=True)
        except AltitudeError as exc:
            pipeline.warnings.extend(exc.warnings)
            update_request_logging(altitude_found=False)

        try:
            pipeline.climate_output = self.climate_service.get_output(pipeline.normalized_input)
        except ClimateError as exc:
            pipeline.status = "incomplete"
            pipeline.warnings.extend(exc.warnings)
            return self._build_response(run_id, pipeline)

        crops = [
            CropRecord.model_validate(crop)
            for crop in self.crop_repository.list_crops(db, enabled=True)
        ]
        pipeline.suitability_results = self.suitability_service.evaluate_all(
            crops,
            pipeline.normalized_input,
            pipeline.climate_output,
        )
        pipeline.eligible_crops, pipeline.eliminated_crops = self.hard_constraint_service.apply(
            crops,
            pipeline.suitability_results,
            pipeline.normalized_input,
            pipeline.user_preferences,
        )
        update_request_logging(
            eligible_crop_count=len(pipeline.eligible_crops),
            eliminated_crop_count=len(pipeline.eliminated_crops),
        )

        scoring_crops = pipeline.eligible_crops
        if not scoring_crops:
            pipeline.warnings.append(
                "No crops passed hard constraints. Showing the highest-scoring fallback crops instead."
            )
            scoring_crops = self._fallback_scoring_crops(crops, pipeline.user_preferences)

        decision_output = self.decision_service.decide(
            scoring_crops,
            pipeline.suitability_results,
            pipeline.climate_output,
            pipeline.normalized_input,
            pipeline.user_preferences,
        )
        pipeline.scored_crops = decision_output.ranked_crops
        pipeline.aggressive_plan = decision_output.aggressive_plan
        pipeline.conservative_plan = decision_output.conservative_plan
        pipeline.status = "complete" if pipeline.scored_crops else "no_viable_crops"

        if not pipeline.scored_crops:
            pipeline.explanation = (
                "No crops were available for scoring. Review excluded crops and input values, then try again."
            )
            return self._build_response(run_id, pipeline)

        if pipeline.aggressive_plan and pipeline.conservative_plan and pipeline.climate_output:
            pipeline.explanation = self.explanation_service.explain(
                ExplanationInput(
                    aggressive_top_crop=pipeline.aggressive_plan.top_crop,
                    conservative_top_crop=pipeline.conservative_plan.top_crop,
                    eliminated_crops=pipeline.eliminated_crops,
                    forecast_blocks=pipeline.climate_output.forecast_blocks,
                    warnings=pipeline.warnings,
                    user_preferences=pipeline.user_preferences,
                )
            )
            update_request_logging(
                aggressive_crop=pipeline.aggressive_plan.top_crop.crop_id,
                conservative_crop=pipeline.conservative_plan.top_crop.crop_id,
            )

        return self._build_response(run_id, pipeline)

    def _fallback_scoring_crops(
        self,
        crops: list[CropRecord],
        user_preferences: UserPreferences,
    ) -> list[CropRecord]:
        not_excluded = [
            crop for crop in crops if crop.id not in user_preferences.excluded_crops
        ]
        return not_excluded or crops

    def _build_response(self, run_id: str, pipeline: PipelineResult) -> RecommendationResponse:
        return RecommendationResponse(
            run_id=run_id,
            normalized_input=pipeline.normalized_input,
            user_preferences=pipeline.user_preferences,
            climate_output=pipeline.climate_output,
            eliminated_crops=pipeline.eliminated_crops,
            ranked_crops=pipeline.scored_crops,
            aggressive_plan=pipeline.aggressive_plan,
            conservative_plan=pipeline.conservative_plan,
            explanation=pipeline.explanation,
            warnings=pipeline.warnings,
            status=pipeline.status,
            clarification_needed=bool(
                pipeline.normalized_input and pipeline.normalized_input.clarification_needed
            ),
            clarification_questions=(
                pipeline.normalized_input.clarification_questions if pipeline.normalized_input else []
            ),
            has_previous_version=False,
        )
