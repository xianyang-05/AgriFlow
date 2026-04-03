# AgriFlow Backend

FastAPI backend for deterministic crop recommendations.

## Run

```bash
pip install -e .[dev]
uvicorn app.main:app --reload
```

## Climate Model

By default the backend uses the local file configured by `CLIMATE_MODEL_PATH`
(currently `climate_model_v2.joblib`).

## Test

```bash
pytest
```
