from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput
from app.schemas.price import PriceResult
from app.services.price_service import PriceService, STATIC_BASELINE


def make_crop(crop_id: str, name: str) -> CropRecord:
    return CropRecord(
        id=crop_id,
        name=name,
        growth_days=60,
        min_rainfall_mm=100.0,
        max_rainfall_mm=250.0,
        min_temp_c=20.0,
        max_temp_c=32.0,
        planting_months=[4],
        min_budget_per_m2=1.0,
        drought_sensitive=False,
        flood_sensitive=False,
        enabled=True,
    )


def test_price_service_uses_saved_model_for_supported_crop():
    service = PriceService()

    result = service.get_price(
        make_crop("spinach", "Spinach"),
        NormalizedFarmInput(location_text="Shah Alam, Selangor"),
    )

    assert result.method in {"xgboost_saved_model", "baseline_fallback"}
    assert result.current_price > 0
    assert result.predicted_price > 0
    assert result.trend in {"UP", "DOWN", "STABLE"}
    if result.current_price > 0:
        assert result.pct_change == round(
            ((result.predicted_price - result.current_price) / result.current_price) * 100.0,
            2,
        )
    if result.method == "xgboost_saved_model":
        assert result.confidence in {"HIGH", "MEDIUM"}
        assert result.predicted_price != STATIC_BASELINE["spinach"]
    else:
        assert result.confidence == "LOW"
        assert result.current_price == STATIC_BASELINE["spinach"]


def test_price_service_supports_tomato_model_mapping():
    service = PriceService()

    result = service.get_price(
        make_crop("tomato", "Tomato"),
        NormalizedFarmInput(location_text="Shah Alam, Selangor"),
    )

    assert result.method in {"xgboost_saved_model", "baseline_fallback"}
    assert result.current_price > 0
    assert result.predicted_price > 0
    assert result.trend == "UP"
    assert result.pct_change > 0
    if result.method == "xgboost_saved_model":
        assert result.predicted_price != STATIC_BASELINE["tomato"]


def test_price_service_falls_back_for_unsupported_crop():
    service = PriceService()

    result = service.get_price(make_crop("maize", "Maize"))

    assert result.method == "baseline_fallback"
    assert result.confidence == "LOW"
    assert result.current_price == STATIC_BASELINE["maize"]
    assert result.pct_change < 0.0
    assert result.trend == "DOWN"
    assert result.predicted_price < STATIC_BASELINE["maize"]


def test_forced_price_trend_policy_keeps_tomato_up_and_other_crops_down():
    service = PriceService(
        model_path="missing-model.pkl",
        feature_data_path="missing-features.csv",
    )

    tomato = service.get_price(make_crop("tomato", "Tomato"))
    spinach = service.get_price(make_crop("spinach", "Spinach"))

    assert tomato.trend == "UP"
    assert tomato.pct_change > 0
    assert spinach.trend == "DOWN"
    assert spinach.pct_change < 0


def test_price_score_blends_predicted_price_and_trend():
    class TrendAwarePriceService(PriceService):
        def __init__(self):
            super().__init__()

        def get_price(self, crop, normalized_input=None):
            table = {
                "spinach": PriceResult(
                    crop_id="spinach",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=12.0,
                    trend="UP",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "kangkung": PriceResult(
                    crop_id="kangkung",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=-12.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

    service = TrendAwarePriceService()
    scores = service.build_rank_scores(
        [
            make_crop("spinach", "Spinach"),
            make_crop("kangkung", "Kangkung"),
        ]
    )

    assert scores["spinach"] > scores["kangkung"]
    assert scores["kangkung"] < scores["spinach"]


def test_price_trend_score_scales_with_percentage_change():
    class PercentageAwarePriceService(PriceService):
        def __init__(self):
            super().__init__()

        def get_price(self, crop, normalized_input=None):
            table = {
                "spinach": PriceResult(
                    crop_id="spinach",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=18.0,
                    trend="UP",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "kangkung": PriceResult(
                    crop_id="kangkung",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=4.0,
                    trend="UP",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

    service = PercentageAwarePriceService()
    scores = service.build_rank_scores(
        [
            make_crop("spinach", "Spinach"),
            make_crop("kangkung", "Kangkung"),
        ]
    )

    assert scores["spinach"] > scores["kangkung"]


def test_stable_trend_scores_between_uptrend_and_downtrend():
    class StableAwarePriceService(PriceService):
        def __init__(self):
            super().__init__()

        def get_price(self, crop, normalized_input=None):
            table = {
                "spinach": PriceResult(
                    crop_id="spinach",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=12.0,
                    trend="UP",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "kangkung": PriceResult(
                    crop_id="kangkung",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=0.0,
                    trend="STABLE",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "tomato": PriceResult(
                    crop_id="tomato",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=-12.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

    service = StableAwarePriceService()
    scores = service.build_rank_scores(
        [
            make_crop("spinach", "Spinach"),
            make_crop("kangkung", "Kangkung"),
            make_crop("tomato", "Tomato"),
        ]
    )

    assert scores["spinach"] > scores["kangkung"] > scores["tomato"]


def test_downtrend_price_is_penalized_even_when_absolute_price_is_higher():
    class TrendPenaltyPriceService(PriceService):
        def __init__(self):
            super().__init__()

        def get_price(self, crop, normalized_input=None):
            table = {
                "chili": PriceResult(
                    crop_id="chili",
                    current_price=20.0,
                    predicted_price=15.0,
                    pct_change=-25.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "spinach": PriceResult(
                    crop_id="spinach",
                    current_price=5.0,
                    predicted_price=5.5,
                    pct_change=10.0,
                    trend="UP",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

    service = TrendPenaltyPriceService()
    scores = service.build_rank_scores(
        [
            make_crop("chili", "Chili"),
            make_crop("spinach", "Spinach"),
        ]
    )

    assert scores["spinach"] > scores["chili"]


def test_single_crop_price_score_is_not_forced_to_perfect_when_trend_is_down():
    class SingleCropTrendPriceService(PriceService):
        def __init__(self):
            super().__init__()

        def get_price(self, crop, normalized_input=None):
            return PriceResult(
                crop_id=crop.id,
                current_price=5.0,
                predicted_price=4.15,
                pct_change=-17.0,
                trend="DOWN",
                confidence="HIGH",
                method="xgboost_saved_model",
            )

    service = SingleCropTrendPriceService()
    scores = service.build_rank_scores([make_crop("kangkung", "Kangkung")])

    assert scores["kangkung"] < 0.5


def test_low_price_scores_are_penalized_more_sharply_than_linear_blend():
    class ShapedPriceService(PriceService):
        def __init__(self):
            super().__init__()

        def get_price(self, crop, normalized_input=None):
            table = {
                "spinach": PriceResult(
                    crop_id="spinach",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=-5.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "kangkung": PriceResult(
                    crop_id="kangkung",
                    current_price=10.0,
                    predicted_price=10.0,
                    pct_change=-15.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

    service = ShapedPriceService()
    scores = service.build_rank_scores(
        [
            make_crop("spinach", "Spinach"),
            make_crop("kangkung", "Kangkung"),
        ]
    )

    raw_spinach = (0.35 * 1.0) + (0.65 * 0.4)
    raw_kangkung = (0.35 * 1.0) + (0.65 * 0.2)

    assert scores["spinach"] < 0.4
    assert scores["spinach"] < raw_spinach
    assert scores["kangkung"] < raw_kangkung
    assert scores["kangkung"] < 0.25


def test_tomato_uptrend_beats_higher_absolute_price_when_other_crop_trends_down():
    class TomatoFavoredPriceService(PriceService):
        def __init__(self):
            super().__init__()

        def get_price(self, crop, normalized_input=None):
            table = {
                "tomato": PriceResult(
                    crop_id="tomato",
                    current_price=6.0,
                    predicted_price=7.08,
                    pct_change=18.0,
                    trend="UP",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
                "chili": PriceResult(
                    crop_id="chili",
                    current_price=12.0,
                    predicted_price=9.84,
                    pct_change=-18.0,
                    trend="DOWN",
                    confidence="HIGH",
                    method="xgboost_saved_model",
                ),
            }
            return table[crop.id]

    service = TomatoFavoredPriceService()
    scores = service.build_rank_scores(
        [
            make_crop("tomato", "Tomato"),
            make_crop("chili", "Chili"),
        ]
    )

    assert scores["tomato"] > scores["chili"]
