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
        eligible: list[CropRecord] = []
        eliminated: list[EliminationReason] = []
        preferred_crop_ids = set(user_preferences.preferred_crops)

        for crop in crops:
            if preferred_crop_ids and crop.id not in preferred_crop_ids:
                eliminated.append(
                    EliminationReason(crop_id=crop.id, reason="crop not included in the user's selected crop list")
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
