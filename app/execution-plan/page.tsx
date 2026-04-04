"use client"

import { Suspense, useEffect, useRef, useState } from "react"
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
  Leaf, AlertTriangle, Droplets, CheckCircle2,
  Info, ArrowLeft, Send, Sparkles, Youtube, BookOpen, Clock, AlertCircle, RefreshCw, TrendingUp, ChevronLeft, ChevronRight
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { readWorkspace } from "@/lib/local-workspace"

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
  videoSrc: string
}

const mockPhases: Phase[] = [
  {
    id: "prep",
    title: "Soil & Seedbed Preparation",
    emoji: "🚜",
    image: "/preparation.png",
    duration: "Day 1 - Day 10",
    focus: [
      "Prepare raised beds 15–20cm high for drainage",
      "Test soil pH (ideal: 6.0–6.8) and amend with lime if acidic",
      "Mix in aged compost and well-rotted manure at 5kg/m²",
    ],
    water: "Pre-soak beds to field capacity before transplanting",
    fertilizer: "Basal application: 200kg/ha NPK 15-15-15 + organic compost",
    risk: "Waterlogged soil promotes Fusarium wilt — ensure good drainage",
    completed: true,
    bgColor: "bg-[#f5f5dc]",
    videoSrc: "/1part.mp4",
  },
  {
    id: "plant",
    title: "Transplanting & Establishment",
    emoji: "🌱",
    image: "/planting.png",
    duration: "Day 11 - Day 20",
    focus: [
      "Transplant 4–6 week old seedlings at 60cm × 45cm spacing",
      "Install bamboo stakes or trellis supports at planting time",
      "Apply mulch (straw or black plastic) around base to retain moisture",
    ],
    water: "500ml per plant immediately, then daily for first week",
    fertilizer: "Starter solution: diluted fish emulsion or NPK 10-20-10",
    risk: "Transplant shock if planted in midday heat — plant in evening or cloudy days",
    completed: false,
    bgColor: "bg-[#eff3e0]",
    videoSrc: "/2part.mp4",
  },
  {
    id: "water",
    title: "Vegetative Growth & Staking",
    emoji: "💧",
    image: "/vegetative.png",
    duration: "Day 21 - Day 45",
    focus: [
      "Prune suckers (side shoots) below first flower cluster",
      "Tie stems to stakes as plants grow — check weekly",
      "Scout for early pests: whiteflies, leaf miners, and aphids",
    ],
    water: "2–3L per plant every 2 days via drip irrigation (avoid wetting leaves)",
    fertilizer: "Side-dress with calcium ammonium nitrate (CAN) at 100kg/ha",
    risk: "Overhead watering spreads early blight and bacterial spot",
    completed: false,
    bgColor: "bg-[#f4f2ed]",
    videoSrc: "/3part.mp4",
  },
  {
    id: "flower",
    title: "Flowering & Fruit Set",
    emoji: "🍅",
    image: "/vegetative.png",
    duration: "Day 46 - Day 80",
    focus: [
      "Gently shake plants or tap flowers to aid pollination",
      "Apply calcium spray (CaCl₂) to prevent blossom end rot",
      "Monitor for tomato hornworm and late blight — spray if needed",
    ],
    water: "3–4L per plant daily — consistent watering is critical to prevent fruit cracking",
    fertilizer: "Switch to high-potassium feed (NPK 5-10-20) every 2 weeks",
    risk: "Irregular watering causes blossom end rot and fruit cracking",
    completed: false,
    bgColor: "bg-[#f4f2ed]",
    videoSrc: "/4part.mp4",
  },
  {
    id: "harvest",
    title: "Ripening & Harvest",
    emoji: "🍅",
    image: "/harvest.png",
    duration: "Day 81 - Day 120",
    focus: [
      "Harvest when fruits show full color (red/orange) or at breaker stage",
      "Pick every 2–3 days to encourage further fruiting",
      "Sort by size and ripeness — store at 12–15°C, never refrigerate unripe",
    ],
    water: "Reduce to 1.5L per plant every 2 days",
    fertilizer: "Stop fertilizer application 2 weeks before final harvest",
    risk: "Over-ripe fruits attract fruit flies and are prone to sun scald",
    completed: false,
    bgColor: "bg-[#fff6e5]",
    videoSrc: "/5part.mp4",
  }
]

function ExecutionPlanPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [crop, setCrop] = useState("Wheat")

  const [viewMode, setViewMode] = useState<"timeline" | "tasks">("timeline")
  const [metrics, setMetrics] = useState({
    duration: "120 days",
    yield: 3.8,
    risk: "Medium"
  })
  const [activeGuide, setActiveGuide] = useState<string | null>(null)
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null)

  const [chatMessages, setChatMessages] = useState<{ role: "ai" | "user", text: string }[]>([
    { role: "ai", text: "Hello! I'm your AgriFlow AI. How can I assist you with this execution plan today?" }
  ])
  const [draftMessage, setDraftMessage] = useState("")

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const workspaceCrop = readWorkspace()?.selectedExecutionCrop?.cropName
    const nextCrop = searchParams.get("crop") || workspaceCrop || "Wheat"
    setCrop(nextCrop)
    setChatMessages((prev) => {
      if (prev.length !== 1 || prev[0]?.role !== "ai") {
        return prev
      }

      return [
        {
          role: "ai",
          text: `Hello! I'm your AgriFlow AI. I see we're planning for ${
            nextCrop === "vegetables" ? "Mixed Vegetables" : nextCrop
          }. How can I assist you with this execution plan today?`,
        },
      ]
    })
  }, [searchParams])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handleAdjustPlan = (multiplier: number) => {
    // animate UI numbers
    setMetrics(prev => ({
      ...prev,
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
              🍅 {crop === "vegetables" ? "Mixed Vegetables" : crop} Plan
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Top Metrics Cards under the Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="rounded-full border-[#8D6E63] text-[#8D6E63] hover:bg-[#F5F5DC]"
                                onClick={() => setActiveVideoIndex(idx)}
                              >
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

        <Dialog open={activeVideoIndex !== null} onOpenChange={(open) => !open && setActiveVideoIndex(null)}>
          <DialogContent className="sm:max-w-[70vw] w-[70vw] p-0 overflow-hidden bg-black border-none rounded-xl shadow-2xl flex flex-col">
            <DialogTitle className="sr-only">Video Tutorial</DialogTitle>
            {activeVideoIndex !== null && (
              <>
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-center pointer-events-none">
                  <h3 className="text-white font-bold text-lg pointer-events-auto">
                    {mockPhases[activeVideoIndex].title}
                  </h3>
                </div>
                <video 
                  key={mockPhases[activeVideoIndex].videoSrc}
                  src={mockPhases[activeVideoIndex].videoSrc} 
                  controls 
                  autoPlay 
                  className="w-full h-auto max-h-[85vh] rounded-xl object-contain bg-black"
                />
                
                {/* Navigation Buttons */}
                {activeVideoIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 border border-white/20 text-white hover:bg-black/80 hover:text-white transition-all z-20"
                    onClick={() => setActiveVideoIndex(activeVideoIndex - 1)}
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>
                )}
                
                {activeVideoIndex < mockPhases.length - 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 border border-white/20 text-white hover:bg-black/80 hover:text-white transition-all z-20"
                    onClick={() => setActiveVideoIndex(activeVideoIndex + 1)}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

export default function ExecutionPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f5ed] flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-12 w-12 border-4 border-[#4CAF50]/30 border-t-[#4CAF50] rounded-full animate-spin mx-auto" />
            <p className="text-sm text-[#5D4037]">Loading execution plan...</p>
          </div>
        </div>
      }
    >
      <ExecutionPlanPageContent />
    </Suspense>
  )
}
