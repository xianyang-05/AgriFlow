from app.schemas.climate import ForecastBlock
from app.schemas.decision import ExplanationInput
from app.services.decision_service import DecisionService


class ExplanationService:
    def __init__(self, llm_service=None) -> None:
        self.llm_service = llm_service

    def explain(self, explanation_input: ExplanationInput) -> str:
        aggressive = explanation_input.aggressive_top_crop
        conservative = explanation_input.conservative_top_crop
        aggressive_driver = self._describe_driver(
            aggressive,
            DecisionService.AGGRESSIVE_WEIGHTS,
            explanation_input,
            strategy="aggressive",
        )
        conservative_driver = self._describe_driver(
            conservative,
            DecisionService.CONSERVATIVE_WEIGHTS,
            explanation_input,
            strategy="conservative",
        )
        eliminated_count = len(explanation_input.eliminated_crops)
        climate_summary = self._summarize_forecast(explanation_input)

        return (
            f"Aggressive plan: {aggressive.crop_name} leads because {aggressive_driver}. "
            f"Conservative plan: {conservative.crop_name} leads because {conservative_driver}. "
            f"Climate outlook: {climate_summary} "
            f"{eliminated_count} crops were eliminated before scoring."
        )

    def _summarize_forecast(self, explanation_input: ExplanationInput) -> str:
        if not explanation_input.forecast_blocks:
            return "Climate outlook unavailable."
        first = explanation_input.forecast_blocks[0]
        last = explanation_input.forecast_blocks[-1]
        dominant = self._describe_block(self._pick_relevant_block(explanation_input, growth_days=60))
        return (
            f"Rainfall ranges from {first.predicted_rain_mm:.0f}mm to "
            f"{last.predicted_rain_mm:.0f}mm over the forecast horizon, and {dominant}."
        )

    def _describe_driver(
        self,
        crop,
        weights: dict[str, float],
        explanation_input: ExplanationInput,
        *,
        strategy: str,
    ) -> str:
        contributions = [
            (
                metric,
                getattr(crop.score_breakdown, metric) * weight,
                getattr(crop.score_breakdown, metric),
                weight,
            )
            for metric, weight in weights.items()
        ]
        metric, _, score, weight = max(contributions, key=lambda item: item[1])

        if metric == "price_score":
            price = crop.price_result
            direction = {
                "UP": "future price is rising",
                "DOWN": "future price is falling",
                "STABLE": "future price is stable",
            }[price.trend]
            return (
                f"price carried the largest {weight:.0%} weight, "
                f"the model expects {direction} ({price.pct_change:+.1f}% to RM {price.predicted_price:.2f} from RM {price.current_price:.2f}), "
                f"and that {'supports upside' if strategy == 'aggressive' else 'still adds return without dominating risk'}"
            )

        if metric == "climate_score":
            block = self._pick_relevant_block(explanation_input, crop.growth_days)
            climate_signal = self._describe_block(block) if block else "the climate signal is unavailable"
            return (
                f"climate carried the largest {weight:.0%} weight, "
                f"{climate_signal}, and the climate fit score was {score:.2f}"
            )

        if metric == "suitability_score":
            return (
                f"baseline crop suitability carried {weight:.0%} of the score, "
                f"and the crop achieved a fit score of {score:.2f}"
            )

        if metric == "budget_fit_score":
            return (
                f"budget fit carried {weight:.0%} of the score, "
                f"so financial headroom remained a key factor with a score of {score:.2f}"
            )

        return (
            f"harvest timing contributed {weight:.0%} of the score, "
            f"with a duration-fit score of {score:.2f}"
        )

    def _pick_relevant_block(
        self,
        explanation_input: ExplanationInput,
        growth_days: int,
    ) -> ForecastBlock | None:
        if not explanation_input.forecast_blocks:
            return None
        target_horizon = max(1, round(growth_days / 30))
        return min(
            explanation_input.forecast_blocks,
            key=lambda block: abs(block.horizon_months - target_horizon),
        )

    def _describe_block(self, block: ForecastBlock | None) -> str:
        if block is None:
            return "the forecast signal is unavailable"

        wet = block.wet_risk
        dry = block.dry_risk
        normal = block.normal_risk
        if wet >= dry and wet >= normal:
            return (
                f"the forecast leans wet ({wet:.0%} wet risk, {block.predicted_rain_mm:.0f}mm rain), "
                f"which raises flood pressure for sensitive crops"
            )
        if dry >= wet and dry >= normal:
            return (
                f"the forecast leans dry ({dry:.0%} dry risk, {block.predicted_rain_mm:.0f}mm rain), "
                f"which penalizes drought-sensitive crops"
            )
        return (
            f"the forecast stays near normal ({normal:.0%} normal risk, {block.predicted_rain_mm:.0f}mm rain), "
            f"which is a steadier climate signal"
        )
