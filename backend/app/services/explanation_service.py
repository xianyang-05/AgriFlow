from app.exceptions import LLMError
from app.schemas.decision import ExplanationInput
from app.services.llm_service import LLMService


class ExplanationService:
    def __init__(self, llm_service: LLMService | None = None) -> None:
        self.llm_service = llm_service or LLMService()

    def explain(self, explanation_input: ExplanationInput) -> str:
        try:
            return self.llm_service.generate_explanation(explanation_input)
        except LLMError:
            climate_summary = self._summarize_forecast(explanation_input)
            eliminated_count = len(explanation_input.eliminated_crops)
            return (
                f"{explanation_input.aggressive_top_crop.crop_name} was selected for the aggressive plan for its "
                f"strongest reward profile across harvest speed, fit, and upside. "
                f"Climate outlook: {climate_summary} "
                f"{explanation_input.conservative_top_crop.crop_name} was selected for the conservative plan for its "
                f"lowest overall risk profile. "
                f"{eliminated_count} crops were eliminated before scoring."
            )

    def _summarize_forecast(self, explanation_input: ExplanationInput) -> str:
        if not explanation_input.forecast_blocks:
            return "Climate outlook unavailable."
        first = explanation_input.forecast_blocks[0]
        last = explanation_input.forecast_blocks[-1]
        return (
            f"Rainfall ranges from {first.predicted_rain_mm:.0f}mm to "
            f"{last.predicted_rain_mm:.0f}mm over the forecast horizon."
        )
