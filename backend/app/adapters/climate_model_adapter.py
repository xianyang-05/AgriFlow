from __future__ import annotations

import __main__
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.config import get_settings
from app.exceptions import ClimateError
from app.schemas.climate import ClimateOutput, ClimateRequest, ForecastBlock


class ClimateModelAdapter:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._loaded_model: Any | None = None
        self._backend_root = Path(__file__).resolve().parents[2]
        self._repo_root = Path(__file__).resolve().parents[3]

    def fetch(self, request: ClimateRequest) -> ClimateOutput:
        if not self.settings.climate_model_path:
            raise ClimateError("Climate model not configured (set CLIMATE_MODEL_PATH)")
        try:
            return self.parse(self._predict_local(request), request)
        except ClimateError:
            raise
        except Exception as exc:
            raise ClimateError(f"Local climate model failed: {exc}") from exc

    def _predict_local(self, request: ClimateRequest) -> dict[str, Any]:
        model_path = self._resolve_model_path(self.settings.climate_model_path)
        if not model_path.exists():
            raise ClimateError(f"Climate model file not found: {model_path}")

        artifact = self._load_local_artifact(model_path)
        model = artifact.get("model") if isinstance(artifact, dict) and "model" in artifact else artifact
        model_type = self._extract_model_type(artifact, model)
        if self._has_supported_inference_method(model):
            prediction = self._invoke_model(
                model,
                lat=request.lat,
                lon=request.lon,
                target_month=request.target_month,
                horizon_months=request.horizon_months,
            )
            return self._to_raw_payload(prediction, request, model_type=model_type)
        if self._can_derive_from_model_state(model):
            return self._predict_from_model_state(model, request, model_type=model_type)

        raise ClimateError(
            "Unsupported climate model interface and missing required model state for derived predictions."
        )

    def _load_local_artifact(self, model_path: Path) -> Any:
        if self._loaded_model is not None:
            return self._loaded_model

        class ClimateAnalogRiskModelV2:
            pass

        class ModelConfig:
            pass

        # Some joblib artifacts were trained from __main__ classes.
        __main__.ClimateAnalogRiskModelV2 = ClimateAnalogRiskModelV2
        __main__.ModelConfig = ModelConfig
        try:
            self._loaded_model = joblib.load(model_path)
        except ModuleNotFoundError as exc:
            if exc.name in {"sklearn", "pandas"}:
                raise ClimateError(
                    "Local climate model requires missing dependency: "
                    f"{exc.name}. Install required model dependencies for this Python runtime."
                ) from exc
            raise
        return self._loaded_model

    def _extract_model_type(self, artifact: Any, model: Any) -> str:
        if isinstance(artifact, dict):
            for key in ("model_type", "version", "name"):
                value = artifact.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return model.__class__.__name__

    def _has_supported_inference_method(self, model: Any) -> bool:
        return any(hasattr(model, name) for name in ("predict_forecast", "forecast", "predict", "infer", "run"))

    def _can_derive_from_model_state(self, model: Any) -> bool:
        return all(hasattr(model, attr) for attr in ("thresholds_", "train_df_", "grid_", "config"))

    def _invoke_model(
        self,
        model: Any,
        *,
        lat: float,
        lon: float,
        target_month: int,
        horizon_months: int,
    ) -> Any:
        feature_payload = {
            "lat": lat,
            "lon": lon,
            "target_month": target_month,
            "horizon_months": horizon_months,
        }
        methods = ["predict_forecast", "forecast", "predict", "infer", "run"]
        for method_name in methods:
            if not hasattr(model, method_name):
                continue
            method = getattr(model, method_name)
            for invocation in (
                lambda: method(feature_payload),
                lambda: method(**feature_payload),
                lambda: method(lat, lon, target_month, horizon_months),
            ):
                try:
                    result = invocation()
                    if result is not None:
                        return result
                except TypeError:
                    continue

        if callable(model):
            for invocation in (
                lambda: model(feature_payload),
                lambda: model(**feature_payload),
                lambda: model(lat, lon, target_month, horizon_months),
            ):
                try:
                    result = invocation()
                    if result is not None:
                        return result
                except TypeError:
                    continue

        raise ClimateError(
            "Unsupported climate model interface. Expected one of: predict_forecast, forecast, predict, infer, run."
        )

    def _predict_from_model_state(
        self,
        model: Any,
        request: ClimateRequest,
        *,
        model_type: str,
    ) -> dict[str, Any]:
        config = getattr(model, "config", None)
        dry_q = float(getattr(config, "dry_quantile", 0.2))
        wet_q = float(getattr(config, "wet_quantile", 0.8))
        dry_prob = max(0.0, min(1.0, dry_q))
        wet_prob = max(0.0, min(1.0, 1.0 - wet_q))
        normal_prob = max(0.0, 1.0 - dry_prob - wet_prob)

        forecasts: list[dict[str, Any]] = []
        max_horizon_available = max(getattr(model, "thresholds_", {}).keys(), default=1)

        for horizon in range(1, request.horizon_months + 1):
            horizon_key = min(horizon, max_horizon_available)
            threshold_table = model.thresholds_.get(horizon_key)
            if threshold_table is None or len(threshold_table) == 0:
                raise ClimateError(f"Threshold table missing for horizon {horizon_key}")

            target_month = ((request.target_month + horizon - 2) % 12) + 1
            row = self._select_threshold_row(threshold_table, request.lat, request.lon, target_month)
            p10 = float(row["dry_thr"])
            p50 = float(row["median_thr"])
            p90 = float(row["wet_thr"])
            analog_years = self._derive_analog_years(
                train_df=model.train_df_,
                lat=float(row["lat"]),
                lon=float(row["lon"]),
                target_month=target_month,
                horizon=horizon_key,
                rainfall_target=p50,
                k_analogs=int(getattr(config, "k_analogs", 20)),
                n_grid_neighbors=int(getattr(config, "n_grid_neighbors", 4)),
                spatial_power=float(getattr(config, "spatial_power", 2.0)),
                analog_power=float(getattr(config, "analog_power", 2.0)),
            )

            forecasts.append(
                {
                    "horizon_months": horizon,
                    "rainfall_mm": p50,
                    "p10": p10,
                    "p50": p50,
                    "p90": p90,
                    "probabilities": {"dry": dry_prob, "normal": normal_prob, "wet": wet_prob},
                    "analog_years": analog_years,
                }
            )

        return {
            "model_type": model_type,
            "target_month": request.target_month,
            "forecasts": forecasts,
        }

    def _select_threshold_row(
        self,
        threshold_table: pd.DataFrame,
        lat: float,
        lon: float,
        target_month: int,
    ) -> pd.Series:
        df = threshold_table.copy()
        if "month" in df.columns:
            month_subset = df[df["month"] == target_month]
            if not month_subset.empty:
                df = month_subset.assign(_month_penalty=0.0)
            else:
                month_delta = (df["month"] - target_month).abs()
                month_delta = np.minimum(month_delta, 12 - month_delta)
                df = df.assign(_month_penalty=month_delta)
        else:
            df = df.assign(_month_penalty=0.0)

        spatial_distance = np.sqrt((df["lat"] - lat) ** 2 + (df["lon"] - lon) ** 2)
        total_distance = spatial_distance + (df["_month_penalty"] * 0.25)
        idx = int(total_distance.idxmin())
        return df.loc[idx]

    def _derive_analog_years(
        self,
        *,
        train_df: pd.DataFrame,
        lat: float,
        lon: float,
        target_month: int,
        horizon: int,
        rainfall_target: float,
        k_analogs: int,
        n_grid_neighbors: int,
        spatial_power: float,
        analog_power: float,
    ) -> list[int]:
        required_columns = {"year", "month", "lat", "lon"}
        if not required_columns.issubset(train_df.columns):
            return []

        df = train_df[train_df["month"] == target_month].copy()
        if df.empty:
            return []

        df["_spatial"] = np.sqrt((df["lat"] - lat) ** 2 + (df["lon"] - lon) ** 2)
        if n_grid_neighbors > 0 and len(df) > n_grid_neighbors:
            nearest_distances = np.sort(df["_spatial"].to_numpy())[:n_grid_neighbors]
            distance_cutoff = float(nearest_distances[-1])
            df = df[df["_spatial"] <= distance_cutoff].copy()

        rain_column = f"rain_h{horizon}" if f"rain_h{horizon}" in df.columns else "rain_mm"
        if rain_column not in df.columns:
            return []

        df["_rain_delta"] = (df[rain_column] - rainfall_target).abs()
        df["_score"] = (df["_spatial"] ** max(spatial_power, 1.0)) + (
            df["_rain_delta"] ** max(analog_power, 1.0)
        )
        df = df.sort_values("_score", ascending=True).head(max(k_analogs, 3))

        years: list[int] = []
        for value in df["year"].tolist():
            year = int(value)
            if year not in years:
                years.append(year)
            if len(years) >= 3:
                break
        return years

    def _to_raw_payload(
        self,
        prediction: Any,
        request: ClimateRequest,
        *,
        model_type: str,
    ) -> dict[str, Any]:
        if isinstance(prediction, ClimateOutput):
            return {
                "model_type": prediction.model_type,
                "target_month": prediction.target_month,
                "forecasts": [
                    {
                        "horizon_months": block.horizon_months,
                        "rainfall_mm": block.predicted_rain_mm,
                        "p10": block.rain_p10,
                        "p50": block.rain_p50,
                        "p90": block.rain_p90,
                        "probabilities": {
                            "dry": block.dry_risk,
                            "normal": block.normal_risk,
                            "wet": block.wet_risk,
                        },
                        "analog_years": block.top_analog_years,
                    }
                    for block in prediction.forecast_blocks
                ],
            }

        if hasattr(prediction, "model_dump"):
            return self._to_raw_payload(
                prediction.model_dump(),
                request,
                model_type=model_type,
            )

        if isinstance(prediction, dict):
            if "forecasts" in prediction:
                payload = dict(prediction)
                payload.setdefault("model_type", model_type)
                payload.setdefault("target_month", request.target_month)
                return payload
            if "forecast_blocks" in prediction:
                blocks = prediction.get("forecast_blocks", [])
                return {
                    "model_type": prediction.get("model_type", model_type),
                    "target_month": prediction.get("target_month", request.target_month),
                    "forecasts": [
                        {
                            "horizon_months": int(block.get("horizon_months", index + 1)),
                            "rainfall_mm": float(block.get("predicted_rain_mm", 0.0)),
                            "p10": float(block.get("rain_p10", block.get("predicted_rain_mm", 0.0) * 0.8)),
                            "p50": float(block.get("rain_p50", block.get("predicted_rain_mm", 0.0))),
                            "p90": float(block.get("rain_p90", block.get("predicted_rain_mm", 0.0) * 1.2)),
                            "probabilities": {
                                "dry": float(block.get("dry_risk", 0.33)),
                                "normal": float(block.get("normal_risk", 0.34)),
                                "wet": float(block.get("wet_risk", 0.33)),
                            },
                            "analog_years": list(block.get("top_analog_years", [])),
                        }
                        for index, block in enumerate(blocks)
                    ],
                }

        if isinstance(prediction, (list, tuple)):
            forecasts: list[dict[str, Any]] = []
            for index, item in enumerate(prediction):
                horizon = index + 1
                if isinstance(item, dict):
                    rainfall = float(item.get("rainfall_mm", item.get("predicted_rain_mm", 0.0)))
                    p10 = float(item.get("p10", rainfall * 0.8))
                    p50 = float(item.get("p50", rainfall))
                    p90 = float(item.get("p90", rainfall * 1.2))
                    probabilities = item.get("probabilities", {})
                    dry = float(probabilities.get("dry", item.get("dry_risk", 0.33)))
                    normal = float(probabilities.get("normal", item.get("normal_risk", 0.34)))
                    wet = float(probabilities.get("wet", item.get("wet_risk", 0.33)))
                    analog_years = list(item.get("analog_years", item.get("top_analog_years", [])))
                else:
                    rainfall = float(item)
                    p10 = rainfall * 0.8
                    p50 = rainfall
                    p90 = rainfall * 1.2
                    dry = 0.33
                    normal = 0.34
                    wet = 0.33
                    analog_years = []

                forecasts.append(
                    {
                        "horizon_months": horizon,
                        "rainfall_mm": rainfall,
                        "p10": p10,
                        "p50": p50,
                        "p90": p90,
                        "probabilities": {"dry": dry, "normal": normal, "wet": wet},
                        "analog_years": analog_years,
                    }
                )

            return {
                "model_type": model_type,
                "target_month": request.target_month,
                "forecasts": forecasts,
            }

        raise ClimateError("Climate model returned an unsupported prediction payload")

    def parse(self, payload: dict, request: ClimateRequest) -> ClimateOutput:
        raw_forecasts = payload.get("forecasts", [])
        blocks: list[ForecastBlock] = []
        for raw_block in raw_forecasts:
            try:
                blocks.append(
                    ForecastBlock(
                        horizon_months=int(raw_block["horizon_months"]),
                        predicted_rain_mm=float(raw_block["rainfall_mm"]),
                        rain_p10=float(raw_block["p10"]),
                        rain_p50=float(raw_block["p50"]),
                        rain_p90=float(raw_block["p90"]),
                        dry_risk=float(raw_block["probabilities"]["dry"]),
                        normal_risk=float(raw_block["probabilities"]["normal"]),
                        wet_risk=float(raw_block["probabilities"]["wet"]),
                        top_analog_years=list(raw_block.get("analog_years", [])),
                    )
                )
            except (KeyError, TypeError, ValueError):
                continue

        if not blocks:
            raise ClimateError("Climate response missing valid forecast blocks")

        return ClimateOutput(
            model_type=str(payload.get("model_type", "unknown")),
            request_location={"lat": request.lat, "lon": request.lon},
            target_month=int(payload.get("target_month", request.target_month)),
            forecast_horizon_months=request.horizon_months,
            forecast_blocks=blocks,
        )

    def check_health(self) -> dict[str, str]:
        model_path = self.settings.climate_model_path
        model_status = "missing_config"
        resolved_path = ""
        if model_path:
            resolved = self._resolve_model_path(model_path)
            resolved_path = str(resolved)
            model_status = "ready" if resolved.exists() else "missing_file"

        return {
            "status": "configured" if model_status == "ready" else "missing_config",
            "model_path_status": model_status,
            "model_path": resolved_path,
        }

    def _resolve_model_path(self, model_path: str | None) -> Path:
        if not model_path:
            return Path("")

        raw_path = Path(model_path)
        if raw_path.is_absolute():
            return raw_path.resolve()

        candidates = [
            self._backend_root / raw_path,
            self._repo_root / raw_path,
            Path.cwd() / raw_path,
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate.resolve()

        return candidates[0].resolve()
