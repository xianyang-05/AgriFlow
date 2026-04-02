"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Leaf, ArrowRight, TrendingUp, TrendingDown, Cloud, Sun, 
  Droplets, ThermometerSun, AlertTriangle, CheckCircle2,
  DollarSign, Wheat, Apple, Carrot, LayoutDashboard
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

const TomatoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c0 0-2-1-4 0s-2 3-2 3" />
    <path d="M16 6c-2-1-4 0-4 0" />
    <circle cx="12" cy="14" r="7" />
    <path d="M12 7v3" />
  </svg>
)

const marketData = [
  { month: "Jan", wheat: 280, tomato: 320, corn: 180, vegetables: 420 },
  { month: "Feb", wheat: 300, tomato: 310, corn: 190, vegetables: 400 },
  { month: "Mar", wheat: 290, tomato: 340, corn: 200, vegetables: 450 },
  { month: "Apr", wheat: 320, tomato: 350, corn: 220, vegetables: 480 },
  { month: "May", wheat: 340, tomato: 380, corn: 240, vegetables: 520 },
  { month: "Jun", wheat: 360, tomato: 400, corn: 260, vegetables: 550 },
]

const cropRecommendations = [
  {
    id: "wheat",
    name: "Wheat",
    icon: Wheat,
    yield: "4.2 tons/acre",
    risk: "low",
    profit: "$2,800",
    waterNeed: "Medium",
    growthDays: 120,
    description: "Ideal for your soil type with stable market demand",
  },
  {
    id: "tomato",
    name: "Tomato",
    icon: TomatoIcon,
    yield: "3.8 tons/acre",
    risk: "medium",
    profit: "$3,200",
    waterNeed: "High",
    growthDays: 150,
    description: "Higher profit but requires more water management",
  },
  {
    id: "vegetables",
    name: "Mixed Vegetables",
    icon: Carrot,
    yield: "5.5 tons/acre",
    risk: "high",
    profit: "$4,500",
    waterNeed: "Medium",
    growthDays: 90,
    description: "Highest profit potential with diversified risk",
  },
  {
    id: "fruits",
    name: "Seasonal Fruits",
    icon: Apple,
    yield: "3.0 tons/acre",
    risk: "medium",
    profit: "$3,800",
    waterNeed: "Medium",
    growthDays: 180,
    description: "Growing market demand with premium pricing",
  },
]

const climateData = {
  temperature: "28°C",
  humidity: "65%",
  rainfall: "850mm/year",
  forecast: "Favorable",
}

interface FarmData {
  location: string
  farmSize: string
  budget: string
  soilType: string
}

export default function PlanningPage() {
  const router = useRouter()
  const [selectedCrop, setSelectedCrop] = useState("wheat")
  const [farmData, setFarmData] = useState<FarmData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem("farmData")
    if (stored) {
      setFarmData(JSON.parse(stored))
    }
    // Simulate loading
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  const selectedCropData = cropRecommendations.find((c) => c.id === selectedCrop)

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "bg-success/15 text-success border-success/30"
      case "medium":
        return "bg-warning/15 text-warning-foreground border-warning/30"
      case "high":
        return "bg-destructive/15 text-destructive border-destructive/30"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Analyzing your farm data...</p>
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
            <span className="font-semibold text-lg text-foreground">AgriTwin AI</span>
          </Link>
          <Button onClick={() => router.push("/dashboard")} className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Smart Planning</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered recommendations based on your farm profile
            {farmData && ` in ${farmData.location}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Crop Recommendations */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-primary" />
                  Crop Recommendations
                </CardTitle>
                <CardDescription>
                  Select a crop to see detailed projections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cropRecommendations.map((crop) => {
                    const Icon = crop.icon
                    const isSelected = selectedCrop === crop.id
                    return (
                      <button
                        key={crop.id}
                        onClick={() => setSelectedCrop(crop.id)}
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
                          <Badge className={getRiskColor(crop.risk)}>
                            {crop.risk} risk
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-foreground">{crop.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {crop.description}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Yield</p>
                            <p className="text-sm font-medium text-foreground">{crop.yield}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Est. Profit</p>
                            <p className="text-sm font-medium text-primary">{crop.profit}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Scenario Simulation */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Scenario Simulation
                </CardTitle>
                <CardDescription>
                  Compare projections for {selectedCropData?.name}
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
                            dataKey={selectedCrop === "vegetables" ? "vegetables" : selectedCrop === "tomato" ? "tomato" : "wheat"}
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
                        <p className="text-lg font-semibold text-foreground">{selectedCropData?.profit}</p>
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
                            dataKey={selectedCrop === "vegetables" ? "vegetables" : selectedCrop === "tomato" ? "tomato" : "wheat"}
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
                        <span className="font-medium text-foreground">Yield Projection</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Based on historical data and current conditions, expected yield is {selectedCropData?.yield} with {selectedCropData?.growthDays} day growth cycle.
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
                          <div className="h-full bg-info rounded-full" style={{ width: selectedCropData?.waterNeed === "High" ? "80%" : "45%" }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{selectedCropData?.waterNeed} requirement</p>
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
          </div>

          {/* Right Column - Climate & Market */}
          <div className="space-y-6">
            {/* Climate Summary */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  Climate Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <ThermometerSun className="h-4 w-4 text-warning" />
                      <span className="text-xs text-muted-foreground">Temp</span>
                    </div>
                    <p className="font-semibold text-foreground">{climateData.temperature}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets className="h-4 w-4 text-info" />
                      <span className="text-xs text-muted-foreground">Humidity</span>
                    </div>
                    <p className="font-semibold text-foreground">{climateData.humidity}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Cloud className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Rainfall</span>
                    </div>
                    <p className="font-semibold text-foreground">{climateData.rainfall}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Sun className="h-4 w-4 text-warning" />
                      <span className="text-xs text-muted-foreground">Forecast</span>
                    </div>
                    <p className="font-semibold text-primary">{climateData.forecast}</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Optimal Conditions</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current climate is favorable for {selectedCropData?.name} cultivation.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Market Insight */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Market Insight
                </CardTitle>
                <CardDescription>Price trend (last 6 months)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={marketData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="wheat"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="tomato"
                        stroke="var(--color-chart-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="vegetables"
                        stroke="var(--color-chart-3)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-chart-1" />
                    <span className="text-xs text-muted-foreground">Wheat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-chart-2" />
                    <span className="text-xs text-muted-foreground">Tomato</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-chart-3" />
                    <span className="text-xs text-muted-foreground">Vegetables</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Button */}
            <Button 
              onClick={() => router.push(`/execution-plan?crop=${selectedCrop}`)} 
              className="w-full h-12 gap-2 text-base"
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
