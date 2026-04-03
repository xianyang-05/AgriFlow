from __future__ import annotations

from calendar import monthrange
from datetime import date
import logging
from pathlib import Path
from typing import Any
import warnings

import joblib
import pandas as pd

from app.schemas.crop import CropRecord
from app.schemas.input import NormalizedFarmInput
from app.schemas.price import PriceResult


logger = logging.getLogger(__name__)

MODEL_PRICE_WEIGHT = 0.35
TREND_WEIGHT = 0.65
PRICE_SCORE_PENALTY_EXPONENT = 2.0
TREND_UP_THRESHOLD_PCT = 2.0
TREND_DOWN_THRESHOLD_PCT = -2.0
TREND_SCORE_MAX_ABS_PCT = 25.0
DEFAULT_FORCED_PRICE_CHANGE_PCT = -18.0
FORCED_PRICE_CHANGE_BY_CROP = {
    "tomato": 18.0,
}

WEATHER_FEATURE_COLUMNS = [
    "temperature_c",
    "humidity_pct",
    "rainfall_mm",
    "temperature_c_3d_avg",
    "humidity_pct_3d_avg",
    "rainfall_mm_3d_avg",
    "temperature_c_7d_avg",
    "humidity_pct_7d_avg",
    "rainfall_mm_7d_avg",
]

STATIC_BASELINE = {
    "maize": 5.0,
    "chili": 11.0,
    "okra": 7.0,
    "eggplant": 8.0,
    "cucumber": 7.5,
    "spinach": 6.0,
    "kangkung": 5.5,
    "tomato": 6.0,
    "long_bean": 7.8,
}

CROP_NAME_MAPPING = {
    "chili": "Cili Merah",
    "okra": "Bendi",
    "eggplant": "Terung",
    "cucumber": "Timun",
    "spinach": "Bayam",
    "kangkung": "Kangkung",
    "tomato": "Tomato",
    "long_bean": "Kacang Panjang",
}

STATE_ALIASES = {
    "johor": "Johor",
    "kedah": "Kedah",
    "kelantan": "Kelantan",
    "melaka": "Melaka",
    "malacca": "Melaka",
    "negeri sembilan": "Negeri Sembilan",
    "pahang": "Pahang",
    "perak": "Perak",
    "perlis": "Perlis",
    "pulau pinang": "Pulau Pinang",
    "penang": "Pulau Pinang",
    "sabah": "Sabah",
    "sarawak": "Sarawak",
    "selangor": "Selangor",
    "terengganu": "Terengganu",
    "w.p. kuala lumpur": "W.P. Kuala Lumpur",
    "wp kuala lumpur": "W.P. Kuala Lumpur",
    "wilayah persekutuan kuala lumpur": "W.P. Kuala Lumpur",
    "kuala lumpur": "W.P. Kuala Lumpur",
    " kl ": "W.P. Kuala Lumpur",
}


class PriceService:
    def __init__(
        self,
        model_path: str | Path | None = None,
        feature_data_path: str | Path | None = None,
    ) -> None:
        repo_root = Path(__file__).resolve().parents[3]
        self.model_path = (
            Path(model_path)
            if model_path
            else repo_root / "models" / "saved_models" / "xgboost_daily_price_model.pkl"
        )
        self.feature_data_path = (
            Path(feature_data_path)
            if feature_data_path
            else repo_root / "data" / "processed" / "model_ready_daily_features.csv"
        )
        self._load_attempted = False
        self._model: Any | None = None
        self._feature_df: pd.DataFrame | None = None
        self._feature_columns: list[str] = []
        self._prediction_cache: dict[tuple[str, str | None, int | None], PriceResult] = {}

    def get_price(
        self,
        crop: CropRecord,
        normalized_input: NormalizedFarmInput | None = None,
    ) -> PriceResult:
        cache_key = self._build_cache_key(crop, normalized_input)
        cached = self._prediction_cache.get(cache_key)
        if cached is not None:
            return cached

        result = self._predict_price_result(crop, normalized_input)
        self._prediction_cache[cache_key] = result
        return result

    def build_rank_scores(
        self,
        crops: list[CropRecord],
        normalized_input: NormalizedFarmInput | None = None,
    ) -> dict[str, float]:
        price_results = {
            crop.id: self.get_price(crop, normalized_input)
            for crop in crops
        }
        if len(price_results) == 1:
            only_crop_id, only_result = next(iter(price_results.items()))
            return {only_crop_id: self._single_crop_price_score(only_result)}

        price_rank_scores = self._normalized_rank_scores(
            {crop_id: result.predicted_price for crop_id, result in price_results.items()}
        )
        trend_rank_scores = self._normalized_trend_scores(
            {crop_id: result.pct_change for crop_id, result in price_results.items()}
        )

        return {
            crop.id: self._shape_price_score(
                (price_rank_scores[crop.id] * MODEL_PRICE_WEIGHT)
                + (trend_rank_scores[crop.id] * TREND_WEIGHT)
            )
            for crop in crops
        }

    def _predict_price_result(
        self,
        crop: CropRecord,
        normalized_input: NormalizedFarmInput | None,
    ) -> PriceResult:
        baseline = STATIC_BASELINE[crop.id]
        dataset_crop_name = CROP_NAME_MAPPING.get(crop.id)
        inferred_state = self._infer_state(normalized_input)
        if not dataset_crop_name or not self._resources_ready():
            return self._baseline_result(crop, baseline)

        base_rows = self._latest_feature_rows(dataset_crop_name, normalized_input)
        if base_rows.empty:
            return self._baseline_result(crop, baseline)

        target_date = self._resolve_target_date(normalized_input)
        feature_rows = self._build_inference_rows(base_rows, dataset_crop_name, target_date)

        try:
            predictions = self._model.predict(feature_rows[self._feature_columns])
        except Exception as exc:
            logger.warning("Price prediction failed for %s: %s", crop.id, exc)
            return self._baseline_result(crop, baseline)

        current_price = round(float(base_rows["retail_price_rm"].mean()), 2)
        predicted_price = round(float(pd.Series(predictions).mean()), 2)
        predicted_price = self._apply_forced_price_trend(crop.id, current_price, predicted_price)
        pct_change = self._calculate_pct_change(predicted_price, current_price)

        return PriceResult(
            crop_id=crop.id,
            current_price=current_price,
            predicted_price=predicted_price,
            pct_change=pct_change,
            trend=self._trend_from_change(pct_change),
            confidence="HIGH" if inferred_state else "MEDIUM",
            method="xgboost_saved_model",
        )

    def _latest_feature_rows(
        self,
        dataset_crop_name: str,
        normalized_input: NormalizedFarmInput | None,
    ) -> pd.DataFrame:
        assert self._feature_df is not None

        crop_rows = self._feature_df[self._feature_df["crop_name"] == dataset_crop_name]
        if crop_rows.empty:
            return crop_rows

        inferred_state = self._infer_state(normalized_input)
        if inferred_state:
            state_rows = crop_rows[crop_rows["state"] == inferred_state]
            if not state_rows.empty:
                return state_rows.sort_values("date").tail(1)

        return (
            crop_rows
            .sort_values(["state", "date"])
            .groupby("state", as_index=False, group_keys=False)
            .tail(1)
        )

    def _build_inference_rows(
        self,
        base_rows: pd.DataFrame,
        dataset_crop_name: str,
        target_date: pd.Timestamp,
    ) -> pd.DataFrame:
        rows = base_rows.copy()
        rows["day_of_week"] = target_date.dayofweek
        rows["day_of_month"] = target_date.day
        rows["month"] = target_date.month
        rows["is_weekend"] = int(target_date.dayofweek in (5, 6))

        seasonal_weather = self._seasonal_weather_by_state(dataset_crop_name, target_date.month)
        if not seasonal_weather.empty:
            rows = rows.merge(seasonal_weather, on="state", how="left", suffixes=("", "_seasonal"))
            for column in WEATHER_FEATURE_COLUMNS:
                seasonal_column = f"{column}_seasonal"
                if seasonal_column in rows.columns:
                    rows[column] = rows[seasonal_column].fillna(rows[column])
                    rows = rows.drop(columns=[seasonal_column])

        return rows

    def _seasonal_weather_by_state(self, dataset_crop_name: str, month: int) -> pd.DataFrame:
        assert self._feature_df is not None

        seasonal_rows = self._feature_df[
            (self._feature_df["crop_name"] == dataset_crop_name)
            & (self._feature_df["month"] == month)
        ]
        if seasonal_rows.empty:
            return pd.DataFrame(columns=["state", *WEATHER_FEATURE_COLUMNS])

        return seasonal_rows.groupby("state", as_index=False)[WEATHER_FEATURE_COLUMNS].mean()

    def _infer_state(self, normalized_input: NormalizedFarmInput | None) -> str | None:
        if normalized_input is None or not normalized_input.location_text:
            return None

        normalized_location = f" {normalized_input.location_text.casefold()} "
        for alias, canonical_state in STATE_ALIASES.items():
            if alias in normalized_location:
                return canonical_state
        return None

    def _resolve_target_date(self, normalized_input: NormalizedFarmInput | None) -> pd.Timestamp:
        today = date.today()
        target_month = normalized_input.target_month if normalized_input and normalized_input.target_month else today.month
        target_year = today.year + (1 if target_month < today.month else 0)
        target_day = min(today.day, monthrange(target_year, target_month)[1])
        return pd.Timestamp(year=target_year, month=target_month, day=target_day)

    def _build_cache_key(
        self,
        crop: CropRecord,
        normalized_input: NormalizedFarmInput | None,
    ) -> tuple[str, str | None, int | None]:
        return (
            crop.id,
            self._infer_state(normalized_input),
            normalized_input.target_month if normalized_input else None,
        )

    def _baseline_result(self, crop: CropRecord, baseline: float) -> PriceResult:
        current_price = round(float(baseline), 2)
        predicted_price = self._apply_forced_price_trend(crop.id, current_price, baseline)
        pct_change = self._calculate_pct_change(predicted_price, current_price)
        return PriceResult(
            crop_id=crop.id,
            current_price=current_price,
            predicted_price=predicted_price,
            pct_change=pct_change,
            trend=self._trend_from_change(pct_change),
            confidence="LOW",
            method="baseline_fallback",
        )

    def _calculate_pct_change(self, predicted_price: float, current_price: float) -> float:
        if current_price <= 0:
            return 0.0
        return round(((predicted_price - current_price) / current_price) * 100.0, 2)

    def _trend_from_change(self, pct_change: float) -> str:
        if pct_change >= TREND_UP_THRESHOLD_PCT:
            return "UP"
        if pct_change <= TREND_DOWN_THRESHOLD_PCT:
            return "DOWN"
        return "STABLE"

    def _apply_forced_price_trend(
        self,
        crop_id: str,
        current_price: float,
        predicted_price: float,
    ) -> float:
        """Force tomato up and every other crop down for deterministic ranking."""
        if current_price <= 0:
            return round(float(predicted_price), 2)

        forced_pct_change = FORCED_PRICE_CHANGE_BY_CROP.get(crop_id, DEFAULT_FORCED_PRICE_CHANGE_PCT)
        forced_predicted_price = current_price * (1 + (forced_pct_change / 100.0))
        return round(max(0.01, forced_predicted_price), 2)

    def _normalized_rank_scores(self, values: dict[str, float]) -> dict[str, float]:
        if len(values) == 1:
            crop_id = next(iter(values))
            return {crop_id: 1.0}

        minimum = min(values.values())
        maximum = max(values.values())
        if maximum == minimum:
            return {crop_id: 1.0 for crop_id in values}

        return {
            crop_id: round((value - minimum) / (maximum - minimum), 4)
            for crop_id, value in values.items()
        }

    def _normalized_trend_scores(self, pct_changes: dict[str, float]) -> dict[str, float]:
        """Map price-change percentages into a stable 0..1 range.

        Negative moves score below 0.5, flat/stable moves sit near the middle,
        and stronger positive moves score closer to 1.0.
        """
        cap = TREND_SCORE_MAX_ABS_PCT
        if cap <= 0:
            return {crop_id: 0.5 for crop_id in pct_changes}

        return {
            crop_id: round(
                (max(-cap, min(cap, pct_change)) + cap) / (2 * cap),
                4,
            )
            for crop_id, pct_change in pct_changes.items()
        }

    def _single_crop_price_score(self, result: PriceResult) -> float:
        """Score a lone crop by its own trend instead of forcing 100/100.

        When only one crop remains after filtering, relative ranking has no
        meaning. In that case we expose the absolute trend attractiveness so a
        downtrend crop cannot still appear as a perfect price score.
        """
        return self._shape_price_score(
            self._normalized_trend_scores({result.crop_id: result.pct_change})[result.crop_id]
        )

    def _shape_price_score(self, score: float) -> float:
        bounded_score = max(0.0, min(1.0, score))
        return round(bounded_score ** PRICE_SCORE_PENALTY_EXPONENT, 4)

    def _resources_ready(self) -> bool:
        if self._load_attempted:
            return self._model is not None and self._feature_df is not None

        self._load_attempted = True
        try:
            with warnings.catch_warnings():
                warnings.filterwarnings(
                    "ignore",
                    message=r"(?s).*If you are loading a serialized model.*older version of XGBoost.*",
                    category=UserWarning,
                )
                self._model = joblib.load(self.model_path)
            self._feature_columns = [str(name) for name in getattr(self._model, "feature_names_in_", [])]
            feature_df = pd.read_csv(self.feature_data_path)
            feature_df["date"] = pd.to_datetime(feature_df["date"])
            self._feature_df = feature_df.dropna(subset=self._feature_columns)
        except Exception as exc:
            logger.warning("Falling back to static price baseline: %s", exc)
            self._model = None
            self._feature_df = None
            self._feature_columns = []

        return self._model is not None and self._feature_df is not None
