from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput, UserPreferences
from app.schemas.suitability import EliminationReason, SuitabilityResult


class HardConstraintService:
    def apply(
        self,
        crops: list[CropRecord],
        suitability_results: list[SuitabilityResult],
        normalized_input: NormalizedFarmInput,
        user_preferences: UserPreferences,
    ) -> tuple[list[CropRecord], list[EliminationReason]]:
        suitability_map = {result.crop_id: result for result in suitability_results}
        eligible: list[CropRecord] = []
        eliminated: list[EliminationReason] = []

        for crop in crops:
            suitability = suitability_map[crop.id]
            crop_min_cost = crop.min_budget_per_m2 * (normalized_input.area_m2 or 0.0)

            if not suitability.suitable:
                eliminated.append(EliminationReason(crop_id=crop.id, reason=suitability.reason))
                continue
            if (normalized_input.budget_myr or 0.0) < crop_min_cost:
                eliminated.append(
                    EliminationReason(crop_id=crop.id, reason="budget below minimum viable cost")
                )
                continue
            if crop.id in user_preferences.excluded_crops:
                eliminated.append(EliminationReason(crop_id=crop.id, reason="crop excluded by user"))
                continue
            if user_preferences.harvest_preference == "fast" and crop.growth_days > 60:
                eliminated.append(
                    EliminationReason(crop_id=crop.id, reason="harvest preference requires <= 60 days")
                )
                continue
            eligible.append(crop)

        return eligible, eliminated
