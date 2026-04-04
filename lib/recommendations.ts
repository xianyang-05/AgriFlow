export interface RecommendationCreatePayload {
  area_text: string | null
  budget_text: string | null
  location_text: string | null
  notes: string | null
  soil_type_text: string | null
}

export interface NormalizedFarmInput {
  area_m2?: number | null
  budget_myr?: number | null
  latitude?: number | null
  longitude?: number | null
  altitude_m?: number | null
  target_month?: number | null
  forecast_horizon_months?: number | null
  extraction_confidence?: number
  clarification_needed?: boolean
  clarification_questions?: string[]
  location_text?: string | null
  soil_type?: string | null
}

export interface UserPreferences {
  preferred_crops: string[]
  excluded_crops: string[]
  risk_preference?: string | null
  harvest_preference?: string | null
  notes?: string | null
}

export interface PriceResult {
  crop_id: string
  current_price: number
  predicted_price: number
  pct_change: number
  trend: "UP" | "STABLE" | "DOWN"
  confidence: string
  method: string
}

export interface ForecastBlock {
  horizon_months: number
  predicted_rain_mm: number
  rain_p10: number
  rain_p50: number
  rain_p90: number
  dry_risk: number
  normal_risk: number
  wet_risk: number
  top_analog_years: number[]
}

export interface ClimateOutput {
  model_type: string
  request_location: {
    lat: number
    lon: number
  }
  target_month: number
  forecast_horizon_months: number
  forecast_blocks: ForecastBlock[]
}

export interface ScoreBreakdown {
  suitability_score: number
  climate_score: number
  budget_fit_score: number
  price_score: number
  duration_fit_score: number
}

export interface RankedCrop {
  crop_id: string
  crop_name: string
  aggressive_score: number
  conservative_score: number
  reward_score?: number
  risk_score?: number
  score_breakdown: ScoreBreakdown
  price_result: PriceResult
  growth_days: number
}

export interface CropPlan {
  strategy: string
  top_crop: RankedCrop
  rationale: string
}

export interface EliminationReason {
  crop_id: string
  reason: string
}

export interface RecommendationResponse {
  status: "complete" | "incomplete" | "no_viable_crops"
  clarification_needed: boolean
  clarification_questions: string[]
  warnings: string[]
  run_id: string | null
  version_number?: number | null
  normalized_input?: NormalizedFarmInput | null
  user_preferences?: UserPreferences
  ranked_crops: RankedCrop[]
  eliminated_crops: EliminationReason[]
  aggressive_plan?: CropPlan | null
  conservative_plan?: CropPlan | null
  explanation: string
}

export interface RecommendationChatResponse {
  run_id: string
  intent: "question" | "modification" | "revert"
  confidence: number
  assistant_message: string
  updated_recommendation: RecommendationResponse | null
  has_previous_version: boolean
  status: RecommendationResponse["status"]
  clarification_needed: boolean
  clarification_questions: string[]
  warnings: string[]
}

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || (process.env.VERCEL ? "/server" : "http://localhost:8000")
).replace(/\/+$/, "")

class RecommendationApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "RecommendationApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const payload = await response.json()
      if (typeof payload?.detail === "string" && payload.detail.trim()) {
        message = payload.detail
      }
    } catch {
      // Keep the default message when the response body is not JSON.
    }

    throw new RecommendationApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export async function createRecommendation(payload: RecommendationCreatePayload) {
  return request<RecommendationResponse>("/api/v1/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function createPreviewRecommendation(payload: RecommendationCreatePayload) {
  return request<RecommendationResponse>("/api/v1/recommendations/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getRecommendation(runId: string) {
  return request<RecommendationResponse>(`/api/v1/recommendations/${runId}`, {
    method: "GET",
  })
}

export async function sendRecommendationChatMessage(runId: string, message: string) {
  return request<RecommendationChatResponse>("/api/v1/chat", {
    method: "POST",
    body: JSON.stringify({
      run_id: runId,
      message,
    }),
  })
}

export async function sendPreviewRecommendationChatMessage(
  currentRecommendation: RecommendationResponse,
  message: string,
) {
  return request<RecommendationChatResponse>("/api/v1/chat/preview", {
    method: "POST",
    body: JSON.stringify({
      message,
      current_recommendation: currentRecommendation,
    }),
  })
}

export function getRecommendationErrorMessage(error: unknown) {
  if (error instanceof RecommendationApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong while contacting the recommendation service."
}
