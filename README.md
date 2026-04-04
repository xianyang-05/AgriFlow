# AgriFlow

AgriFlow is a Next.js frontend with a FastAPI backend and local model artifacts for crop recommendation, climate scoring, and assistant flows.

## Vercel import checklist

1. Import the repository into Vercel.
2. In Project Settings, set the Framework Preset to `Services`.
3. Add the environment variables from `.env.example`.
4. Set `NEXT_PUBLIC_API_BASE_URL=/server`.
5. Deploy and verify `/server/api/v1/health`.

## Required Vercel environment variables

- `DATABASE_URL`
- `OLLAMA_BASE_URL=https://ollama.com`
- `OLLAMA_API_KEY`
- `OLLAMA_MODEL`
- `NEXT_PUBLIC_API_BASE_URL=/server`

## Optional backend environment variables

- `APP_NAME`
- `ENVIRONMENT`
- `APP_DEBUG`
- `API_V1_PREFIX`
- `NOMINATIM_BASE_URL`
- `OPEN_ELEVATION_BASE_URL`
- `ALTITUDE_REQUIRED`
- `CLIMATE_MODEL_PATH`
- `REQUEST_TIMEOUT_SECONDS`
- `DEFAULT_FORECAST_HORIZON_MONTHS`
- `DEFAULT_CURRENCY`
- `CORS_ORIGINS`

Use `.env.local` files for real local secrets. The committed env files are templates only.
