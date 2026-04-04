# AgriFlow

AgriFlow is a Next.js frontend with a FastAPI backend and local model artifacts for crop recommendation, climate scoring, and assistant flows.

## Vercel import checklist

1. Import the repository into Vercel.
2. In Project Settings, set the Framework Preset to `Services`.
3. Add the environment variables from `.env.example`.
4. Set `NEXT_PUBLIC_API_BASE_URL=/server`.
5. Deploy and verify `/server/api/v1/health`.

The phone measurement flow uses the current HTTPS site origin automatically on
Vercel. `NEXT_PUBLIC_PHONE_BASE_URL` is only needed for local phone testing
when your app is running on plain HTTP and you want to point the QR code at an
tunnel such as ngrok. If you open a protected Vercel deployment URL instead of
your public production alias, set `NEXT_PUBLIC_PHONE_BASE_URL` to the public
alias or custom domain so the QR code does not point phones at a protected
deployment hostname. Phone-to-dashboard sync uses the backend database as the
shared handoff between devices, so keep `DATABASE_URL` configured in deployed
environments if you want the measurement result to appear in the dashboard chat.

The Vercel backend uses a slim Python runtime. Climate scoring still runs from
the bundled climate model, while price forecasting falls back to the static
baseline unless you install the optional backend `ml` extra on another host.

## Required Vercel environment variables

- `PERSISTENCE_MODE=local`
- `OLLAMA_BASE_URL=https://ollama.com`
- `OLLAMA_API_KEY`
- `OLLAMA_MODEL=gemma3`
- `NEXT_PUBLIC_API_BASE_URL=/server`
- `DATABASE_URL` for phone measurement sync

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
- `OLLAMA_VISION_MODEL=gemma3`

In local persistence mode, the planning workspace is stored in the browser and the backend preview routes do not require a database. Use the repo-root `.env` for real local secrets. The committed `.env.example` file is the template.
