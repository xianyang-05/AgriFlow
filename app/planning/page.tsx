"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Leaf,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Droplets,
  ThermometerSun,
  AlertTriangle,
  CheckCircle2,
  Wheat,
  Apple,
  Carrot,
  LayoutDashboard,
  AlertCircle,
  Bot,
  User,
  Send,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"
import {
  getLatestRecommendationRunId,
  getRecommendation,
  getRecommendationErrorMessage,
  getStoredRecommendationPlan,
  sendRecommendationChatMessage,
  type RankedCrop,
  type RecommendationResponse,
  saveRecommendationPlan,
} from "@/lib/recommendations"

const marketData = [
  { month: "Jan", wheat: 280, rice: 320, corn: 180, vegetables: 420 },
  { month: "Feb", wheat: 300, rice: 310, corn: 190, vegetables: 400 },
  { month: "Mar", wheat: 290, rice: 340, corn: 200, vegetables: 450 },
  { month: "Apr", wheat: 320, rice: 350, corn: 220, vegetables: 480 },
  { month: "May", wheat: 340, rice: 380, corn: 240, vegetables: 520 },
  { month: "Jun", wheat: 360, rice: 400, corn: 260, vegetables: 550 },
]

type CropIcon = typeof Wheat

type StrategyKey = "aggressive" | "conservative"

interface StrategyRecommendationCard {
  strategy: StrategyKey
  strategyLabel: string
  cropId: string
  cropName: string
  icon: CropIcon
  price: string
  growthCycle: string
  rationale: string
  explanationPoints: string[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value)
}

function getCropIcon(cropId: string, cropName: string): CropIcon {
  const key = `${cropId} ${cropName}`.toLowerCase()

  if (key.includes("maize") || key.includes("corn")) {
    return Wheat
  }
  if (key.includes("chili") || key.includes("okra") || key.includes("bean")) {
    return Carrot
  }
  if (key.includes("eggplant") || key.includes("cucumber")) {
    return Apple
  }

  return Leaf
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
    suitability_score: 0.25,
    climate_score: 0.2,
    budget_fit_score: 0.2,
    price_score: 0.05,
    duration_fit_score: 0.3,
  },
  conservative: {
    suitability_score: 0.35,
    climate_score: 0.35,
    budget_fit_score: 0.2,
    price_score: 0.05,
    duration_fit_score: 0.05,
  },
}

function describeScore(value: number) {
  if (value >= 0.85) {
    return "excellent"
  }
  if (value >= 0.65) {
    return "strong"
  }
  if (value >= 0.45) {
    return "solid"
  }
  if (value >= 0.25) {
    return "limited"
  }
  return "weak"
}

function describeWeight(value: number) {
  if (value >= 0.3) {
    return "a major factor"
  }
  if (value >= 0.15) {
    return "an important factor"
  }
  return "a smaller factor"
}

function buildMetricExplanation(
  strategy: StrategyKey,
  metric: keyof RankedCrop["score_breakdown"],
  score: number,
  weight: number,
) {
  const scoreText = describeScore(score)
  const weightText = describeWeight(weight)

  switch (metric) {
    case "climate_score":
      return strategy === "aggressive"
        ? `Weather stability looked ${scoreText} and remained ${weightText} in the reward formula, so forecast fit still added meaningful upside.`
        : `Weather stability looked ${scoreText} and remained ${weightText} in the risk formula, making forecast reliability one of the biggest reasons this crop stayed safer.`
    case "duration_fit_score":
      return strategy === "aggressive"
        ? `Harvest speed looked ${scoreText} and was ${weightText}, making crop duration one of the main reward drivers.`
        : `Crop duration looked ${scoreText}; it was only ${weightText} in the risk formula, so it mattered less than climate and baseline fit.`
    case "price_score":
      return strategy === "aggressive"
        ? `Market price looked ${scoreText}. Price was only ${weightText}, but the upside still helped this crop win on reward.`
        : `Market price looked ${scoreText}. It counted as ${weightText} in the risk formula, so it supported the result without being the main driver.`
    case "budget_fit_score":
      return strategy === "aggressive"
        ? `Budget fit looked ${scoreText} and was ${weightText}, so this crop keeps enough financial headroom while still chasing upside.`
        : `Budget fit looked ${scoreText} and was ${weightText}, helping keep the capital burden manageable for the safer option.`
    case "suitability_score":
      return score > 0
        ? strategy === "aggressive"
          ? `Baseline suitability looked ${scoreText} and was ${weightText}, so the crop still clears the agronomic checks while maximizing reward.`
          : `Baseline suitability looked ${scoreText} and was ${weightText}, making agronomic reliability one of the strongest reasons this crop has the lowest risk.`
        : `Baseline suitability looked ${scoreText}, so this crop is being carried mostly by the other weighted factors.`
    default:
      return `${metric} looked ${scoreText} and counted as ${weightText} in the ${strategy} formula.`
  }
}

function buildStrategyExplanationPoints(strategy: StrategyKey, crop: RankedCrop) {
  const weights = STRATEGY_WEIGHTS[strategy]
  const contributions = (Object.entries(weights) as Array<[keyof RankedCrop["score_breakdown"], number]>)
    .map(([metric, weight]) => ({
      metric,
      weight,
      score: crop.score_breakdown[metric],
      contribution: crop.score_breakdown[metric] * weight,
    }))
    .sort((a, b) => b.contribution - a.contribution)

  return contributions
    .slice(0, 3)
    .map((item) => buildMetricExplanation(strategy, item.metric, item.score, item.weight))
}

function buildStrategyCards(recommendation: RecommendationResponse | null): StrategyRecommendationCard[] {
  if (!recommendation) {
    return []
  }

  const rankedCrops = recommendation.ranked_crops || []
  const aggressiveCrop =
    pickHighestRewardCrop(rankedCrops) || recommendation.aggressive_plan?.top_crop || null
  const conservativeCrop =
    pickLowestRiskCrop(rankedCrops, aggressiveCrop?.crop_id) || recommendation.conservative_plan?.top_crop || null

  if (!aggressiveCrop || !conservativeCrop) {
    return []
  }

  return [
    {
      strategy: "aggressive" as const,
      topCrop: aggressiveCrop,
      rationale:
        recommendation.aggressive_plan?.rationale ||
        "Selected for the highest reward potential, prioritizing faster harvests and stronger upside.",
    },
    {
      strategy: "conservative" as const,
      topCrop: conservativeCrop,
      rationale:
        recommendation.conservative_plan?.rationale ||
        "Selected for the lowest overall risk, prioritizing climate stability and dependable fit.",
    },
  ].map((plan) => {
    const strategy = plan.strategy

    return {
      strategy,
      strategyLabel: strategy === "aggressive" ? "Aggressive Plan" : "Conservative Plan",
      cropId: plan.topCrop.crop_id,
      cropName: plan.topCrop.crop_name,
      icon: getCropIcon(plan.topCrop.crop_id, plan.topCrop.crop_name),
      price: formatCurrency(plan.topCrop.price_result.predicted_price),
      growthCycle: `${plan.topCrop.growth_days} days`,
      rationale: plan.rationale,
      explanationPoints: buildStrategyExplanationPoints(strategy, plan.topCrop),
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

function getMockSeriesKey(cropId: string) {
  const key = cropId.toLowerCase()

  if (key.includes("rice")) {
    return "rice"
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
  const runIdParam = searchParams.get("runId")
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>("aggressive")
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "bot"; content: string }[]
  >([
    {
      role: "bot",
      content:
        "Hi! I'm your AgriFlow plan assistant. Ask me to tune this recommendation by changing budget, harvest speed, risk preference, or excluding crops.",
    },
  ])
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isActive = true

    const loadRecommendation = async () => {
      setIsLoading(true)
      setLoadError(null)

      const targetRunId = runIdParam || getLatestRecommendationRunId()
      if (!targetRunId) {
        if (isActive) {
          setRecommendation(null)
          setIsLoading(false)
          setLoadError("No saved plan was found. Generate a plan from the onboarding flow first.")
        }
        return
      }

      let nextRecommendation = getStoredRecommendationPlan(targetRunId)

      if (!nextRecommendation) {
        try {
          nextRecommendation = await getRecommendation(targetRunId)
          saveRecommendationPlan(nextRecommendation)
        } catch (error) {
          if (isActive) {
            setRecommendation(null)
            setIsLoading(false)
            setLoadError(getRecommendationErrorMessage(error))
          }
          return
        }
      }

      if (!isActive) {
        return
      }

      setRecommendation(nextRecommendation)
      setIsLoading(false)
    }

    loadRecommendation()

    return () => {
      isActive = false
    }
  }, [runIdParam])

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
  }, [recommendation?.version_number, recommendation?.user_preferences?.risk_preference])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handlePlanAssistantSubmit = async (messageOverride?: string) => {
    const outgoingMessage = (messageOverride ?? chatInput).trim()
    if (!outgoingMessage) {
      return
    }

    const activeRunId = recommendation?.run_id ?? runIdParam ?? getLatestRecommendationRunId()
    if (!activeRunId) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: "I need a saved plan before I can tune recommendations. Generate a plan first, then I can help refine it.",
        },
      ])
      return
    }

    setChatInput("")
    setChatMessages((prev) => [...prev, { role: "user", content: outgoingMessage }])
    setIsChatLoading(true)

    try {
      const response = await sendRecommendationChatMessage(activeRunId, outgoingMessage)
      const nextRecommendation = response.updated_recommendation

      if (nextRecommendation) {
        saveRecommendationPlan(nextRecommendation)
        setRecommendation(nextRecommendation)
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: response.assistant_message,
        },
      ])
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: getRecommendationErrorMessage(error),
        },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  const strategyRecommendations = buildStrategyCards(recommendation)
  const selectedRecommendation =
    strategyRecommendations.find((card) => card.strategy === selectedStrategy) || strategyRecommendations[0]
  const hasRecommendationData =
    recommendation?.status === "complete" && strategyRecommendations.length > 0
  const locationLabel = getLocationLabel(recommendation)
  const mockSeriesKey = getMockSeriesKey(selectedRecommendation?.cropId || "wheat")

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your saved recommendation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
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
                        const Icon = card.icon
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
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}>
                                <Icon className="h-5 w-5" />
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
                            </div>
                            <div className="mt-4 pt-4 border-t border-border/60">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">
                                Why This Crop Won
                              </p>
                              <div className="space-y-2">
                                {card.explanationPoints.map((point) => (
                                  <p key={point} className="text-sm text-muted-foreground leading-relaxed">
                                    {point}
                                  </p>
                                ))}
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
                    <Tabs defaultValue="profit" className="w-full">
                      <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="profit">Profit</TabsTrigger>
                        <TabsTrigger value="yield">Yield</TabsTrigger>
                        <TabsTrigger value="risk">Risk</TabsTrigger>
                      </TabsList>
                      <TabsContent value="profit" className="space-y-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={marketData}>
                              <defs>
                                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                </linearGradient>
                              </defs>
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
                              <Area
                                type="monotone"
                                dataKey={mockSeriesKey}
                                stroke="var(--color-primary)"
                                fill="url(#profitGradient)"
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-muted/50">
                            <p className="text-xs text-muted-foreground">Best Case</p>
                            <p className="text-lg font-semibold text-primary">$5,200</p>
                          </div>
                          <div className="p-4 rounded-xl bg-muted/50">
                            <p className="text-xs text-muted-foreground">Expected</p>
                            <p className="text-lg font-semibold text-foreground">$3,200</p>
                          </div>
                          <div className="p-4 rounded-xl bg-muted/50">
                            <p className="text-xs text-muted-foreground">Worst Case</p>
                            <p className="text-lg font-semibold text-muted-foreground">$1,800</p>
                          </div>
                        </div>
                      </TabsContent>
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
            <Card className="shadow-xl shadow-primary/5 border-border/50 h-[550px] flex flex-col">
              <CardHeader className="border-b bg-muted/10 pb-4 shrink-0 flex flex-row items-center space-y-0 gap-3">
                <div className="h-10 w-10 bg-primary/15 rounded-xl flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-foreground font-semibold">
                    Plan Assistant
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tune your crop recommendation with chat
                  </CardDescription>
                </div>
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
                        disabled={isChatLoading || !recommendation?.run_id}
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
                      disabled={isChatLoading || !recommendation?.run_id}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="shrink-0 h-10 w-10 transition-all hover:scale-105"
                      disabled={!chatInput.trim() || isChatLoading || !recommendation?.run_id}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => router.push(`/execution-plan?crop=${selectedRecommendation?.cropId || ""}`)}
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
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading your saved recommendation...</p>
          </div>
        </div>
      }
    >
      <PlanningPageContent />
    </Suspense>
  )
}

