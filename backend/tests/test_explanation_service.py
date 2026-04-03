from app.schemas.climate import ForecastBlock
from app.schemas.decision import ExplanationInput, ScoreBreakdown, ScoredCrop
from app.schemas.price import PriceResult
from app.services.explanation_service import ExplanationService


def make_scored_crop(
    crop_id: str,
    crop_name: str,
    *,
    price_score: float,
    climate_score: float,
    price_trend: str,
    pct_change: float,
) -> ScoredCrop:
    return ScoredCrop(
        crop_id=crop_id,
        crop_name=crop_name,
        aggressive_score=0.8,
        conservative_score=0.6,
        reward_score=0.8,
        risk_score=0.4,
        score_breakdown=ScoreBreakdown(
            suitability_score=0.8,
            climate_score=climate_score,
            budget_fit_score=0.7,
            price_score=price_score,
            duration_fit_score=0.6,
        ),
        price_result=PriceResult(
            crop_id=crop_id,
            current_price=10.0,
            predicted_price=11.5 if price_trend == "UP" else 8.5,
            pct_change=pct_change,
            trend=price_trend,
            confidence="HIGH",
            method="xgboost_saved_model",
        ),
        growth_days=90,
    )


def test_explanation_mentions_weighted_price_and_climate_reasons():
    explanation = ExplanationService().explain(
        ExplanationInput(
            aggressive_top_crop=make_scored_crop(
                "chili",
                "Chili",
                price_score=1.0,
                climate_score=0.5,
                price_trend="UP",
                pct_change=15.0,
            ),
            conservative_top_crop=make_scored_crop(
                "kangkung",
                "Kangkung",
                price_score=0.4,
                climate_score=0.95,
                price_trend="STABLE",
                pct_change=0.0,
            ),
            forecast_blocks=[
                ForecastBlock(
                    horizon_months=3,
                    predicted_rain_mm=260.0,
                    rain_p10=200.0,
                    rain_p50=250.0,
                    rain_p90=300.0,
                    dry_risk=0.1,
                    normal_risk=0.2,
                    wet_risk=0.7,
                    top_analog_years=[2011, 2018],
                )
            ],
        )
    )

    assert "price carried the largest 55%" in explanation
    assert "future price is rising" in explanation
    assert "climate carried the largest 40%" in explanation
    assert "forecast leans wet" in explanation
