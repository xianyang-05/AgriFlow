"use client"

import { useState, useRef, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Leaf, AlertTriangle, Droplets, CheckCircle2, DollarSign,
  Info, ArrowLeft, Send, Sparkles, Youtube, BookOpen, Clock, AlertCircle, RefreshCw, TrendingUp
} from "lucide-react"

// Types
interface Phase {
  id: string
  title: string
  emoji: string
  image: string
  duration: string
  focus: string[]
  water: string
  fertilizer: string
  risk: string
  completed: boolean
  bgColor: string
}

const mockPhases: Phase[] = [
  {
    id: "prep",
    title: "Preparation Phase",
    emoji: "🚜",
    image: "/preparation.png",
    duration: "Day 1 - Day 5",
    focus: ["Plow the field to a depth of 20cm", "Test soil pH levels", "Apply base organic compost"],
    water: "Moisten soil lightly",
    fertilizer: "Apply 50kg/hectare organic matter",
    risk: "Compacted soil if plowed when too wet",
    completed: true,
    bgColor: "bg-[#f5f5dc]",
  },
  {
    id: "plant",
    title: "Planting Phase",
    emoji: "🌱",
    image: "/planting.png",
    duration: "Day 6 - Day 10",
    focus: ["Ensure 15cm spacing between seedlings", "Plant at 3cm depth", "Apply starter fertilizer"],
    water: "1L per plant immediately after planting",
    fertilizer: "NPK 10-20-10 starter dose",
    risk: "Seedling shock if planted during midday heat",
    completed: false,
    bgColor: "bg-[#eff3e0]",
  },
  {
    id: "water",
    title: "Vegetative Growth",
    emoji: "💧",
    image: "/vegetative.png",
    duration: "Day 11 - Day 40",
    focus: ["Monitor for early weed emergence", "Regular deep watering", "Second fertilizer application"],
    water: "2.5L per plant every 2 days",
    fertilizer: "Nitrogen-rich top dressing (Urea)",
    risk: "Overwatering may cause root rot. Watch for aphids.",
    completed: false,
    bgColor: "bg-[#f4f2ed]",
  },
  {
    id: "flower",
    title: "Flowering & Fruiting",
    emoji: "🌿",
    image: "/vegetative.png",
    duration: "Day 41 - Day 75",
    focus: ["Encourage pollination", "Prevent water stress", "Apply potassium-rich feed"],
    water: "3L per plant daily (critical phase)",
    fertilizer: "High potassium mix to boost yield",
    risk: "Water stress here severely impacts final yield.",
    completed: false,
    bgColor: "bg-[#f4f2ed]",
  },
  {
    id: "harvest",
    title: "Harvest Phase",
    emoji: "🌾",
    image: "/harvest.png",
    duration: "Day 76 - Day 90",
    focus: ["Check crop maturity daily", "Cease watering 3 days before", "Prepare storage containers"],
    water: "Stop watering to enhance flavor/dryness",
    fertilizer: "None",
    risk: "Delaying harvest can lead to crop rot or pest damage.",
    completed: false,
    bgColor: "bg-[#fff6e5]",
  }
]

export default function ExecutionPlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const crop = searchParams.get("crop") || "Wheat"

  const [viewMode, setViewMode] = useState<"timeline" | "tasks">("timeline")
  const [metrics, setMetrics] = useState({
    duration: "90 days",
    profit: 2800,
    yield: 4.2,
    risk: "Low"
  })
  const [activeGuide, setActiveGuide] = useState<string | null>(null)

  const [chatMessages, setChatMessages] = useState<{ role: "ai" | "user", text: string }[]>([
    { role: "ai", text: `Hello! I'm your AgriFlow AI. I see we're planning for ${crop === "vegetables" ? "Mixed Vegetables" : crop}. How can I assist you with this execution plan today?` }
  ])
  const [draftMessage, setDraftMessage] = useState("")

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handleAdjustPlan = (multiplier: number) => {
    // animate UI numbers
    setMetrics(prev => ({
      ...prev,
      profit: Math.round(prev.profit * multiplier),
      yield: Number((prev.yield * multiplier).toFixed(1)),
      risk: multiplier > 1.1 ? "Medium" : multiplier < 0.9 ? "Low" : prev.risk
    }))
  }

  const handleSendMessage = () => {
    if (!draftMessage.trim()) return
    setChatMessages(prev => [...prev, { role: "user", text: draftMessage }])

    const msg = draftMessage.toLowerCase()
    setDraftMessage("")

    setTimeout(() => {
      let reply = "I noted that. Is there anything else you need help adapting?"
      if (msg.includes("water") || msg.includes("rain")) {
        reply = "Looking at the forecast, you might want to reduce the watering plan by 20% this week. Want me to adjust it?"
      } else if (msg.includes("yellow") || msg.includes("leaf")) {
        reply = "Yellow leaves usually indicate nitrogen deficiency or overwatering. I recommend checking soil moisture first, then potentially adding an NPK booster."
      }
      setChatMessages(prev => [...prev, { role: "ai", text: reply }])
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-[#f7f5ed] font-sans">
      {/* 1. Header Section */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#e5e0d3] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-[#8D6E63] hover:text-[#5D4037] hover:bg-[#F5F5DC]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-[#3e2723] capitalize flex items-center gap-2">
              🌾 {crop === "vegetables" ? "Mixed Vegetables" : crop} Plan
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Top Metrics Cards under the Toolbar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#F5F5DC] flex items-center justify-center">
                <Clock className="w-6 h-6 text-[#8D6E63]" />
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-gray-500 tracking-wider">Duration</p>
                <p className="text-xl font-bold text-[#4e342e]">{metrics.duration}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-gray-500 tracking-wider">Est. Profit</p>
                <motion.p
                  key={metrics.profit}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xl font-bold text-green-800"
                >
                  ${metrics.profit.toLocaleString()}
                </motion.p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#F5F5DC] flex items-center justify-center">
                <Leaf className="w-6 h-6 text-[#4CAF50]" />
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-gray-500 tracking-wider">Est. Yield</p>
                <motion.p
                  key={metrics.yield}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xl font-bold text-[#4e342e]"
                >
                  {metrics.yield} tons/acre
                </motion.p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                <AlertTriangle className={`w-6 h-6 ${metrics.risk === "High" ? "text-red-500" : metrics.risk === "Medium" ? "text-orange-500" : "text-amber-500"}`} />
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-gray-500 tracking-wider">Risk Level</p>
                <motion.p
                  key={metrics.risk}
                  className="text-xl font-bold text-orange-900"
                >
                  {metrics.risk}
                </motion.p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">

          {/* 2. Execution Timeline (70%) */}
          <section className="lg:w-[70%] space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#4e342e]">Execution Path</h2>
              <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as "timeline" | "tasks")} className="bg-white p-1 rounded-full border border-[#e5e0d3] shadow-sm">
                <TabsList className="bg-transparent h-auto p-0">
                  <TabsTrigger value="timeline" className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-[#4CAF50] data-[state=active]:text-white">
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="rounded-full px-4 py-2 text-sm font-medium data-[state=active]:bg-[#4CAF50] data-[state=active]:text-white">
                    Tasks
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {viewMode === "timeline" ? (
              <div className="relative border-l-4 border-[#e5e0d3] ml-24 md:ml-32 pl-8 md:pl-10 space-y-12 py-4">
                {mockPhases.map((phase, idx) => (
                  <div key={phase.id} className="relative">
                    {/* Timeline Node */}
                    <div className={`absolute -left-[45px] md:-left-[54px] w-8 h-8 rounded-full border-4 border-[#f7f5ed] flex items-center justify-center text-white z-10
                      ${phase.completed ? 'bg-[#4CAF50]' : 'bg-[#e5e0d3]'}`}>
                      {phase.completed && <CheckCircle2 className="w-5 h-5" />}
                    </div>

                    {/* Timeline Left Label (Duration) */}
                    <div className="absolute -left-[140px] md:-left-[190px] top-1 flex justify-end w-[85px] md:w-[120px]">
                      <Badge variant="outline" className="bg-white text-[#8D6E63] border-[#8D6E63] shadow-sm whitespace-nowrap px-2 py-1 text-xs">
                        {phase.duration}
                      </Badge>
                    </div>

                    <Card className="rounded-3xl border-0 shadow-lg shadow-black/5 overflow-hidden group hover:shadow-xl transition-all">
                      <div className="flex flex-col md:flex-row items-stretch">
                        {/* Illustration Panel (Left) */}
                        <div className={`md:w-1/3 w-full relative border-b md:border-b-0 md:border-r border-[#e5e0d3] overflow-hidden ${phase.bgColor}`}>
                          <div className="absolute inset-0">
                            <Image
                              src={phase.image}
                              alt={phase.title}
                              fill
                              className="object-contain object-center p-6"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-12 p-5 text-center z-10">
                            <h3 className="font-bold text-[#4e342e] text-lg">{phase.title}</h3>
                          </div>
                        </div>

                        {/* Info Panel (Right) */}
                        <div className="md:w-2/3 p-6 space-y-5 bg-white">
                          <div>
                            <h4 className="flex items-center gap-2 font-semibold text-[#5D4037] mb-2 text-sm uppercase tracking-wider">
                              <CheckCircle2 className="w-4 h-4 text-[#4CAF50]" /> Key Focus
                            </h4>
                            <ul className="space-y-1 pl-6 list-disc text-sm text-[#4e342e]">
                              {phase.focus.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-3 rounded-2xl">
                              <h4 className="flex items-center gap-1.5 font-semibold text-blue-800 text-sm mb-1">
                                <Droplets className="w-4 h-4" /> Water Plan
                              </h4>
                              <p className="text-sm text-blue-900 leading-snug">{phase.water}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-2xl">
                              <h4 className="flex items-center gap-1.5 font-semibold text-green-800 text-sm mb-1">
                                <Leaf className="w-4 h-4" /> Fertilizer Plan
                              </h4>
                              <p className="text-sm text-green-900 leading-snug">{phase.fertilizer}</p>
                            </div>
                          </div>

                          {phase.risk && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-2xl text-red-800 text-sm">
                              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                              <p><strong>Risk Alert:</strong> {phase.risk}</p>
                            </div>
                          )}

                          <div className="pt-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <Button size="sm" variant="outline" className="rounded-full border-[#8D6E63] text-[#8D6E63] hover:bg-[#F5F5DC]">
                                <Youtube className="w-4 h-4 mr-1.5" /> Watch Tutorial
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`rounded-full border-[#8D6E63] hover:bg-[#F5F5DC] transition-colors
                                  ${activeGuide === phase.id ? 'bg-[#8D6E63] text-white' : 'text-[#8D6E63]'}`}
                                onClick={() => setActiveGuide(activeGuide === phase.id ? null : phase.id)}
                              >
                                <BookOpen className="w-4 h-4 mr-1.5" /> Read Guide
                              </Button>
                              <div className="flex-1" />
                              <Button
                                size="sm"
                                className="rounded-full bg-[#8D6E63] hover:bg-[#5D4037] text-white shadow-sm"
                                onClick={() => {
                                  setChatMessages(prev => [...prev, { role: "ai", text: `I've opened the adjustment settings for the ${phase.title}. Any specific resource you want to scale up or down?` }])
                                }}
                              >
                                Adjust Plan
                              </Button>
                            </div>

                            <AnimatePresence>
                              {activeGuide === phase.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-4 overflow-hidden"
                                >
                                  <div className="bg-[#f7f5ed] border border-[#e5e0d3] p-4 rounded-xl text-sm text-[#4e342e]">
                                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                                      <Info className="w-4 h-4 text-[#4CAF50]" />
                                      Detailed Guide: {phase.title}
                                    </h5>
                                    <p className="mb-2">This is a contextual guide for the <strong>{phase.title}</strong> of your {crop}. The key to success here is following the recommended water and fertilizer schedules accurately.</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                      <li>Check soil condition early in the morning.</li>
                                      <li>Look out for the risks mentioned above.</li>
                                      <li>If using organic methods, multiply the compost value by 1.2x.</li>
                                    </ul>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="rounded-3xl border-0 shadow-sm p-6 bg-white space-y-4">
                {mockPhases.map((phase) => (
                  <div key={phase.id} className="flex items-center gap-4 py-3 border-b last:border-0 border-gray-100">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0
                      ${phase.completed ? 'bg-[#4CAF50] border-[#4CAF50] text-white' : 'border-[#e5e0d3] bg-[#f7f5ed]'}`}>
                      {phase.completed && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 opacity-90">
                      <p className={`font-semibold ${phase.completed ? 'text-gray-400 line-through' : 'text-[#4e342e]'}`}>
                        {phase.title}
                      </p>
                      <p className="text-xs text-[#8D6E63]">{phase.duration}</p>
                    </div>
                    <div className="relative w-8 h-8 rounded-full border border-gray-200 overflow-hidden bg-[#F5F5DC]">
                      <Image src={phase.image} alt="phase" fill className="object-cover" />
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>

          {/* 3. AI Chatbot (30%) */}
          <aside className="lg:w-[30%]">
            <div className="sticky top-[100px] h-[calc(100vh-120px)] flex flex-col pt-6 lg:pt-0">
              <Card className="flex-1 flex flex-col overflow-hidden border-[#e5e0d3] rounded-3xl shadow-lg shadow-black/5 bg-white">
                <div className="bg-[#4CAF50] p-4 text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                    🌱
                  </div>
                  <div>
                    <h3 className="font-bold">AgriFlow Assistant</h3>
                    <p className="text-xs text-green-100">Context-aware expert</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fdfdfc]">
                  {chatMessages.map((msg, idx) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={idx}
                      className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[85%] rounded-2xl p-3 text-sm
                        ${msg.role === 'ai'
                          ? 'bg-[#F5F5DC] text-[#4e342e] rounded-tl-sm'
                          : 'bg-[#4CAF50] text-white rounded-tr-sm shadow-sm'}`}>
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-[#e5e0d3] bg-white space-y-3">
                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline" size="sm"
                      className="rounded-full text-xs h-8 border-[#4CAF50] text-[#4CAF50] hover:bg-[#4CAF50] hover:text-white"
                      onClick={() => {
                        setDraftMessage("How do I adjust the water plan?")
                        handleAdjustPlan(0.9)
                      }}
                    >
                      <Droplets className="w-3 h-3 mr-1" /> Adjust Water
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="rounded-full text-xs h-8 border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                      onClick={() => {
                        setDraftMessage("Help me reduce costs.")
                        handleAdjustPlan(0.95)
                      }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Reduce Cost
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="rounded-full text-xs h-8 border-[#8D6E63] text-[#8D6E63] hover:bg-[#8D6E63] hover:text-white"
                      onClick={() => {
                        setDraftMessage("How to optimize yield?")
                        handleAdjustPlan(1.15)
                      }}
                    >
                      <TrendingUp className="w-3 h-3 mr-1" /> Optimize Yield
                    </Button>
                  </div>

                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="flex gap-2 relative mt-2"
                  >
                    <Input
                      value={draftMessage}
                      onChange={(e) => setDraftMessage(e.target.value)}
                      placeholder="Ask anything about your crop..."
                      className="rounded-full pr-10 focus-visible:ring-[#4CAF50] border-[#e5e0d3]"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="absolute right-1 top-1 w-8 h-8 rounded-full bg-[#4CAF50] hover:bg-[#388E3C]"
                      disabled={!draftMessage.trim()}
                    >
                      <Send className="w-4 h-4 text-white" />
                    </Button>
                  </form>
                </div>
              </Card>
            </div>
          </aside>

        </div>
      </main>
    </div>
  )
}
