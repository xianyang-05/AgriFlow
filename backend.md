# AGENTS.md — FASTAPI CROP RECOMMENDATION BACKEND (FINAL SPEC FOR CODEX)

---

## CORE RULES

- LLM ONLY for: normalization extraction, chat intent classification, explanation, user Q&A
- NEVER use LLM for scoring or crop selection
- Decision engine MUST be deterministic
- Hard constraints MUST run BEFORE scoring
- ALL recoverable failures MUST return structured HTTP 200 (NO 500s)
- Preferences MUST NOT be inferred during normalization
- Plan version history is append-only (never mutate existing versions)

---

## FILE STRUCTURE (STRICT — ONE RESPONSIBILITY PER FILE)

```
app/
├── main.py                        # FastAPI init, middleware, router includes, lifespan ONLY
├── config.py                      # Settings via pydantic-settings, reads from env
├── database.py                    # SQLAlchemy engine, session factory, Base
├── logging_config.py              # structlog JSON config, request_id middleware
├── exceptions.py                  # All domain exceptions + global FastAPI exception handler
│
├── routes/
│   ├── __init__.py
│   ├── health.py                  # GET /health
│   ├── recommendations.py         # POST /recommendations, GET /{run_id}, POST /{run_id}/revert
│   ├── chat.py                    # POST /chat
│   └── crops.py                   # GET /crops
│
├── schemas/
│   ├── __init__.py
│   ├── input.py                   # RawInput, NormalizedFarmInput, UserPreferences
│   ├── climate.py                 # ClimateRequest, ForecastBlock, ClimateOutput
│   ├── crop.py                    # CropRecord, CropRequirements
│   ├── suitability.py             # SuitabilityResult, EliminationReason
│   ├── price.py                   # PriceResult (always carries method="placeholder")
│   ├── decision.py                # ScoredCrop, CropPlan, DecisionOutput
│   ├── pipeline.py                # PipelineResult (internal only, never exposed in routes)
│   ├── plan.py                    # PlanVersion, RecommendationResponse
│   └── chat.py                    # ChatRequest, IntentClassification, ChatResponse
│
├── models/
│   ├── __init__.py
│   ├── crop.py                    # Crop ORM model
│   ├── recommendation_run.py      # RecommendationRun ORM model
│   ├── plan_version.py            # PlanVersion ORM model
│   └── chat_message.py            # ChatMessage ORM model
│
├── repositories/
│   ├── __init__.py
│   ├── crop_repository.py         # CRUD for crops
│   ├── run_repository.py          # CRUD for recommendation_runs
│   ├── plan_repository.py         # Version queries, save, revert for plan_versions
│   └── chat_repository.py         # CRUD for chat_messages
│
├── services/
│   ├── __init__.py
│   ├── normalization_service.py   # Orchestrates stages 1–5 of normalization pipeline
│   ├── llm_service.py             # ALL LLM calls: extraction, explanation, intent, Q&A
│   ├── geocoding_service.py       # Nominatim adapter → GeocodeResult or raises GeocodingError
│   ├── altitude_service.py        # Open-Elevation or DEM lookup → float or raises AltitudeError
│   ├── climate_service.py         # Calls climate adapter, converts ForecastBlocks to climate_score
│   ├── suitability_service.py     # Rules engine → SuitabilityResult per crop
│   ├── hard_constraint_service.py # Elimination gate → (eligible_crops, eliminated_crops)
│   ├── price_service.py           # Placeholder price → PriceResult(method="placeholder")
│   ├── decision_service.py        # Deterministic scoring + aggressive/conservative plans
│   ├── explanation_service.py     # LLM explanation with deterministic template fallback
│   ├── chat_service.py            # Intent classification, Q&A, modification, revert routing
│   ├── plan_history_service.py    # save_version(), get_current(), revert()
│   └── recommendation_service.py # Orchestrates full pipeline using PipelineResult
│
├── adapters/
│   ├── __init__.py
│   └── climate_model_adapter.py   # Raw HTTP call to climate model + parses raw → ClimateOutput
│
├── unit_conversion/
│   ├── __init__.py
│   ├── area.py                    # football field→m², rai→m², ekar→m², acre→m², etc.
│   ├── budget.py                  # "8k"→8000.0, "RM5000"→5000.0, currency normalisation
│   └── registry.py                # Lookup table. Raises ConversionError for unknown units.
│
├── seed/
│   ├── __init__.py
│   ├── crops.py                   # 8–10 crop records with all required fields
│   └── run_seed.py                # Idempotent seed script
│
├── migrations/
│   ├── env.py
│   └── versions/
│
├── tests/
│   ├── conftest.py                # DB fixture, mock LLM, mock geocoding, mock climate stub
│   ├── fixtures/
│   │   └── climate_stub.json      # Canonical raw model response (see CLIMATE SYSTEM section)
│   ├── test_normalization.py      # Edge cases: football fields, "8k", ambiguous phrases
│   ├── test_geocoding.py          # Success, not found, timeout
│   ├── test_altitude.py           # Success, failure with warning
│   ├── test_climate_adapter.py    # Parses stub, multi-horizon, incomplete response
│   ├── test_suitability.py        # Rules fire correctly per crop requirements
│   ├── test_hard_constraints.py   # Elimination gate, all-crops-eliminated case
│   ├── test_decision.py           # Score ordering, weight correctness per strategy
│   ├── test_recommendation.py     # Full pipeline happy path + incomplete pipeline path
│   ├── test_chat_intent.py        # All three intents + keyword fallback logic
│   ├── test_chat_modify.py        # Constraint update triggers pipeline rerun
│   ├── test_chat_question.py      # Question path does NOT rerun pipeline
│   └── test_revert.py             # Revert via endpoint and via chat produce same result
│
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
├── pyproject.toml
└── README.md
```

### Layer rules (STRICT)

- `routes/` — request parsing, one service call, response return only. Max ~20 lines per handler. No business logic.
- `services/` — all business logic. No direct DB calls. Calls repositories only.
- `repositories/` — all DB queries. No business logic.
- `adapters/` — external HTTP calls and raw response parsing only. No scoring logic.
- `schemas/` — Pydantic models only. No methods with business logic. Never import from `models/`.
- `models/` — SQLAlchemy ORM models only. Never import from `schemas/`.
- `unit_conversion/` — pure deterministic code. No I/O, no LLM, no DB. Independently testable.
- `exceptions.py` — defines all domain exceptions. Routes catch them via the global handler in `main.py`.

---

## DATA MODEL

### NormalizedFarmInput (populated by normalization_service ONLY)

```
area_m2                    float
budget_myr                 float
latitude                   float
longitude                  float
altitude_m                 float | None
target_month               int (1–12, default = current calendar month)
forecast_horizon_months    int (default = 3)
extraction_confidence      float (0–1)
clarification_needed       bool
clarification_questions    list[str]
```

### UserPreferences (populated by chat_service ONLY)

```
preferred_crops            list[str]
excluded_crops             list[str]
risk_preference            str | None
harvest_preference         str | None
notes                      str | None
```

**RULE: `normalization_service` MUST NOT populate any field in `UserPreferences`.**

---

## INTERNAL PIPELINE OBJECT

`PipelineResult` is used only inside `recommendation_service.py`. It is never serialised to a route response directly.

```
normalized_input           NormalizedFarmInput | None
user_preferences           UserPreferences
geocode_result             GeocodeResult | None
altitude_m                 float | None
climate_output             ClimateOutput | None
suitability_results        list[SuitabilityResult]
eliminated_crops           list[EliminationReason]
eligible_crops             list[CropRecord]
scored_crops               list[ScoredCrop]
aggressive_plan            CropPlan | None
conservative_plan          CropPlan | None
explanation                str
warnings                   list[str]
status                     "complete" | "incomplete" | "no_viable_crops"
```

`recommendation_service.py` builds this object step by step. Each step checks whether the previous step's output is non-null before proceeding. A null `geocode_result` stops the pipeline at the geocoding step and sets `status = "incomplete"`. No exceptions propagate beyond `recommendation_service`.

**Pipeline orchestration rule:** `normalization_service` produces `location_text` as part of its output. `recommendation_service` then calls `geocoding_service` and `altitude_service` as separate steps. Lat/lon and altitude are written back into `PipelineResult` by `recommendation_service`, NOT by `normalization_service`.

**Notes rerun rule:** On every pipeline run (initial and rerun), `user_preferences.notes` is appended to the LLM normalization prompt alongside `area_text` and `budget_text`. This ensures context like "my land is near a river" affects normalization on reruns.

---

## GLOBAL RESPONSE CONTRACT

Every endpoint MUST include these fields in every response:

```
status                     "complete" | "incomplete" | "no_viable_crops"
clarification_needed       bool
clarification_questions    list[str]
warnings                   list[str]
```

---

## FAILURE HANDLING

### Geocoding failure
```
HTTP 200
status = "incomplete"
clarification_needed = true
clarification_questions = ["Please clarify your farm location (district, state, or nearby landmark)"]
all downstream fields = null
```

### Altitude failure
```
If altitude is optional for climate service:
  continue with altitude_m = null
  warnings += ["Altitude unavailable — climate estimates may be less precise"]

If altitude is required:
  same as geocoding failure
```

### Climate model failure
```
HTTP 200
status = "incomplete"
warnings += ["Climate model unavailable — try again shortly"]
all downstream fields = null
```

### All crops eliminated
```
HTTP 200
status = "no_viable_crops"
aggressive_plan = null
conservative_plan = null
eliminated_crops = full list with per-crop reasons
warnings = ["No crops passed hard constraints. Consider adjusting budget, location, or planting month via chat."]
explanation = REQUIRED (LLM or fallback template)
```

### LLM failure
```
Never crash.
Normalization LLM failure → attempt fallback parsing (stage 4).
Explanation LLM failure → use deterministic template fallback.
Chat intent LLM failure → use keyword fallback rules.
```

---

## EXCEPTION MAPPING (GLOBAL HANDLER IN main.py)

```
GeocodingError      → HTTP 200, status="incomplete", clarification_needed=True
AltitudeError       → HTTP 200, warning only (if optional) or status="incomplete" (if required)
ClimateError        → HTTP 200, status="incomplete"
NormalizationError  → HTTP 200, status="incomplete", clarification_needed=True
NoViableCropsError  → HTTP 200, status="no_viable_crops"
LLMError            → fallback behaviour, no crash, no 500
```

Implement a single FastAPI exception handler in `main.py` that catches all domain exceptions and serialises them using the global response contract. No per-route try/except blocks.

---

## NORMALIZATION PIPELINE

### Stages

```
1. LLM structured extraction   → raw JSON with typed fields
2. Pydantic validation         → catch type errors, missing fields
3. Deterministic conversion    → unit_conversion registry (raises ConversionError on unknown unit)
4. Fallback parsing            → triggered by ConversionError: regex on raw input text + defaults
5. Clarification               → if extraction_confidence < 0.6, set clarification_needed = true
```

### extraction_confidence

```
extraction_confidence = successfully_extracted_required_fields / total_required_fields
if extraction_confidence < 0.6:
    clarification_needed = true
```

### Required fields for confidence calculation
`area_m2`, `budget_myr`, `latitude`, `longitude`

### Defaults (add warning when applied)
```
target_month = current calendar month (1–12)
  warning: "Planting month assumed to be [month]. Confirm or update via chat."

forecast_horizon_months = 3
  warning: "Forecast horizon defaulted to 3 months."
```

### Hard rules
- NEVER fabricate coordinates
- NEVER fabricate altitude
- NEVER populate UserPreferences
- Ambiguous values → low confidence + clarification_questions entry
- `notes` from RawInput MUST be included in LLM prompt

---

## CLIMATE SYSTEM

### Climate stub fixture — MUST MATCH EXACTLY
Save as `tests/fixtures/climate_stub.json`:

```json
{
  "model_type": "seasonal_v1",
  "location": { "lat": 5.9, "lon": 100.4 },
  "target_month": 4,
  "forecasts": [
    {
      "horizon_months": 1,
      "rainfall_mm": 180.0,
      "p10": 120.0,
      "p50": 178.0,
      "p90": 240.0,
      "probabilities": { "dry": 0.15, "normal": 0.55, "wet": 0.30 },
      "analog_years": [2018, 2015, 2011]
    },
    {
      "horizon_months": 2,
      "rainfall_mm": 200.0,
      "p10": 150.0,
      "p50": 195.0,
      "p90": 260.0,
      "probabilities": { "dry": 0.12, "normal": 0.50, "wet": 0.38 },
      "analog_years": [2010, 2020]
    },
    {
      "horizon_months": 3,
      "rainfall_mm": 220.0,
      "p10": 170.0,
      "p50": 215.0,
      "p90": 300.0,
      "probabilities": { "dry": 0.10, "normal": 0.45, "wet": 0.45 },
      "analog_years": [2005, 2018]
    }
  ]
}
```

### Adapter input
```
lat, lon, target_month, horizon_months
```

### Adapter output — normalized ClimateOutput (STRICT)
Raw model output MUST NOT be passed to any downstream service.

```
model_type               str
request_location         {lat, lon}
target_month             int
forecast_horizon_months  int
forecast_blocks          list[ForecastBlock]
```

Each `ForecastBlock`:
```
horizon_months       int
predicted_rain_mm    float   (= rainfall_mm from raw)
rain_p10             float
rain_p50             float
rain_p90             float
dry_risk             float   (= probabilities.dry)
normal_risk          float   (= probabilities.normal)
wet_risk             float   (= probabilities.wet)
top_analog_years     list[int]
```

### Climate scoring rules
```
- Normalize rainfall to 0..1 using crop min/max rainfall tolerance
- drought_sensitive crops: penalize when dry_risk > 0.30
- flood_sensitive crops: penalize when wet_risk > 0.35
- Match crop growth_days to closest forecast horizon block
- DO NOT use raw rainfall_mm directly in score formula
```

---

## SUITABILITY ENGINE

`suitability_service.py` is rules-based and traceable. For each crop, evaluate:

- Temperature range vs crop min/max temperature tolerance
- Rainfall range vs crop min/max rainfall tolerance
- `target_month` vs crop `planting_months` list
- Budget vs `min_budget_per_m2 * area_m2`

Return `SuitabilityResult` per crop:
```
crop_id          str
suitable         bool
marginal         bool
reason           str    (specific rule that failed, e.g. "budget below minimum viable cost")
```

---

## HARD CONSTRAINT FILTER

`hard_constraint_service.py` runs AFTER suitability, BEFORE scoring.

Eliminate a crop if ANY of the following:
- `SuitabilityResult.suitable == False`
- `budget_myr < crop.min_budget_per_m2 * area_m2`
- `crop.id in user_preferences.excluded_crops`
- `user_preferences.harvest_preference == "fast"` and `crop.growth_days > 60`

Return:
```
eligible_crops     list[CropRecord]
eliminated_crops   list[EliminationReason]   ← each with crop_id + specific reason string
```

**RULE: DO NOT apply water_access as a hard constraint unless the user explicitly provides it via chat.**

---

## PRICE SERVICE

`price_service.py` returns placeholder values only. Never present as a trained model.

```python
PriceResult(
    crop_id=crop.id,
    predicted_price=STATIC_BASELINE[crop.id],
    confidence="LOW",
    method="placeholder"
)
```

Price scores MUST be ordinal ranks derived from `STATIC_BASELINE` values, not raw prices. This gives a meaningful relative signal without implying false precision.

---

## DECISION ENGINE

`decision_service.py` is deterministic. No LLM calls.

### budget_fit_score formula
```
budget_fit_score = min(1.0, (budget_myr - crop_min_cost) / crop_min_cost)
crop_min_cost = crop.min_budget_per_m2 * area_m2
clamp result to 0..1
```

### Scoring weights (MUST sum to 1.0 per strategy)

**Aggressive** — optimises for ROI proxy (faster harvest = more annual cycles):
```
suitability_score    0.25
climate_score        0.20
budget_fit_score     0.20
price_score          0.05
duration_fit_score   0.30
```

**Conservative** — optimises for climate safety and reliability:
```
suitability_score    0.35
climate_score        0.35
budget_fit_score     0.20
price_score          0.05
duration_fit_score   0.05
```

**Note:** `price_score` is 0.05 in both strategies for MVP because price is a placeholder. Once a real price model is integrated, aggressive `price_score` weight should increase and `duration_fit_score` should decrease accordingly.

### Output
```
ranked_crops       list[ScoredCrop]   (all eligible crops, sorted descending by strategy score)
aggressive_plan    CropPlan           (top crop under aggressive weights)
conservative_plan  CropPlan           (top crop under conservative weights)
```

---

## EXPLANATION SERVICE

`explanation_service.py` receives a defined input object (not the full PipelineResult):

```
ExplanationInput:
  aggressive_top_crop      ScoredCrop
  conservative_top_crop    ScoredCrop
  eliminated_crops         list[EliminationReason]
  forecast_blocks          list[ForecastBlock]   (summary only)
  warnings                 list[str]
  user_preferences         UserPreferences
```

LLM MUST explain:
- Why each top crop was chosen
- What assumptions were made
- Why each eliminated crop was removed
- How climate risk affected the result

LLM MUST NOT change rankings.

### Fallback template (used when LLM fails)
```
"[AggressiveCrop] was selected for the aggressive plan due to [suitability_reason].
Climate outlook: [one sentence from forecast_blocks summary].
[ConservativeCrop] was selected for the conservative plan.
[N] crops were eliminated before scoring."
```

---

## CHAT SYSTEM

### Intent classification — single LLM call (MANDATORY)

`llm_service.py` returns structured output:

```json
{
  "intent": "question" | "modification" | "revert",
  "confidence": 0.85,
  "updates": {}
}
```

### Keyword fallback (when LLM fails or confidence < 0.5)
```
message contains "revert" or "go back" or "undo" → intent = "revert"
updates is non-empty                              → intent = "modification"
otherwise                                         → intent = "question"
```

### QUESTION behavior
```
1. Load last 10 chat_messages for run_id
2. Call LLM with message + chat history + current recommendation context
3. Return assistant_message
4. DO NOT rerun pipeline
5. Save message pair to chat_messages
```

### MODIFICATION behavior
```
1. Load current PlanVersion for run_id
2. Call LLM (single call) → structured updates
3. Validate updates (Pydantic)
4. Save current version via plan_history_service.save_version()
5. Apply updates (see routing rules below)
6. Call recommendation_service.run(normalized_input, user_preferences)
7. Save new version via plan_history_service.save_version(version_note="chat_update")
8. Return updated recommendation + assistant explanation
9. Save message pair to chat_messages
```

### REVERT behavior
```
1. Call plan_history_service.revert(run_id)
   (same function used by POST /recommendations/{run_id}/revert)
2. Return reverted recommendation state
3. Save message pair to chat_messages
```

### Update routing rules (MANDATORY)

When applying chat updates, route each field to the correct object:

```
→ NormalizedFarmInput (partial update):
  budget_myr, area_m2, target_month, forecast_horizon_months

→ UserPreferences (partial update):
  preferred_crops, excluded_crops, risk_preference, harvest_preference, notes
```

Pass both updated objects into `recommendation_service.run()`.

### Forbidden updates (chat MUST NOT set these)
```
final crop selection
suitability_score
climate_score
price_score
elimination_reasons
```

### Allowed update fields (complete list)
```
budget, area, target_month, forecast_horizon_months,
preferred_crops, excluded_crops, risk_preference, harvest_preference, notes
```

---

## CHAT HISTORY (MANDATORY)

`chat_messages` table stores:

```
id               uuid
run_id           uuid (FK)
role             "user" | "assistant"
message          str
intent           str | None
created_at       datetime
```

On every LLM call in `chat_service.py`, load the last 10 messages for `run_id` and pass them as conversation history.

---

## PLAN VERSIONING (APPEND-ONLY)

Each version stores a full snapshot:
```
id                 uuid
run_id             uuid (FK)
version_number     int (auto-increment per run)
normalized_input   JSON
user_preferences   JSON
climate_output     JSON
eliminated_crops   JSON
ranked_crops       JSON
aggressive_plan    JSON
conservative_plan  JSON
explanation        str
warnings           list[str]
status             str
version_note       str   ("initial" | "chat_update" | "reverted_to_v{N}")
created_at         datetime
```

**APPEND-ONLY RULE:** Revert MUST NOT mutate any existing version record. Revert creates a NEW version copying the target version's data, with `version_note = "reverted_to_v{N}"`. The audit trail is never modified.

---

## API ENDPOINTS

### GET /health
Return status of: API, database, LLM, geocoding, climate model

### POST /api/v1/recommendations
```
Input:  RawInput { area_text, budget_text, location_text, notes }
Action: full pipeline
Output: RecommendationResponse
```

### GET /api/v1/recommendations/{run_id}
```
Output: current PlanVersion serialised as RecommendationResponse
        includes has_previous_version: bool
```

### POST /api/v1/recommendations/{run_id}/revert
```
Action: calls plan_history_service.revert(run_id)
Output: reverted RecommendationResponse
```

### POST /api/v1/chat
```
Input:  ChatRequest { run_id, message }
Action: classify intent → question | modification | revert
Output: ChatResponse {
          run_id, intent, confidence,
          applied_updates,
          updated_recommendation (only if plan changed),
          assistant_message,
          has_previous_version
        }
```

### GET /api/v1/crops
```
Query params: enabled: bool = True
Output: list[CropRecord] filtered by enabled flag
```

---

## SEED CROP DATA

Seed 8–10 crops. Each crop MUST have all fields below:

```
id                   str  (slug, e.g. "maize")
name                 str
growth_days          int
min_rainfall_mm      float
max_rainfall_mm      float
min_temp_c           float
max_temp_c           float
planting_months      list[int]   (e.g. [3, 4, 5, 10, 11])
min_budget_per_m2    float       (MYR)
drought_sensitive    bool
flood_sensitive      bool
enabled              bool
```

Seed crops (MVP):
`maize, chili, okra, eggplant, cucumber, spinach, kangkung, long_bean`

---

## LOGGING (STRICT)

Use `structlog` with JSON output only. No `print()`. No plain string logs.

Every request log entry MUST include:
```
request_id
route
normalization_confidence
geocoding_confidence
altitude_found
climate_model_version
horizon
eligible_crop_count
eliminated_crop_count
aggressive_crop
conservative_crop
chat_intent
reverted_version
latency_ms
```

---

## TESTING (MANDATORY)

All external dependencies MUST be mocked:
- LLM (`llm_service`)
- Geocoding (`geocoding_service`)
- Altitude (`altitude_service`)
- Climate model (`climate_model_adapter`)

Required test files and what they MUST cover:

| File | Must cover |
|---|---|
| `test_climate_adapter.py` | Parses stub correctly, multi-horizon, incomplete/missing blocks |
| `test_normalization.py` | Football fields, "8k" budget, ambiguous phrase, confidence < 0.6 |
| `test_geocoding.py` | Success, not found, timeout |
| `test_altitude.py` | Success, failure with warning |
| `test_suitability.py` | Each rule fires for the correct crop |
| `test_hard_constraints.py` | Elimination for each constraint type, all-crops-eliminated |
| `test_decision.py` | Weight sum = 1.0, aggressive vs conservative ordering differs |
| `test_recommendation.py` | Happy path, geocoding failure mid-pipeline, all-crops-eliminated |
| `test_chat_intent.py` | All three intents via LLM, all three via keyword fallback |
| `test_chat_modify.py` | Updates routed to correct object, pipeline reruns, version saved |
| `test_chat_question.py` | Pipeline does NOT rerun, chat history passed to LLM |
| `test_revert.py` | Via endpoint and via chat call same function, new version created |

---

## IMPLEMENTATION ORDER

```
1.  FastAPI app scaffold (main.py, config.py, database.py)
2.  Logging config + request_id middleware
3.  All schemas (input, climate, crop, suitability, price, decision, pipeline, plan, chat)
4.  ORM models + Alembic migration
5.  Seed crop data (run_seed.py, idempotent)
6.  Normalization pipeline (llm_service + unit_conversion + normalization_service)
7.  Geocoding service (Nominatim adapter)
8.  Altitude service (Open-Elevation or DEM)
9.  Climate adapter (raw HTTP → ClimateOutput) + climate_stub.json fixture
10. Suitability service (rules engine)
11. Hard constraint service (elimination gate)
12. Price placeholder service
13. Decision engine (scoring + plans)
14. Recommendation service (PipelineResult orchestration)
15. Recommendation endpoint (POST + GET + revert)
16. Explanation service (LLM + fallback template)
17. Plan versioning (save_version, get_current, revert — append-only)
18. Chat service (intent classification + Q&A + modification + revert routing)
19. Chat endpoint
20. Tests (all files above)
21. Dockerfile + README
```

---

## FINAL RULES FOR CODEX

```
DO NOT invent schemas beyond what is defined here
DO NOT skip the climate adapter layer
DO NOT use LLM for scoring or crop selection
DO NOT skip hard constraint filtering
DO NOT return unstructured errors or allow 500s
DO NOT mix architectural layers
DO NOT mutate existing plan version records
DO NOT populate UserPreferences during normalization
DO NOT put business logic in routes
DO NOT call the DB directly from services (use repositories)
```