# AgriFlow Backend

FastAPI backend for deterministic crop recommendations.

## Run

```bash
pip install -e ".[dev,ml]"
uvicorn app.main:app --reload
```

Install without the optional `ml` extra when you want the lightweight runtime
used by Vercel. In that mode the backend still works, but price forecasting
falls back to the static baseline instead of the local XGBoost model.

## Climate Model

By default the backend uses the local file configured by `CLIMATE_MODEL_PATH`
(currently `climate_model_v2.joblib`).

## Test

```bash
pytest
```
