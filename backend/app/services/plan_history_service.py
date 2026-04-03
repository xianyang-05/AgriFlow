from app.exceptions import RunNotFoundError
from app.repositories.plan_repository import PlanRepository
from app.schemas.climate import ClimateOutput
from app.schemas.decision import CropPlan, ScoredCrop
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.schemas.plan import RecommendationResponse
from app.schemas.suitability import EliminationReason


class PlanHistoryService:
    def __init__(self, plan_repository: PlanRepository | None = None) -> None:
        self.plan_repository = plan_repository or PlanRepository()

    def save_version(
        self,
        db,
        run_id: str,
        response: RecommendationResponse,
        version_note: str,
    ) -> RecommendationResponse:
        version = self.plan_repository.save(
            db,
            run_id=run_id,
            version_number=self.plan_repository.next_version_number(db, run_id),
            normalized_input=(response.normalized_input or NormalizedFarmInput()).model_dump(),
            user_preferences=response.user_preferences.model_dump(),
            climate_output=response.climate_output.model_dump() if response.climate_output else None,
            eliminated_crops=[item.model_dump() for item in response.eliminated_crops],
            ranked_crops=[item.model_dump() for item in response.ranked_crops],
            aggressive_plan=response.aggressive_plan.model_dump() if response.aggressive_plan else None,
            conservative_plan=response.conservative_plan.model_dump() if response.conservative_plan else None,
            explanation=response.explanation,
            warnings=response.warnings,
            status=response.status,
            version_note=version_note,
        )
        return self._to_response(db, version)

    def get_current(self, db, run_id: str) -> RecommendationResponse:
        version = self.plan_repository.get_current(db, run_id)
        if not version:
            raise RunNotFoundError()
        return self._to_response(db, version)

    def revert(self, db, run_id: str) -> RecommendationResponse:
        current = self.plan_repository.get_current(db, run_id)
        if not current:
            raise RunNotFoundError()

        target = self.plan_repository.get_previous(db, run_id, current.version_number)
        if not target:
            raise RunNotFoundError("No previous recommendation version available")

        reverted = self.plan_repository.save(
            db,
            run_id=run_id,
            version_number=self.plan_repository.next_version_number(db, run_id),
            normalized_input=target.normalized_input,
            user_preferences=target.user_preferences,
            climate_output=target.climate_output,
            eliminated_crops=target.eliminated_crops,
            ranked_crops=target.ranked_crops,
            aggressive_plan=target.aggressive_plan,
            conservative_plan=target.conservative_plan,
            explanation=target.explanation,
            warnings=target.warnings,
            status=target.status,
            version_note=f"reverted_to_v{target.version_number}",
        )
        return self._to_response(db, reverted)

    def _to_response(self, db, version) -> RecommendationResponse:
        return RecommendationResponse(
            run_id=version.run_id,
            version_number=version.version_number,
            normalized_input=NormalizedFarmInput.model_validate(version.normalized_input or {}),
            user_preferences=UserPreferences.model_validate(version.user_preferences or {}),
            climate_output=ClimateOutput.model_validate(version.climate_output) if version.climate_output else None,
            eliminated_crops=[
                EliminationReason.model_validate(item) for item in (version.eliminated_crops or [])
            ],
            ranked_crops=[ScoredCrop.model_validate(item) for item in (version.ranked_crops or [])],
            aggressive_plan=CropPlan.model_validate(version.aggressive_plan) if version.aggressive_plan else None,
            conservative_plan=(
                CropPlan.model_validate(version.conservative_plan)
                if version.conservative_plan
                else None
            ),
            explanation=version.explanation,
            warnings=list(version.warnings or []),
            status=version.status,
            clarification_needed=bool(
                (version.normalized_input or {}).get("clarification_needed", False)
            ),
            clarification_questions=list(
                (version.normalized_input or {}).get("clarification_questions", [])
            ),
            has_previous_version=self.plan_repository.has_previous_version(db, version.run_id),
        )
