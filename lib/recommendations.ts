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

export interface PriceResult {
  crop_id: string
  predicted_price: number
  confidence: string
  method: string
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
  ranked_crops: RankedCrop[]
  eliminated_crops: EliminationReason[]
  aggressive_plan?: CropPlan | null
  conservative_plan?: CropPlan | null
  explanation: string
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "")
const PLANS_BY_RUN_ID_KEY = "agriflow:plansByRunId"
const LATEST_RUN_ID_KEY = "agriflow:latestRunId"

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

function canUseStorage() {
  return typeof window !== "undefined"
}

function readPlansByRunId(): Record<string, RecommendationResponse> {
  if (!canUseStorage()) {
    return {}
  }

  const raw = window.localStorage.getItem(PLANS_BY_RUN_ID_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function writePlansByRunId(plansByRunId: Record<string, RecommendationResponse>) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(PLANS_BY_RUN_ID_KEY, JSON.stringify(plansByRunId))
}

export async function createRecommendation(payload: RecommendationCreatePayload) {
  return request<RecommendationResponse>("/api/v1/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getRecommendation(runId: string) {
  return request<RecommendationResponse>(`/api/v1/recommendations/${runId}`, {
    method: "GET",
  })
}

export function saveRecommendationPlan(plan: RecommendationResponse) {
  if (!plan.run_id || !canUseStorage()) {
    return
  }

  const plansByRunId = readPlansByRunId()
  plansByRunId[plan.run_id] = plan
  writePlansByRunId(plansByRunId)
  window.localStorage.setItem(LATEST_RUN_ID_KEY, plan.run_id)
}

export function getStoredRecommendationPlan(runId: string) {
  return readPlansByRunId()[runId] || null
}

export function getLatestRecommendationRunId() {
  if (!canUseStorage()) {
    return null
  }

  return window.localStorage.getItem(LATEST_RUN_ID_KEY)
}

export function saveLatestRecommendationRunId(runId: string) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(LATEST_RUN_ID_KEY, runId)
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
