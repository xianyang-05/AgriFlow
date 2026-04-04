"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import PaddyFieldLoadingScreen from "@/components/PaddyFieldLoadingScreen"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Leaf,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Droplets,
  CloudRain,
  ThermometerSun,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  Clock3,
  Wheat,
  Apple,
  Carrot,
  LayoutDashboard,
  AlertCircle,
  Bot,
  User,
  Send,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  createPreviewRecommendation,
  type ClimateOutput,
  type ForecastBlock,
  getRecommendationErrorMessage,
  sendPreviewRecommendationChatMessage,
  type RecommendationCreatePayload,
  type RankedCrop,
  type RecommendationResponse,
} from "@/lib/recommendations"
import {
  appendRecommendationVersion,
  createWorkspaceFromRecommendation,
  getDefaultPlanAssistantChat,
  readWorkspace,
  resolvePreferredStrategy,
  revertRecommendationVersion,
  type OnboardingFormData,
  type PlanAssistantMessage,
  type StrategyKey,
  updatePlanAssistantChat,
  updateSelectedExecutionCrop,
  updateSelectedStrategy,
} from "@/lib/local-workspace"

const marketData = [
  { month: "Jan", wheat: 280, rice: 320, corn: 180, vegetables: 420, tomato: 510 },
  { month: "Feb", wheat: 300, rice: 310, corn: 190, vegetables: 400, tomato: 535 },
  { month: "Mar", wheat: 290, rice: 340, corn: 200, vegetables: 450, tomato: 590 },
  { month: "Apr", wheat: 320, rice: 350, corn: 220, vegetables: 480, tomato: 640 },
  { month: "May", wheat: 340, rice: 380, corn: 240, vegetables: 520, tomato: 710 },
  { month: "Jun", wheat: 360, rice: 400, corn: 260, vegetables: 550, tomato: 760 },
]

type CropIcon = typeof Wheat

interface StrategyRecommendationCard {
  strategy: StrategyKey
  strategyLabel: string
  cropId: string
  cropName: string
  topCrop: RankedCrop
  icon: CropIcon
  iconColor: string
  iconBg: string
  score: number
  price: string
  growthCycle: string
  rationale: string
  explanationMetrics: StrategyMetric[]
}

type MetricKey = Extract<keyof RankedCrop["score_breakdown"], string>

interface StrategyMetric {
  metric: MetricKey
  label: string
  weight: number
  score: number
  signal: string
  summary: string
  effect?: string
  tone?: "strong" | "medium" | "weak"
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value)
}

function getMetricTone(score: number): "strong" | "medium" | "weak" {
  if (score >= 0.75) {
    return "strong"
  }
  if (score >= 0.45) {
    return "medium"
  }
  return "weak"
}

function getCropInfo(cropId: string, cropName: string): { icon: CropIcon, color: string, bg: string } {
  const key = `${cropId} ${cropName}`.toLowerCase()

  if (key.includes("maize") || key.includes("corn") || key.includes("wheat") || key.includes("rice")) {
    return { icon: Wheat, color: "text-amber-600", bg: "bg-amber-100" }
  }
  if (key.includes("chili") || key.includes("okra") || key.includes("bean") || key.includes("carrot")) {
    return { icon: Carrot, color: "text-orange-600", bg: "bg-orange-100" }
  }
  if (key.includes("eggplant") || key.includes("cucumber") || key.includes("tomato") || key.includes("apple")) {
    return { icon: Apple, color: "text-red-600", bg: "bg-red-100" }
  }

  return { icon: Leaf, color: "text-emerald-600", bg: "bg-emerald-100" }
}

function getRewardScore(crop: RankedCrop) {
  return crop.reward_score ?? crop.aggressive_score
}

function getRiskScore(crop: RankedCrop) {
  if (typeof crop.risk_score === "number") {
    return crop.risk_score
  }
  return Math.max(0, Math.min(1, 1 - crop.conservative_score))
}

function pickHighestRewardCrop(crops: RankedCrop[]) {
  return [...crops].sort((left, right) => {
    const rewardDelta = getRewardScore(right) - getRewardScore(left)
    if (rewardDelta !== 0) {
      return rewardDelta
    }
    return getRiskScore(left) - getRiskScore(right)
  })[0]
}

function pickLowestRiskCrop(crops: RankedCrop[], excludeCropId?: string) {
  const pool = crops.filter((crop) => crop.crop_id !== excludeCropId)
  const candidates = pool.length > 0 ? pool : crops

  return [...candidates].sort((left, right) => {
    const riskDelta = getRiskScore(left) - getRiskScore(right)
    if (riskDelta !== 0) {
      return riskDelta
    }
    return getRewardScore(right) - getRewardScore(left)
  })[0]
}

const STRATEGY_WEIGHTS: Record<StrategyKey, Record<keyof RankedCrop["score_breakdown"], number>> = {
  aggressive: {
    price_score: 0.55,
    suitability_score: 0.2,
    budget_fit_score: 0.1,
    climate_score: 0.1,
    duration_fit_score: 0.05,
  },
  conservative: {
    climate_score: 0.4,
    suitability_score: 0.3,
    budget_fit_score: 0.15,
    price_score: 0.1,
    duration_fit_score: 0.05,
  },
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`
}

function selectForecastBlock(
  climateOutput: ClimateOutput | null | undefined,
  crop: RankedCrop,
): ForecastBlock | null {
  if (!climateOutput?.forecast_blocks?.length) {
    return null
  }

  const targetHorizon = Math.max(1, Math.round(crop.growth_days / 30))
  return [...climateOutput.forecast_blocks].sort(
    (left, right) =>
      Math.abs(left.horizon_months - targetHorizon) - Math.abs(right.horizon_months - targetHorizon),
  )[0]
}

function describeClimateSignal(block: ForecastBlock | null) {
  if (!block) {
    return {
      signal: "Forecast unavailable",
      summary: "Climate data was not available for this crop window.",
    }
  }

  if (block.wet_risk >= block.dry_risk && block.wet_risk >= block.normal_risk) {
    return {
      signal: `Future rain leans wet: ${(block.wet_risk * 100).toFixed(0)}% wet risk`,
      summary: `${block.predicted_rain_mm.toFixed(0)}mm rain is expected, so flood pressure is higher for sensitive crops.`,
    }
  }

  if (block.dry_risk >= block.wet_risk && block.dry_risk >= block.normal_risk) {
    return {
      signal: `Future rain leans dry: ${(block.dry_risk * 100).toFixed(0)}% dry risk`,
      summary: `${block.predicted_rain_mm.toFixed(0)}mm rain is expected, so drought stress matters more for sensitive crops.`,
    }
  }

  return {
    signal: `Future rain stays near normal: ${(block.normal_risk * 100).toFixed(0)}% normal risk`,
    summary: `${block.predicted_rain_mm.toFixed(0)}mm rain is expected, which is a steadier climate signal.`,
  }
}

function buildPriceMetric(strategy: StrategyKey, crop: RankedCrop): StrategyMetric {
  const trendSignal =
    crop.price_result.trend === "UP"
      ? "Future trend up"
      : crop.price_result.trend === "DOWN"
        ? "Future trend down"
        : "Future trend stable"

  return {
    metric: "price_score",
    label: "Price",
    weight: STRATEGY_WEIGHTS[strategy].price_score,
    score: crop.score_breakdown.price_score,
    signal: `${trendSignal}: ${formatSignedPercent(crop.price_result.pct_change)}`,
    summary: `RM ${crop.price_result.current_price.toFixed(2)} now, RM ${crop.price_result.predicted_price.toFixed(2)} predicted.`,
  }
}

function buildClimateMetric(
  strategy: StrategyKey,
  crop: RankedCrop,
  recommendation: RecommendationResponse | null,
): StrategyMetric {
  const climateSignal = describeClimateSignal(selectForecastBlock(recommendation?.climate_output, crop))

  return {
    metric: "climate_score",
    label: "Climate",
    weight: STRATEGY_WEIGHTS[strategy].climate_score,
    score: crop.score_breakdown.climate_score,
    signal: climateSignal.signal,
    summary: climateSignal.summary,
  }
}

function buildBudgetMetric(strategy: StrategyKey, crop: RankedCrop): StrategyMetric {
  const tone = getMetricTone(crop.score_breakdown.budget_fit_score)

  return {
    metric: "budget_fit_score",
    label: "Budget",
    weight: STRATEGY_WEIGHTS[strategy].budget_fit_score,
    score: crop.score_breakdown.budget_fit_score,
    signal: `Budget-fit score: ${(crop.score_breakdown.budget_fit_score * 100).toFixed(0)} / 100`,
    summary: "This reflects how much financial headroom remains after the crop’s minimum cost profile.",
    effect:
      strategy === "conservative"
        ? "Budget still matters in the safer plan because expensive crops can add execution risk."
        : "Budget matters less than price upside here, but weak headroom still drags the score.",
    tone,
  }
}

function buildSuitabilityMetric(strategy: StrategyKey, crop: RankedCrop): StrategyMetric {
  const tone = getMetricTone(crop.score_breakdown.suitability_score)

  return {
    metric: "suitability_score",
    label: "Suitability",
    weight: STRATEGY_WEIGHTS[strategy].suitability_score,
    score: crop.score_breakdown.suitability_score,
    signal:
      crop.score_breakdown.suitability_score >= 1
        ? "Baseline agronomic fit is strong"
        : crop.score_breakdown.suitability_score >= 0.6
          ? "Baseline agronomic fit is marginal"
          : "Baseline agronomic fit is weak",
    summary: "This captures whether the crop broadly matches the farm and forecast constraints before ranking strategy is applied.",
    effect:
      strategy === "conservative"
        ? "This is one of the largest safety weights, so poor fit is costly."
        : "This remains important, but it supports upside rather than defining the plan on its own.",
    tone,
  }
}

function buildDurationMetric(
  strategy: StrategyKey,
  crop: RankedCrop,
  recommendation: RecommendationResponse | null,
): StrategyMetric {
  const tone = getMetricTone(crop.score_breakdown.duration_fit_score)
  const harvestPreference = recommendation?.user_preferences?.harvest_preference

  return {
    metric: "duration_fit_score",
    label: "Harvest Speed",
    weight: STRATEGY_WEIGHTS[strategy].duration_fit_score,
    score: crop.score_breakdown.duration_fit_score,
    signal: `Growth cycle: ${crop.growth_days} days`,
    summary: harvestPreference
      ? `The user preference is set to ${harvestPreference}, so crop duration is being scored directly.`
      : "No harvest-speed preference was set, so duration is mostly neutral.",
    effect:
      strategy === "aggressive"
        ? "This can help separate upside crops, but it is still a smaller signal than price."
        : "This is a minor tiebreaker in the conservative plan.",
    tone,
  }
}

function buildPriceMetricCompact(strategy: StrategyKey, crop: RankedCrop): StrategyMetric {
  const trendSignal =
    crop.price_result.trend === "UP"
      ? "Future trend up"
      : crop.price_result.trend === "DOWN"
        ? "Future trend down"
        : "Future trend stable"

  return {
    metric: "price_score",
    label: "Price",
    weight: STRATEGY_WEIGHTS[strategy].price_score,
    score: crop.score_breakdown.price_score,
    signal: `${trendSignal}: ${formatSignedPercent(crop.price_result.pct_change)}`,
    summary: `RM ${crop.price_result.current_price.toFixed(2)} now, RM ${crop.price_result.predicted_price.toFixed(2)} predicted.`,
  }
}

function buildClimateMetricCompact(
  strategy: StrategyKey,
  crop: RankedCrop,
  recommendation: RecommendationResponse | null,
): StrategyMetric {
  const climateSignal = describeClimateSignal(selectForecastBlock(recommendation?.climate_output, crop))

  return {
    metric: "climate_score",
    label: "Climate",
    weight: STRATEGY_WEIGHTS[strategy].climate_score,
    score: crop.score_breakdown.climate_score,
    signal: climateSignal.signal,
    summary: climateSignal.summary,
  }
}

function buildBudgetMetricCompact(strategy: StrategyKey, crop: RankedCrop): StrategyMetric {
  return {
    metric: "budget_fit_score",
    label: "Budget",
    weight: STRATEGY_WEIGHTS[strategy].budget_fit_score,
    score: crop.score_breakdown.budget_fit_score,
    signal: `Budget coverage: ${(crop.score_breakdown.budget_fit_score * 100).toFixed(0)}%`,
    summary: "Higher means the budget can cover more of the crop's minimum cost.",
  }
}

function buildSuitabilityMetricCompact(strategy: StrategyKey, crop: RankedCrop): StrategyMetric {
  return {
    metric: "suitability_score",
    label: "Suitability",
    weight: STRATEGY_WEIGHTS[strategy].suitability_score,
    score: crop.score_breakdown.suitability_score,
    signal:
      crop.score_breakdown.suitability_score >= 1
        ? "Baseline agronomic fit is strong"
        : crop.score_breakdown.suitability_score >= 0.6
          ? "Baseline agronomic fit is marginal"
          : "Baseline agronomic fit is weak",
    summary: "Higher means the crop fits the farm and forecast conditions better.",
  }
}

function buildDurationMetricCompact(strategy: StrategyKey, crop: RankedCrop): StrategyMetric {
  return {
    metric: "duration_fit_score",
    label: "Harvest Speed",
    weight: STRATEGY_WEIGHTS[strategy].duration_fit_score,
    score: crop.score_breakdown.duration_fit_score,
    signal: `Growth cycle: ${crop.growth_days} days`,
    summary: "Shorter growth cycles score higher.",
  }
}

function buildStrategyExplanationMetrics(
  strategy: StrategyKey,
  crop: RankedCrop,
  recommendation: RecommendationResponse | null,
) {
  const metrics: StrategyMetric[] = [
    buildPriceMetricCompact(strategy, crop),
    buildClimateMetricCompact(strategy, crop, recommendation),
    buildSuitabilityMetricCompact(strategy, crop),
    buildBudgetMetricCompact(strategy, crop),
    buildDurationMetricCompact(strategy, crop),
  ]

  return metrics.sort((left, right) => (right.score * right.weight) - (left.score * left.weight))
}

function getMetricIcon(metric: MetricKey) {
  switch (metric) {
    case "price_score":
      return TrendingUp
    case "climate_score":
      return CloudRain
    case "budget_fit_score":
      return Wallet
    case "duration_fit_score":
      return Clock3
    case "suitability_score":
    default:
      return CheckCircle2
  }
}

function buildStrategyCards(recommendation: RecommendationResponse | null): StrategyRecommendationCard[] {
  if (!recommendation) {
    return []
  }

  const rankedCrops = recommendation.ranked_crops || []
  const aggressiveCrop =
    recommendation.aggressive_plan?.top_crop || pickHighestRewardCrop(rankedCrops) || null
  const conservativeCrop =
    recommendation.conservative_plan?.top_crop ||
    pickLowestRiskCrop(rankedCrops, aggressiveCrop?.crop_id) ||
    null

  const plans = [
    aggressiveCrop
      ? {
          strategy: "aggressive" as const,
          topCrop: aggressiveCrop,
          rationale:
            recommendation.aggressive_plan?.rationale ||
            "Selected for the highest reward potential, prioritizing faster harvests and stronger upside.",
        }
      : null,
    conservativeCrop
      ? {
          strategy: "conservative" as const,
          topCrop: conservativeCrop,
          rationale:
            recommendation.conservative_plan?.rationale ||
            "Selected for the lowest overall risk, prioritizing climate stability and dependable fit.",
        }
      : null,
  ].filter((plan): plan is NonNullable<typeof plan> => plan !== null)

  if (!plans.length) {
    return []
  }

  return plans.map((plan) => {
    const strategy = plan.strategy
    const cropInfo = getCropInfo(plan.topCrop.crop_id, plan.topCrop.crop_name)

    return {
      strategy,
      strategyLabel: strategy === "aggressive" ? "Aggressive Plan" : "Conservative Plan",
      cropId: plan.topCrop.crop_id,
      cropName: plan.topCrop.crop_name,
      topCrop: plan.topCrop,
      icon: cropInfo.icon,
      iconColor: cropInfo.color,
      iconBg: cropInfo.bg,
      score: strategy === "aggressive" ? plan.topCrop.aggressive_score : plan.topCrop.conservative_score,
      price: formatCurrency(plan.topCrop.price_result.predicted_price),
      growthCycle: `${plan.topCrop.growth_days} days`,
      rationale: plan.rationale,
      explanationMetrics: buildStrategyExplanationMetrics(strategy, plan.topCrop, recommendation),
    }
  })
}

function getLocationLabel(recommendation: RecommendationResponse | null) {
  const normalized = recommendation?.normalized_input
  if (!normalized) {
    return ""
  }
  if (normalized.location_text) {
    return normalized.location_text
  }
  if (normalized.latitude != null && normalized.longitude != null) {
    return `${normalized.latitude.toFixed(4)}, ${normalized.longitude.toFixed(4)}`
  }
  return ""
}

function parseCoordinatesFromText(locationText: string | null) {
  if (!locationText) {
    return null
  }

  const match = locationText.match(
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  )
  if (!match) {
    return null
  }

  return {
    lat: Number.parseFloat(match[1]),
    lng: Number.parseFloat(match[2]),
  }
}

function buildDraftPayloadFromSearchParams(params: {
  areaText: string | null
  budgetText: string | null
  locationText: string | null
  soilTypeText: string | null
}): RecommendationCreatePayload | null {
  if (!params.areaText && !params.budgetText && !params.locationText && !params.soilTypeText) {
    return null
  }

  return {
    area_text: params.areaText,
    budget_text: params.budgetText,
    location_text: params.locationText,
    notes: null,
    soil_type_text: params.soilTypeText,
  }
}

function buildFallbackFormData(payload: RecommendationCreatePayload): OnboardingFormData {
  return {
    location: payload.location_text ?? "",
    coordinates: parseCoordinatesFromText(payload.location_text),
    farmSize: payload.area_text ?? "",
    farmLength: "",
    farmWidth: "",
    requiresDimensions: false,
    budget: payload.budget_text ?? "",
    soilType: payload.soil_type_text ?? "",
  }
}

function getMockSeriesKey(cropId: string) {
  const key = cropId.toLowerCase()

  if (key.includes("rice")) {
    return "rice"
  }
  if (key.includes("tomato")) {
    return "tomato"
  }
  if (
    key.includes("chili") ||
    key.includes("okra") ||
    key.includes("eggplant") ||
    key.includes("cucumber") ||
    key.includes("spinach") ||
    key.includes("kangkung") ||
    key.includes("bean")
  ) {
    return "vegetables"
  }
  return "wheat"
}

function PlanningPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftAreaText = searchParams.get("area_text")
  const draftBudgetText = searchParams.get("budget_text")
  const draftLocationText = searchParams.get("location_text")
  const draftSoilTypeText = searchParams.get("soil_type_text")
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>("aggressive")
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<PlanAssistantMessage[]>(getDefaultPlanAssistantChat())
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false)
  const [hasHydratedWorkspace, setHasHydratedWorkspace] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isActive = true

    const loadRecommendation = async () => {
      setIsLoading(true)
      setLoadError(null)

      const workspace = readWorkspace()
      const draftPayload =
        workspace?.farmDraft?.recommendationPayload ??
        buildDraftPayloadFromSearchParams({
          areaText: draftAreaText,
          budgetText: draftBudgetText,
          locationText: draftLocationText,
          soilTypeText: draftSoilTypeText,
        })

      if (workspace?.currentRecommendation) {
        if (isActive) {
          setRecommendation(workspace.currentRecommendation)
          setSelectedStrategy(workspace.selectedStrategy)
          setChatMessages(
            workspace.planAssistantChat.length > 0
              ? workspace.planAssistantChat
              : getDefaultPlanAssistantChat(),
          )
          setIsLoading(false)
          setHasHydratedWorkspace(true)
        }
        return
      }

      if (!draftPayload) {
        if (isActive) {
          setRecommendation(null)
          setIsLoading(false)
          setLoadError("No local plan was found on this device. Generate a plan from the onboarding flow first.")
          setHasHydratedWorkspace(true)
        }
        router.replace("/")
        return
      }

      try {
        const nextRecommendation = await createPreviewRecommendation(draftPayload)
        const nextWorkspace = createWorkspaceFromRecommendation({
          farmDraft:
            workspace?.farmDraft ??
            {
              formData: buildFallbackFormData(draftPayload),
              recommendationPayload: draftPayload,
            },
          soilAssistantChat: workspace?.soilAssistantChat,
          recommendation: nextRecommendation,
          selectedStrategy: resolvePreferredStrategy(
            nextRecommendation,
            workspace?.selectedStrategy ?? "aggressive",
          ),
        })

        if (!isActive) {
          return
        }

        setRecommendation(nextWorkspace.currentRecommendation)
        setSelectedStrategy(nextWorkspace.selectedStrategy)
        setChatMessages(nextWorkspace.planAssistantChat)
        setIsLoading(false)
        setHasHydratedWorkspace(true)
      } catch (error) {
        if (isActive) {
          setRecommendation(null)
          setIsLoading(false)
          setLoadError(getRecommendationErrorMessage(error))
          setHasHydratedWorkspace(true)
        }
      }
    }

    loadRecommendation()

    return () => {
      isActive = false
    }
  }, [draftAreaText, draftBudgetText, draftLocationText, draftSoilTypeText, router])

  useEffect(() => {
    if (!hasHydratedWorkspace || !recommendation) {
      return
    }

    updateSelectedStrategy(selectedStrategy)
  }, [hasHydratedWorkspace, recommendation, selectedStrategy])

  useEffect(() => {
    if (!hasHydratedWorkspace || !recommendation) {
      return
    }

    updatePlanAssistantChat(chatMessages)
  }, [chatMessages, hasHydratedWorkspace, recommendation])

  useEffect(() => {
    const availableStrategies = buildStrategyCards(recommendation).map((card) => card.strategy)
    if (!availableStrategies.length) {
      return
    }

    if (!availableStrategies.includes(selectedStrategy)) {
      setSelectedStrategy(availableStrategies[0])
    }
  }, [recommendation, selectedStrategy])

  useEffect(() => {
    const riskPreference = recommendation?.user_preferences?.risk_preference
    if (riskPreference === "low") {
      setSelectedStrategy("conservative")
      return
    }
    if (riskPreference === "high") {
      setSelectedStrategy("aggressive")
    }
  }, [recommendation?.user_preferences?.risk_preference])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handlePlanAssistantSubmit = async (messageOverride?: string) => {
    const outgoingMessage = (messageOverride ?? chatInput).trim()
    if (!outgoingMessage || !recommendation) {
      return
    }

    setChatInput("")
    const nextUserMessages = [...chatMessages, { role: "user" as const, content: outgoingMessage }]
    setChatMessages(nextUserMessages)
    setIsChatLoading(true)

    try {
      const localVersionCount = readWorkspace()?.recommendationVersions.length ?? 0
      const response = await sendPreviewRecommendationChatMessage(
        recommendation,
        outgoingMessage,
        localVersionCount > 1,
      )
      const nextChatMessages = [
        ...nextUserMessages,
        {
          role: "bot" as const,
          content: response.assistant_message,
        },
      ]

      if (response.should_revert_locally) {
        const revertedWorkspace = revertRecommendationVersion()
        if (revertedWorkspace?.currentRecommendation) {
          setRecommendation(revertedWorkspace.currentRecommendation)
          setSelectedStrategy(revertedWorkspace.selectedStrategy)
        }
      } else if (response.intent === "modification" && response.updated_recommendation) {
        const nextStrategy = resolvePreferredStrategy(response.updated_recommendation, selectedStrategy)
        const updatedWorkspace = appendRecommendationVersion(response.updated_recommendation, nextStrategy)
        setRecommendation(updatedWorkspace.currentRecommendation)
        setSelectedStrategy(updatedWorkspace.selectedStrategy)
      }

      setChatMessages(nextChatMessages)
      updatePlanAssistantChat(nextChatMessages)
    } catch (error) {
      const nextChatMessages = [
        ...nextUserMessages,
        {
          role: "bot" as const,
          content: getRecommendationErrorMessage(error),
        },
      ]
      setChatMessages(nextChatMessages)
      updatePlanAssistantChat(nextChatMessages)
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleGenerateExecutionPlan = async () => {
    if (!selectedRecommendation) {
      return
    }

    updateSelectedExecutionCrop({
      cropId: selectedRecommendation.cropId,
      cropName: selectedRecommendation.cropName,
      strategy: selectedRecommendation.strategy,
    })
    router.push(`/execution-plan?crop=${encodeURIComponent(selectedRecommendation.cropName)}`)
  }

  const strategyRecommendations = buildStrategyCards(recommendation)
  const selectedRecommendation =
    strategyRecommendations.find((card) => card.strategy === selectedStrategy) || strategyRecommendations[0]
  const hasRecommendationData =
    recommendation?.status === "complete" && strategyRecommendations.length > 0
  const locationLabel = getLocationLabel(recommendation)
  const mockSeriesKey = getMockSeriesKey(selectedRecommendation?.cropId || "wheat")

  if (isLoading) {
    return <PaddyFieldLoadingScreen />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className={`border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 transition-all ${isAssistantExpanded ? "hidden" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground">AgriFlow</span>
          </Link>
          <Button onClick={() => router.push("/dashboard")} className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Smart Planning</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered recommendations based on your farm profile
            {locationLabel && ` in ${locationLabel}`}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Plan unavailable</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {recommendation?.status === "incomplete" && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>More details are needed</AlertTitle>
              <AlertDescription>
                <p>We saved your draft plan, but the backend needs clarification before ranking crops.</p>
                {recommendation.clarification_questions.length > 0 && (
                  <ul className="list-disc pl-5 mt-2">
                    {recommendation.clarification_questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {recommendation?.status === "no_viable_crops" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No viable crops matched this plan</AlertTitle>
              <AlertDescription>
                <p>Try adjusting area, budget, location, or soil type and generate a new recommendation.</p>
                {recommendation.eliminated_crops.length > 0 && (
                  <ul className="list-disc pl-5 mt-2">
                    {recommendation.eliminated_crops.map((item) => (
                      <li key={`${item.crop_id}-${item.reason}`}>
                        {item.crop_id}: {item.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!!recommendation?.warnings.length && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Recommendation warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5">
                  {recommendation.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {hasRecommendationData ? (
              <>
                <Card className="shadow-lg shadow-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Leaf className="h-5 w-5 text-primary" />
                      Crop Recommendations
                    </CardTitle>
                    <CardDescription>
                      Compare the highest-reward and lowest-risk recommendations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {strategyRecommendations.map((card) => {
                        const CropIconComp = card.icon
                        const isSelected = selectedRecommendation?.strategy === card.strategy

                        return (
                          <button
                            key={card.strategy}
                            onClick={() => setSelectedStrategy(card.strategy)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${
                                isSelected ? card.iconBg : "bg-muted"
                              }`}>
                                <CropIconComp className={`h-6 w-6 ${isSelected ? card.iconColor : "text-muted-foreground"}`} />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                                {card.strategyLabel}
                              </p>
                              <h3 className="font-semibold text-foreground mt-1">{card.cropName}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mt-3">
                              {card.rationale}
                            </p>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Growth Cycle</p>
                                <p className="text-sm font-medium text-foreground">{card.growthCycle}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Est. Price</p>
                                <p className="text-sm font-medium text-primary">{card.price}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Score</p>
                                <p className="text-sm font-medium text-foreground">
                                  {(card.score * 100).toFixed(0)} / 100
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-border/60">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                                Why This Crop Won
                              </p>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {card.rationale}
                              </p>
                              <div className="mt-4 space-y-3">
                                {card.explanationMetrics.map((item) => {
                                  const MetricIcon = getMetricIcon(item.metric)

                                  return (
                                    <div
                                      key={`${card.strategy}-${item.metric}`}
                                      className="rounded-2xl border border-border bg-muted/30 p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                          <div className="rounded-xl bg-primary/10 p-2">
                                            <MetricIcon className="h-4 w-4 text-primary" />
                                          </div>
                                          <div>
                                            <p className="text-sm font-semibold text-foreground">
                                              {item.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Score {(item.score * 100).toFixed(0)} / 100
                                            </p>
                                          </div>
                                        </div>
                                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                          {Math.round(item.weight * 100)}% weight
                                        </span>
                                      </div>

                                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            item.score >= 0.75 ? "bg-green-500" : item.score >= 0.45 ? "bg-orange-500" : "bg-red-500"
                                          }`}
                                          style={{ width: `${Math.max(8, Math.round(item.score * 100))}%` }}
                                        />
                                      </div>

                                      <div className="mt-4 space-y-2">
                                        <p className="text-sm font-medium text-foreground">{item.signal}</p>
                                        <p className="text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-lg shadow-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Scenario Simulation
                    </CardTitle>
                    <CardDescription>
                      Mock projections for {selectedRecommendation?.cropName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="yield" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="yield">Yield</TabsTrigger>
                        <TabsTrigger value="risk">Risk</TabsTrigger>
                      </TabsList>
                      <TabsContent value="yield" className="space-y-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={marketData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis dataKey="month" className="text-xs" />
                              <YAxis className="text-xs" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "var(--color-card)",
                                  borderColor: "var(--color-border)",
                                  borderRadius: "8px",
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey={mockSeriesKey}
                                stroke="var(--color-chart-2)"
                                strokeWidth={2}
                                dot={{ fill: "var(--color-chart-2)" }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Current Recommendation Snapshot</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {selectedRecommendation?.cropName} leads the {selectedRecommendation?.strategyLabel.toLowerCase()}
                            {" "}with a {selectedRecommendation?.growthCycle.toLowerCase()} and an estimated price of {selectedRecommendation?.price}.
                          </p>
                        </div>
                      </TabsContent>
                      <TabsContent value="risk" className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl border border-border">
                            <div className="flex items-center gap-2 mb-3">
                              <Droplets className="h-4 w-4 text-info" />
                              <span className="text-sm font-medium">Water Risk</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-info rounded-full" style={{ width: "45%" }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Medium requirement</p>
                          </div>
                          <div className="p-4 rounded-xl border border-border">
                            <div className="flex items-center gap-2 mb-3">
                              <ThermometerSun className="h-4 w-4 text-warning" />
                              <span className="text-sm font-medium">Climate Risk</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-warning rounded-full" style={{ width: "35%" }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Low heat stress risk</p>
                          </div>
                          <div className="p-4 rounded-xl border border-border">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                              <span className="text-sm font-medium">Pest Risk</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-destructive rounded-full" style={{ width: "25%" }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Low pest pressure</p>
                          </div>
                          <div className="p-4 rounded-xl border border-border">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingDown className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Market Risk</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-muted-foreground rounded-full" style={{ width: "40%" }} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Stable market prices</p>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-lg shadow-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-primary" />
                    Crop Recommendations
                  </CardTitle>
                  <CardDescription>
                    Recommendation-specific content will appear here after a complete plan is available.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 rounded-xl border border-dashed border-border bg-muted/30">
                    <p className="text-sm text-muted-foreground">
                      Generate or refine your plan first. We only show ranked crops when the backend returns
                      a complete recommendation.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 h-fit">
            <Card className={`shadow-xl shadow-primary/5 border-border/50 flex flex-col transition-all duration-300 ${
              isAssistantExpanded 
                ? "fixed inset-4 z-[100] h-[calc(100vh-32px)] lg:inset-10 lg:h-[calc(100vh-80px)] shadow-2xl" 
                : "h-[550px]"
            }`}>
              {isAssistantExpanded && (
                <div 
                  className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[-1]" 
                  onClick={() => setIsAssistantExpanded(false)}
                />
              )}
              <CardHeader className={`border-b pb-4 shrink-0 flex flex-row items-center space-y-0 gap-3 rounded-t-xl transition-colors ${
                isAssistantExpanded ? "bg-primary p-6" : "bg-primary/5"
              }`}>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isAssistantExpanded ? "bg-white/20" : "bg-primary/15"
                }`}>
                  <Bot className={`h-5 w-5 ${isAssistantExpanded ? "text-white" : "text-primary"}`} />
                </div>
                <div className="flex-1">
                  <CardTitle className={`text-base font-semibold ${isAssistantExpanded ? "text-white" : "text-foreground"}`}>
                    Plan Assistant
                  </CardTitle>
                  <CardDescription className={`text-xs ${isAssistantExpanded ? "text-white/70" : ""}`}>
                    Tune the plan stored on this device with chat.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-lg shrink-0 ${
                    isAssistantExpanded 
                      ? "text-white hover:bg-white/10" 
                      : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                  }`}
                  onClick={() => setIsAssistantExpanded(!isAssistantExpanded)}
                >
                  {isAssistantExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                <div className="px-4 pt-4 pb-3 border-b bg-card/60 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Prefer lower risk crops",
                      "I want a faster harvest",
                      "Exclude chili from the options",
                    ].map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={isChatLoading || !recommendation}
                        onClick={() => void handlePlanAssistantSubmit(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex items-end gap-2 ${
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          message.role === "user" ? "bg-muted" : "bg-primary/10"
                        }`}
                      >
                        {message.role === "user" ? (
                          <User className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Bot className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted text-foreground rounded-bl-none"
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-end gap-2">
                      <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted text-foreground rounded-2xl rounded-bl-none p-3 px-4">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-3 border-t bg-card shrink-0">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handlePlanAssistantSubmit()
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      placeholder="Ask to change budget, risk, harvest speed, or exclude a crop..."
                      className="flex-1 h-10 text-sm focus-visible:ring-1"
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      disabled={isChatLoading || !recommendation}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="shrink-0 h-10 w-10 transition-all hover:scale-105"
                      disabled={!chatInput.trim() || isChatLoading || !recommendation}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => void handleGenerateExecutionPlan()}
              className="w-full h-12 gap-2 text-base"
              disabled={!hasRecommendationData || !selectedRecommendation}
            >
              Generate Execution Plan
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PlanningPage() {
  return (
    <Suspense
      fallback={<PaddyFieldLoadingScreen />}
    >
      <PlanningPageContent />
    </Suspense>
  )
}

