import type { RecommendationCreatePayload, RecommendationResponse } from "@/lib/recommendations"

export type StrategyKey = "aggressive" | "conservative"

export interface OnboardingFormData {
  location: string
  coordinates: { lat: number; lng: number } | null
  farmSize: string
  farmLength: string
  farmWidth: string
  requiresDimensions: boolean
  budget: string
  soilType: string
}

export interface FarmDraft {
  formData: OnboardingFormData
  recommendationPayload: RecommendationCreatePayload
}

export interface SoilAssistantMessage {
  role: "user" | "bot"
  content: string
  type: "text" | "image"
  imageUrl?: string
}

export interface PlanAssistantMessage {
  role: "user" | "bot"
  content: string
}

export interface SelectedExecutionCrop {
  cropId: string
  cropName: string
  strategy: StrategyKey
}

export interface RecommendationVersionSnapshot {
  createdAt: string
  recommendation: RecommendationResponse
  selectedStrategy: StrategyKey
}

export interface AgriFlowWorkspace {
  schemaVersion: number
  createdAt: string
  updatedAt: string
  farmDraft: FarmDraft | null
  soilAssistantChat: SoilAssistantMessage[]
  currentRecommendation: RecommendationResponse | null
  recommendationVersions: RecommendationVersionSnapshot[]
  planAssistantChat: PlanAssistantMessage[]
  selectedStrategy: StrategyKey
  selectedExecutionCrop: SelectedExecutionCrop | null
}

const STORAGE_KEY = "agriflow.workspace.v1"
const SCHEMA_VERSION = 1

export function getDefaultSoilAssistantChat(): SoilAssistantMessage[] {
  return [
    {
      role: "bot",
      content:
        "Hi! I'm your Agritwin soil assistant. Describe your soil's texture, color, or behavior, or upload a photo to get help identifying it.",
      type: "text",
    },
  ]
}

export function getDefaultPlanAssistantChat(): PlanAssistantMessage[] {
  return [
    {
      role: "bot",
      content:
        "Hi! I'm your AgriFlow plan assistant. Ask me to tune this recommendation by changing budget, harvest speed, risk preference, or excluding crops.",
    },
  ]
}

export function resolvePreferredStrategy(
  recommendation: RecommendationResponse | null | undefined,
  fallback: StrategyKey = "aggressive",
): StrategyKey {
  const riskPreference = recommendation?.user_preferences?.risk_preference
  if (riskPreference === "low") {
    return "conservative"
  }
  if (riskPreference === "high") {
    return "aggressive"
  }
  return fallback
}

export function readWorkspace(): AgriFlowWorkspace | null {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    const normalized = normalizeWorkspace(parsed)
    if (!normalized) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return normalized
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearWorkspace() {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.removeItem(STORAGE_KEY)
}

export function writeWorkspace(workspace: AgriFlowWorkspace) {
  if (typeof window === "undefined") {
    return workspace
  }

  const normalized = normalizeWorkspace(workspace) ?? createEmptyWorkspace()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function updateWorkspace(
  updater: (workspace: AgriFlowWorkspace) => AgriFlowWorkspace,
) {
  const current = readWorkspace() ?? createEmptyWorkspace()
  return writeWorkspace(updater(current))
}

export function createWorkspaceFromRecommendation(options: {
  farmDraft: FarmDraft | null
  soilAssistantChat?: SoilAssistantMessage[]
  recommendation: RecommendationResponse
  selectedStrategy?: StrategyKey
}) {
  const selectedStrategy = resolvePreferredStrategy(options.recommendation, options.selectedStrategy)
  const currentRecommendation = normalizeRecommendation(options.recommendation, 1, false)

  return writeWorkspace({
    schemaVersion: SCHEMA_VERSION,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    farmDraft: options.farmDraft,
    soilAssistantChat: normalizeSoilAssistantChat(options.soilAssistantChat) ?? getDefaultSoilAssistantChat(),
    currentRecommendation,
    recommendationVersions: [
      {
        createdAt: timestamp(),
        recommendation: currentRecommendation,
        selectedStrategy,
      },
    ],
    planAssistantChat: getDefaultPlanAssistantChat(),
    selectedStrategy,
    selectedExecutionCrop: null,
  })
}

export function updateFarmDraft(farmDraft: FarmDraft | null) {
  return updateWorkspace((workspace) => ({
    ...workspace,
    farmDraft,
    updatedAt: timestamp(),
  }))
}

export function updateSoilAssistantChat(soilAssistantChat: SoilAssistantMessage[]) {
  return updateWorkspace((workspace) => ({
    ...workspace,
    soilAssistantChat: normalizeSoilAssistantChat(soilAssistantChat) ?? getDefaultSoilAssistantChat(),
    updatedAt: timestamp(),
  }))
}

export function updatePlanAssistantChat(planAssistantChat: PlanAssistantMessage[]) {
  return updateWorkspace((workspace) => ({
    ...workspace,
    planAssistantChat: normalizePlanAssistantChat(planAssistantChat) ?? getDefaultPlanAssistantChat(),
    updatedAt: timestamp(),
  }))
}

export function updateSelectedStrategy(selectedStrategy: StrategyKey) {
  return updateWorkspace((workspace) => ({
    ...workspace,
    selectedStrategy,
    updatedAt: timestamp(),
  }))
}

export function appendRecommendationVersion(
  recommendation: RecommendationResponse,
  selectedStrategy: StrategyKey,
) {
  return updateWorkspace((workspace) => {
    const currentVersions = workspace.recommendationVersions
    const nextVersionNumber = currentVersions.length + 1
    const normalizedRecommendation = normalizeRecommendation(
      recommendation,
      nextVersionNumber,
      currentVersions.length > 0,
    )
    const nextVersions = [
      ...currentVersions,
      {
        createdAt: timestamp(),
        recommendation: normalizedRecommendation,
        selectedStrategy,
      },
    ]

    return normalizeWorkspace({
      ...workspace,
      currentRecommendation: normalizedRecommendation,
      recommendationVersions: nextVersions,
      selectedStrategy,
      updatedAt: timestamp(),
    }) ?? createEmptyWorkspace()
  })
}

export function revertRecommendationVersion() {
  const workspace = readWorkspace()
  if (!workspace || workspace.recommendationVersions.length <= 1) {
    return workspace
  }

  const nextVersions = workspace.recommendationVersions.slice(0, -1)
  const previousSnapshot = nextVersions[nextVersions.length - 1]
  return writeWorkspace({
    ...workspace,
    currentRecommendation: previousSnapshot.recommendation,
    recommendationVersions: nextVersions,
    selectedStrategy: previousSnapshot.selectedStrategy,
    selectedExecutionCrop: null,
    updatedAt: timestamp(),
  })
}

export function updateSelectedExecutionCrop(selection: SelectedExecutionCrop | null) {
  return updateWorkspace((workspace) => ({
    ...workspace,
    selectedExecutionCrop: selection,
    updatedAt: timestamp(),
  }))
}

function createEmptyWorkspace(): AgriFlowWorkspace {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    farmDraft: null,
    soilAssistantChat: getDefaultSoilAssistantChat(),
    currentRecommendation: null,
    recommendationVersions: [],
    planAssistantChat: getDefaultPlanAssistantChat(),
    selectedStrategy: "aggressive",
    selectedExecutionCrop: null,
  }
}

function normalizeWorkspace(raw: unknown): AgriFlowWorkspace | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const candidate = raw as Partial<AgriFlowWorkspace>
  if (candidate.schemaVersion !== undefined && candidate.schemaVersion !== SCHEMA_VERSION) {
    return null
  }

  const selectedStrategy = normalizeStrategy(candidate.selectedStrategy) ?? "aggressive"
  const normalizedVersions = normalizeRecommendationVersions(candidate.recommendationVersions)
  const currentRecommendation =
    normalizedVersions.length > 0
      ? normalizedVersions[normalizedVersions.length - 1].recommendation
      : normalizeRecommendation(candidate.currentRecommendation, 1, false)

  const recommendationVersions =
    normalizedVersions.length > 0
      ? normalizedVersions
      : currentRecommendation
        ? [
            {
              createdAt: timestamp(),
              recommendation: currentRecommendation,
              selectedStrategy,
            },
          ]
        : []

  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : timestamp(),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : timestamp(),
    farmDraft: normalizeFarmDraft(candidate.farmDraft),
    soilAssistantChat: normalizeSoilAssistantChat(candidate.soilAssistantChat) ?? getDefaultSoilAssistantChat(),
    currentRecommendation:
      recommendationVersions.length > 0
        ? recommendationVersions[recommendationVersions.length - 1].recommendation
        : currentRecommendation,
    recommendationVersions,
    planAssistantChat:
      normalizePlanAssistantChat(candidate.planAssistantChat) ?? getDefaultPlanAssistantChat(),
    selectedStrategy:
      normalizeStrategy(candidate.selectedStrategy) ??
      (recommendationVersions.length > 0
        ? recommendationVersions[recommendationVersions.length - 1].selectedStrategy
        : selectedStrategy),
    selectedExecutionCrop: normalizeSelectedExecutionCrop(candidate.selectedExecutionCrop),
  }
}

function normalizeFarmDraft(raw: unknown): FarmDraft | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const candidate = raw as Partial<FarmDraft>
  if (!candidate.formData || !candidate.recommendationPayload) {
    return null
  }

  return {
    formData: {
      location: asString(candidate.formData.location),
      coordinates:
        candidate.formData.coordinates &&
        typeof candidate.formData.coordinates === "object" &&
        typeof candidate.formData.coordinates.lat === "number" &&
        typeof candidate.formData.coordinates.lng === "number"
          ? {
              lat: candidate.formData.coordinates.lat,
              lng: candidate.formData.coordinates.lng,
            }
          : null,
      farmSize: asString(candidate.formData.farmSize),
      farmLength: asString(candidate.formData.farmLength),
      farmWidth: asString(candidate.formData.farmWidth),
      requiresDimensions: Boolean(candidate.formData.requiresDimensions),
      budget: asString(candidate.formData.budget),
      soilType: asString(candidate.formData.soilType),
    },
    recommendationPayload: {
      area_text: candidate.recommendationPayload.area_text ?? null,
      budget_text: candidate.recommendationPayload.budget_text ?? null,
      location_text: candidate.recommendationPayload.location_text ?? null,
      notes: candidate.recommendationPayload.notes ?? null,
      soil_type_text: candidate.recommendationPayload.soil_type_text ?? null,
    },
  }
}

function normalizeRecommendationVersions(raw: unknown) {
  if (!Array.isArray(raw)) {
    return []
  }

  const normalized = raw
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null
      }

      const candidate = item as Partial<RecommendationVersionSnapshot>
      const recommendation = normalizeRecommendation(
        candidate.recommendation,
        index + 1,
        index > 0,
      )
      if (!recommendation) {
        return null
      }

      return {
        createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : timestamp(),
        recommendation,
        selectedStrategy: normalizeStrategy(candidate.selectedStrategy) ?? "aggressive",
      }
    })
    .filter((item): item is RecommendationVersionSnapshot => item !== null)

  return normalized.map((snapshot, index) => ({
    ...snapshot,
    recommendation: normalizeRecommendation(
      snapshot.recommendation,
      index + 1,
      index > 0,
    ) as RecommendationResponse,
  }))
}

function normalizeRecommendation(
  raw: unknown,
  versionNumber: number,
  hasPreviousVersion: boolean,
): RecommendationResponse | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const recommendation = raw as RecommendationResponse
  return {
    ...recommendation,
    run_id: null,
    version_number: versionNumber,
    has_previous_version: hasPreviousVersion,
  }
}

function normalizePlanAssistantChat(raw: unknown): PlanAssistantMessage[] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  const messages = raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null
      }

      const candidate = item as Partial<PlanAssistantMessage>
      if ((candidate.role !== "user" && candidate.role !== "bot") || typeof candidate.content !== "string") {
        return null
      }

      return {
        role: candidate.role,
        content: candidate.content,
      }
    })
    .filter((item): item is PlanAssistantMessage => item !== null)

  return messages.length > 0 ? messages : null
}

function normalizeSoilAssistantChat(raw: unknown): SoilAssistantMessage[] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  const messages = raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null
      }

      const candidate = item as Partial<SoilAssistantMessage>
      if ((candidate.role !== "user" && candidate.role !== "bot") || typeof candidate.content !== "string") {
        return null
      }
      if (candidate.type !== "text" && candidate.type !== "image") {
        return null
      }

      return {
        role: candidate.role,
        content: candidate.content,
        type: candidate.type,
        imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : undefined,
      }
    })
    .filter((item): item is SoilAssistantMessage => item !== null)

  return messages.length > 0 ? messages : null
}

function normalizeSelectedExecutionCrop(raw: unknown): SelectedExecutionCrop | null {
  if (!raw || typeof raw !== "object") {
    return null
  }

  const candidate = raw as Partial<SelectedExecutionCrop>
  const strategy = normalizeStrategy(candidate.strategy)
  if (!strategy) {
    return null
  }

  if (typeof candidate.cropId !== "string" || typeof candidate.cropName !== "string") {
    return null
  }

  return {
    cropId: candidate.cropId,
    cropName: candidate.cropName,
    strategy,
  }
}

function normalizeStrategy(value: unknown): StrategyKey | null {
  return value === "aggressive" || value === "conservative" ? value : null
}

function asString(value: unknown) {
  return typeof value === "string" ? value : ""
}

function timestamp() {
  return new Date().toISOString()
}
