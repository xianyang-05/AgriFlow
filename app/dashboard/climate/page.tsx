"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Cloud, Sun, CloudRain, Droplets, ThermometerSun, Wind, 
  AlertTriangle, CheckCircle2, ArrowRight, Waves, Flame,
  CloudSun, Snowflake, Loader2, ShieldAlert, ChevronRight
} from "lucide-react"
import dynamic from "next/dynamic"

const InsurancePdfButton = dynamic(() => import("./InsurancePdfButton"), {
  ssr: false,
})
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

const forecastData = [
  { day: "Mon", high: 32, low: 24, rain: 0, humidity: 55, icon: "sunny" },
  { day: "Tue", high: 34, low: 25, rain: 0, humidity: 50, icon: "sunny" },
  { day: "Wed", high: 30, low: 23, rain: 5, humidity: 65, icon: "cloudy" },
  { day: "Thu", high: 28, low: 22, rain: 15, humidity: 75, icon: "rainy" },
  { day: "Fri", high: 31, low: 24, rain: 2, humidity: 60, icon: "partly-cloudy" },
  { day: "Sat", high: 33, low: 25, rain: 0, humidity: 52, icon: "sunny" },
  { day: "Sun", high: 32, low: 24, rain: 0, humidity: 55, icon: "sunny" },
]

const temperatureHistory = [
  { hour: "6AM", temp: 22, humidity: 80 },
  { hour: "9AM", temp: 26, humidity: 70 },
  { hour: "12PM", temp: 31, humidity: 55 },
  { hour: "3PM", temp: 34, humidity: 45 },
  { hour: "6PM", temp: 30, humidity: 55 },
  { hour: "9PM", temp: 26, humidity: 65 },
]

const riskIndicators = [
  {
    id: "flood",
    name: "Flood Risk",
    level: 15,
    status: "low",
    icon: Waves,
    description: "Low precipitation expected. No flooding concerns.",
    action: null,
  },
  {
    id: "drought",
    name: "Drought Risk",
    level: 35,
    status: "low",
    icon: Sun,
    description: "Adequate soil moisture. Monitor in coming weeks.",
    action: null,
  },
  {
    id: "heat",
    name: "Heat Stress",
    level: 65,
    status: "medium",
    icon: Flame,
    description: "High temperatures expected Thursday. Crops may need extra irrigation.",
    action: "Increase watering frequency",
  },
  {
    id: "frost",
    name: "Frost Risk",
    level: 0,
    status: "none",
    icon: Snowflake,
    description: "No frost expected in the forecast period.",
    action: null,
  },
]

const actionRecommendations = [
  {
    id: 1,
    title: "Delay Watering",
    description: "Rain expected Thursday. Delay irrigation to save water and prevent overwatering.",
    priority: "high",
    timing: "Next 2 days",
    impact: "Save 2,500 gallons",
  },
  {
    id: 2,
    title: "Harvest Early",
    description: "Optimal conditions for wheat harvesting before Thursday rain.",
    priority: "medium",
    timing: "Today - Wednesday",
    impact: "Protect yield quality",
  },
  {
    id: 3,
    title: "Apply Mulch",
    description: "Add mulch to vegetable beds to retain moisture during heat wave.",
    priority: "medium",
    timing: "Before Thursday",
    impact: "Reduce water needs 20%",
  },
]

const getWeatherIcon = (type: string) => {
  switch (type) {
    case "sunny":
      return <Sun className="h-6 w-6 text-warning" />
    case "cloudy":
      return <Cloud className="h-6 w-6 text-muted-foreground" />
    case "rainy":
      return <CloudRain className="h-6 w-6 text-info" />
    case "partly-cloudy":
      return <CloudSun className="h-6 w-6 text-warning" />
    default:
      return <Sun className="h-6 w-6 text-warning" />
  }
}

const getRiskColor = (status: string) => {
  switch (status) {
    case "high":
      return "text-destructive"
    case "medium":
      return "text-warning"
    case "low":
      return "text-success"
    default:
      return "text-muted-foreground"
  }
}

const getRiskBg = (status: string) => {
  switch (status) {
    case "high":
      return "bg-destructive"
    case "medium":
      return "bg-warning"
    case "low":
      return "bg-success"
    default:
      return "bg-muted"
  }
}

export default function ClimatePage() {
  const today = forecastData[0]
  const fallbackSeasonalData = [
    { month: "2026-04", rainfall: 92 },
    { month: "2026-05", rainfall: 118 },
    { month: "2026-06", rainfall: 136 },
    { month: "2026-07", rainfall: 128 },
    { month: "2026-08", rainfall: 101 },
    { month: "2026-09", rainfall: 94 },
  ]
  const fallbackMaxRainfall = Math.max(...fallbackSeasonalData.map((entry) => entry.rainfall))

  const [seasonalData, setSeasonalData] = useState<{ month: string; rainfall: number }[]>(fallbackSeasonalData)
  const [floodRisk, setFloodRisk] = useState<"low" | "medium" | "high">("medium")
  const [seasonalError, setSeasonalError] = useState<string | null>(null)

  useEffect(() => {
    const applySeasonalRisk = (data: { month: string; rainfall: number }[]) => {
      let maxMonthlyRain = 0

      for (const entry of data) {
        maxMonthlyRain = Math.max(maxMonthlyRain, entry.rainfall)
      }

      setSeasonalData(data)

      if (maxMonthlyRain > 180) {
        setFloodRisk("high")
      } else if (maxMonthlyRain > 120) {
        setFloodRisk("medium")
      } else {
        setFloodRisk("low")
      }
    }

    async function fetchSeasonal() {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      try {
        const res = await fetch("https://seasonal-api.open-meteo.com/v1/seasonal?latitude=3.15&longitude=101.67&daily=precipitation_sum&forecast_days=180&models=ecmwf_seas5_ensemble_mean", {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Seasonal API returned ${res.status}`)
        }
        const data = await res.json()

        if (!data?.daily?.time || !data?.daily?.precipitation_sum) {
          throw new Error("Seasonal API response is missing daily forecast data")
        }

        // Aggregate daily precipitation_sum into months
        const monthlyRainfall: Record<string, number> = {}
        const dates = data.daily.time
        const rains = data.daily.precipitation_sum

        for (let i = 0; i < dates.length; i++) {
          const date = dates[i]
          const month = date.substring(0, 7) // YYYY-MM
          const rain = rains[i] || 0
          monthlyRainfall[month] = (monthlyRainfall[month] || 0) + rain
        }

        const aggregated = Object.entries(monthlyRainfall).map(([month, rainfall]) => ({
          month,
          rainfall: rainfall as number,
        }))

        applySeasonalRisk(aggregated.length > 0 ? aggregated : fallbackSeasonalData)
        setSeasonalError(null)
      } catch (err) {
        console.error("Failed to fetch seasonal forecast", err)
        applySeasonalRisk(fallbackSeasonalData)
        setSeasonalError("Live seasonal forecast unavailable. Showing fallback outlook.")
      }
      clearTimeout(timeoutId)
    }
    fetchSeasonal()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="px-6 h-16 flex items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Climate & Risk</h1>
            <p className="text-sm text-muted-foreground">
              Weather forecasts and risk assessments
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Current Weather Banner */}
        <Card className="shadow-lg shadow-primary/5 bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-2xl bg-warning/20 flex items-center justify-center">
                  <Sun className="h-10 w-10 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Weather</p>
                  <p className="text-5xl font-bold text-foreground">{today.high}°C</p>
                  <p className="text-muted-foreground mt-1">Sunny, feels like {today.high + 2}°C</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center mx-auto mb-2">
                    <Droplets className="h-5 w-5 text-info" />
                  </div>
                  <p className="text-xs text-muted-foreground">Humidity</p>
                  <p className="text-lg font-semibold text-foreground">{today.humidity}%</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mx-auto mb-2">
                    <Wind className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Wind</p>
                  <p className="text-lg font-semibold text-foreground">12 km/h</p>
                </div>
                <div className="text-center">
                  <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center mx-auto mb-2">
                    <CloudRain className="h-5 w-5 text-info" />
                  </div>
                  <p className="text-xs text-muted-foreground">Rain</p>
                  <p className="text-lg font-semibold text-foreground">{today.rain}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts and Forecast */}
          <div className="lg:col-span-2 space-y-6">
            {/* 7-Day Forecast */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  7-Day Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {forecastData.map((day, index) => (
                    <div
                      key={day.day}
                      className={`p-3 rounded-xl text-center transition-colors ${
                        index === 0 ? "bg-primary/10 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <p className={`text-sm font-medium ${index === 0 ? "text-primary" : "text-foreground"}`}>
                        {day.day}
                      </p>
                      <div className="my-3 flex justify-center">
                        {getWeatherIcon(day.icon)}
                      </div>
                      <p className="text-lg font-semibold text-foreground">{day.high}°</p>
                      <p className="text-xs text-muted-foreground">{day.low}°</p>
                      {day.rain > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-2">
                          <Droplets className="h-3 w-3 text-info" />
                          <span className="text-xs text-info">{day.rain}mm</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Temperature Chart */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThermometerSun className="h-5 w-5 text-primary" />
                  Today&apos;s Temperature
                </CardTitle>
                <CardDescription>Hourly temperature and humidity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={temperatureHistory}>
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-warning)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-warning)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="hour" className="text-xs" />
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
                        dataKey="temp"
                        stroke="var(--color-warning)"
                        fill="url(#tempGradient)"
                        strokeWidth={2}
                        name="Temperature (°C)"
                      />
                      <Line
                        type="monotone"
                        dataKey="humidity"
                        stroke="var(--color-info)"
                        strokeWidth={2}
                        dot={false}
                        name="Humidity (%)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-warning" />
                    <span className="text-sm text-muted-foreground">Temperature</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-info" />
                    <span className="text-sm text-muted-foreground">Humidity</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Recommendations */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Recommended Actions
                </CardTitle>
                <CardDescription>AI-powered suggestions based on weather forecast</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {actionRecommendations.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-start gap-4 p-4 rounded-xl border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        action.priority === "high" ? "bg-destructive/10" : "bg-warning/10"
                      }`}>
                        <ArrowRight className={`h-5 w-5 ${
                          action.priority === "high" ? "text-destructive" : "text-warning"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground">{action.title}</h4>
                          <Badge className={
                            action.priority === "high"
                              ? "bg-destructive/15 text-destructive border-destructive/30"
                              : "bg-warning/15 text-warning-foreground border-warning/30"
                          }>
                            {action.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">Timing: {action.timing}</span>
                          <span className="text-success font-medium">{action.impact}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="flex-shrink-0">
                        Apply
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hydrological Forecast & Flood Risk */}
            <Card className="relative overflow-hidden border-emerald-200/70 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/60 shadow-lg shadow-emerald-100/40">
              {floodRisk === "high" && (
                <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-bl-full bg-destructive/5" />
              )}
              <div className="pointer-events-none absolute -left-16 top-12 h-32 w-32 rounded-full bg-emerald-200/20 blur-2xl" />
              <CardHeader>
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                    floodRisk === "high"
                      ? "border-destructive/25 bg-destructive/10 text-destructive"
                      : "border-emerald-200 bg-emerald-100/80 text-emerald-700"
                  }`}>
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700/80">
                      Climate Protection
                    </div>
                    <CardTitle className="text-xl">
                      Flood Readiness & Crop Protection
                    </CardTitle>
                  </div>
                </div>
                <CardDescription className="max-w-2xl text-base leading-relaxed">
                  A quick decision panel for flood exposure, drainage action, and crop insurance support for lowland farms.
                </CardDescription>
                <CardTitle className="hidden">
                  <Waves className={`h-5 w-5 ${floodRisk === "high" ? "text-destructive" : "text-primary"}`} />
                  Hydrological Forecast & Flood Risk 🌊
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <>
                    {seasonalError && (
                      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
                        {seasonalError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Flood Warning */}
                      <div className={`rounded-2xl border p-5 shadow-sm ${floodRisk === "high" ? "border-destructive/30 bg-destructive/10" : "border-border bg-white/75"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className={`h-4 w-4 ${floodRisk === "high" ? "text-destructive" : "text-muted-foreground"}`} />
                          <h4 className="font-semibold text-foreground">Flood Alert</h4>
                        </div>
                        {floodRisk === "high" ? (
                          <p className="text-sm text-destructive font-medium">
                            Heavy rain expected (&gt;{Math.max(...seasonalData.map(d => d.rainfall), fallbackMaxRainfall).toFixed(0)}mm) → Potential flooding → Recommend drainage
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Standard rainfall expected. Routine monitoring advised.</p>
                        )}
                      </div>

                      {/* Drainage Plan */}
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Waves className="h-4 w-4 text-sky-600" />
                          <h4 className="font-semibold text-foreground">Drainage Response</h4>
                        </div>
                        <p className="text-sm text-foreground">
                          {floodRisk === "high" ? "Activate secondary pumps by mid-month. Clean main canal immediately." : "Maintain normal drainage operations."}
                        </p>
                      </div>
                    </div>

                    {/* Crop Loss Estimate */}
                    <div className="rounded-2xl border border-border bg-white/80 p-5 shadow-sm">
                      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-warning" />
                        Estimated Crop Exposure
                      </h4>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Estimated Exposure</span>
                        <span className="font-semibold text-destructive">{floodRisk === "high" ? "35%" : "5%"} at risk</span>
                      </div>
                      <Progress value={floodRisk === "high" ? 35 : 5} className="h-2 mb-2 bg-muted" aria-label="Crop Loss Progress" />
                      <p className="text-xs text-muted-foreground text-right">
                        Potential financial impact: <span className="font-semibold text-foreground">RM {floodRisk === "high" ? "12,500" : "1,800"}</span>
                      </p>
                    </div>

                    {/* Insurance Advisory CTA */}
                    {floodRisk === "high" && (
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/70 p-5">
                        <div>
                          <h4 className="font-semibold text-emerald-800">Recommended Protection Plan</h4>
                          <p className="text-sm text-emerald-700/90">Secure subsidized crop cover before flood exposure rises further.</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                              Explore Coverage
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[720px]">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                                Enroll in Agrobank STTP
                              </DialogTitle>
                              <DialogDescription>
                                High flood risk detected. Secure your crop with Malaysia's subsidized paddy insurance.
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4 py-4">
                              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Coverage</span>
                                  <span className="font-medium">Flood, Drought, Pests</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Estimated Premium</span>
                                  <span className="font-medium">RM 64.80 / ha</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Max Payout</span>
                                  <span className="font-bold text-success">RM 3,000 / ha</span>
                                </div>
                              </div>
                              
                              <div className="text-xs text-muted-foreground">
                                * Offline Registration required at your nearest Agrobank branch or PPK.
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <InsurancePdfButton />
                              <Button variant="outline" onClick={() => window.open("https://www.agrobank.com.my", "_blank")} className="w-full">
                                Find Nearest Branch
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}
                </>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Risk Indicators */}
          <div className="space-y-6">
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Risk Indicators
                </CardTitle>
                <CardDescription>Current risk assessment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {riskIndicators.map((risk) => {
                  const Icon = risk.icon
                  return (
                    <div key={risk.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${getRiskColor(risk.status)}`} />
                          <span className="text-sm font-medium text-foreground">{risk.name}</span>
                        </div>
                        <Badge className={`
                          ${risk.status === "high" ? "bg-destructive/15 text-destructive border-destructive/30" : ""}
                          ${risk.status === "medium" ? "bg-warning/15 text-warning-foreground border-warning/30" : ""}
                          ${risk.status === "low" ? "bg-success/15 text-success border-success/30" : ""}
                          ${risk.status === "none" ? "bg-muted text-muted-foreground border-muted" : ""}
                        `}>
                          {risk.status === "none" ? "No Risk" : `${risk.level}%`}
                        </Badge>
                      </div>
                      <Progress value={risk.level} className={`h-2 ${getRiskBg(risk.status)}`} />
                      <p className="text-xs text-muted-foreground">{risk.description}</p>
                      {risk.action && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                          <span className="text-xs text-primary font-medium">{risk.action}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Seasonal Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    <CloudRain className="h-4 w-4 text-info" />
                    <span className="text-sm text-muted-foreground">Total Rainfall</span>
                  </div>
                  <span className="font-semibold text-foreground">245mm</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    <ThermometerSun className="h-4 w-4 text-warning" />
                    <span className="text-sm text-muted-foreground">Avg Temperature</span>
                  </div>
                  <span className="font-semibold text-foreground">28°C</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-warning" />
                    <span className="text-sm text-muted-foreground">Sunny Days</span>
                  </div>
                  <span className="font-semibold text-foreground">18 days</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-info" />
                    <span className="text-sm text-muted-foreground">Soil Moisture</span>
                  </div>
                  <span className="font-semibold text-success">Optimal</span>
                </div>
              </CardContent>
            </Card>


          </div>
        </div>
      </div>
    </div>
  )
}
