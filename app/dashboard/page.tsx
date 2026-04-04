"use client"


import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Search, Bell, ChevronDown, Droplets, Wind, Sparkles,
  TrendingUp, Cloud, Sun, CloudRain, Smartphone, Camera, 
  Send, Bot, Leaf, Plus, VolumeX, Volume2, Maximize2, Minimize2
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { QRCodeSVG } from "qrcode.react"

// Reusable audio player that handles volume and autoplay securely
const WeatherAudio = ({ src, isSoundEnabled }: { src: string, isSoundEnabled: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 1.0; 
      if (isSoundEnabled) {
        audioRef.current.play().catch(e => console.log("Audio playback blocked.", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [src, isSoundEnabled]);
  return <audio ref={audioRef} src={src} autoPlay={isSoundEnabled} loop muted={!isSoundEnabled} />;
}
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import Image from "next/image"

const moistureData = [
  { month: "Apr", value: 8 },
  { month: "May", value: 12 },
  { month: "Jun", value: 6 },
  { month: "Jul", value: 15 },
  { month: "Aug", value: 10 },
  { month: "Sep", value: 18 },
  { month: "Oct", value: 14 },
]

const nutrients = [
  { symbol: "Mg", name: "Magnesium", range: "0.20 - 0.30", value: "0.15%", color: "bg-amber-500", progress: 50 },
  { symbol: "pH", name: "Acidity", range: "5.5 - 7.5", value: "3.2 pH", color: "bg-emerald-500", progress: 45 },
  { symbol: "P", name: "Phosphorus", range: "0.10 - 0.30", value: "0.8%", color: "bg-cyan-500", progress: 80 },
  { symbol: "K", name: "Potassium", range: "110-280", value: "180 kg", color: "bg-green-600", progress: 65 },
  { symbol: "C", name: "Organic carbon", range: "0.5 - 7.5", value: "0.7%", color: "bg-teal-500", progress: 35 },
]

// Circular Progress Component
function CircularProgress({ 
  value, 
  max, 
  label, 
  unit,
  color = "#22c55e",
  size = 90
}: { 
  value: number
  max: number
  label: string
  unit: string
  color?: string
  size?: number
}) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = ((max - value) / max) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[#1a1a1a]">{value}</span>
          <span className="text-[10px] text-gray-500">{unit}</span>
        </div>
      </div>
      <span className="text-xs text-gray-600 mt-2">{label}</span>
    </div>
  )
}

export default function DashboardPage() {
  const [growthDay, setGrowthDay] = useState(1);
  const weather = growthDay % 4 === 0 ? "raining" : growthDay % 3 === 0 ? "cloudy" : "sunny"
  const humidity = weather === "raining" ? 85 : weather === "cloudy" ? 65 : 45
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);

  const [chatMessages, setChatMessages] = useState<{ role: "ai" | "user", content: string }[]>([
    { role: "ai", content: "Hi! I'm your Plant Tracker Botanist. Did you measure the height or take a photo of your tomato plant today?" }
  ])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [phoneSynced, setPhoneSynced] = useState(false)
  const [plantHeight, setPlantHeight] = useState("0 cm")
  const [arSessionId, setArSessionId] = useState<string | null>(null)
  const isFirstRender = useRef(true)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState("")
  const [isChatPopped, setIsChatPopped] = useState(false)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMsg = chatInput
    setChatInput("")
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }])
    setIsChatLoading(true)

    try {
      const res = await fetch("/api/plant-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, chatHistory: chatMessages }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: "ai", content: data.reply }])
    } catch {
      setChatMessages(prev => [...prev, { role: "ai", content: "My connection to the AI is currently offline. Keep up the good work on your farm!" }])
    }
    setIsChatLoading(false)
  }

  const fetchHeightInsight = async (
    cm: number,
    historyBeforeUser: { role: "ai" | "user"; content: string }[],
    day: number
  ) => {
    setIsChatLoading(true)
    try {
      const res = await fetch("/api/plant-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "The user just synced a height measurement from their phone. Explain what this suggests about tomato progress and give brief next steps.",
          heightCm: cm,
          growthDay: day,
          chatHistory: historyBeforeUser,
        }),
      })
      const data = await res.json()
      setChatMessages((prev) => [...prev, { role: "ai", content: data.reply }])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content:
            "I could not reach the botanist AI (Ollama). Height is saved — check that Ollama is running.",
        },
      ])
    }
    setIsChatLoading(false)
  }

  const handlePlantPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !file.type.startsWith("image/")) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
      const userLine =
        "[Photo] I uploaded an image of my tomato plant for your review."
      setChatMessages((prev) => {
        const historyForApi = prev
        void (async () => {
          setIsChatLoading(true)
          try {
            const res = await fetch("/api/plant-tracker", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message:
                  "Describe this tomato plant photo: growth stage, visible health, and 2 concise care tips.",
                images: [base64],
                growthDay,
                chatHistory: historyForApi,
              }),
            })
            const data = await res.json()
            setChatMessages((m) => [...m, { role: "ai", content: data.reply }])
          } catch {
            setChatMessages((m) => [
              ...m,
              {
                role: "ai",
                content:
                  "Could not analyze the photo. Is Ollama running with a vision model (e.g. llava)?",
              },
            ])
          }
          setIsChatLoading(false)
        })()
        return [...prev, { role: "user", content: userLine }]
      })
    }
    reader.readAsDataURL(file)
  }

  // Polling for incoming AR measurement
  useEffect(() => {
    if (!isQrModalOpen || !arSessionId) return;

    let timeoutId: NodeJS.Timeout;
    let isActive = true;
    
    const pollMeasurement = async () => {
      if (!isActive) return;
      try {
        const res = await fetch(`/api/measurement?session_id=${arSessionId}`);
        if (!isActive) return;
        
        const data = await res.json();
        
        if (data.success && data.data) {
          setIsQrModalOpen(false);
          setPhoneSynced(true);
          const measuredHeight = data.data.height_cm;
          setPlantHeight(measuredHeight + " cm");
          
          const mappedDay = Math.min(Math.round((measuredHeight / 150) * 60) + 5, 60);
          setGrowthDay(mappedDay);

          setChatMessages((prev) => {
            void fetchHeightInsight(measuredHeight, prev, mappedDay)
            return prev
          });
          
          return; // Stop polling
        }
      } catch (err) {
        // Silently ignore network errors during polling to prevent Next.js dev overlay 
        // popping up on "Failed to fetch" (which happens on HMR connection drops).
      }
      
      if (isActive) {
        timeoutId = setTimeout(pollMeasurement, 1500);
      }
    };

    timeoutId = setTimeout(pollMeasurement, 1500);
    
    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [isQrModalOpen, arSessionId]);

  const openArModal = () => {
    // Generate simple ID robust against non-https IPs
    const newSession = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setArSessionId(newSession);
    
    // Phone must open an HTTPS origin for getUserMedia on most mobile browsers.
    // Set NEXT_PUBLIC_PHONE_BASE_URL=https://YOUR-NGROK-SUBDOMAIN.ngrok-free.app in .env
    let host = window.location.origin;
    const tunnel = process.env.NEXT_PUBLIC_PHONE_BASE_URL?.replace(/\/$/, "");
    if (tunnel && (host.includes("localhost") || host.includes("127.0.0.1"))) {
      host = tunnel;
    } else if (host.includes("localhost") || host.includes("127.0.0.1")) {
      alert(
        "Phone camera needs HTTPS. Please set NEXT_PUBLIC_PHONE_BASE_URL to your active ngrok HTTPS URL in .env, then restart the app."
      );
      return;
    }

    setQrUrl(`${host}/measure?plant_id=tomato_1&session_id=${newSession}`);
    setIsQrModalOpen(true);
  }

  // Compute styles for the tomato simulation
  const getPlantSize = () => {
     // Reduced scale coefficient further so it doesn't clip the screen when fully grown
     const scale = Math.min(0.2 + (growthDay / 60) * 0.75, 0.95);
     return `scale(${scale})`;
  }

  const getBackgroundStyle = () => {
    if (weather === "raining") return "bg-[#34786a] text-white"; // Darker green
    if (weather === "cloudy") return "bg-[#4da898] text-white"; // Muted green
    return "bg-[#71c5e8] text-slate-800"; // Bright flat sunny blue sky!
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] pb-12">
      {/* Header */}
      <header className={`border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 transition-all ${isChatPopped ? "hidden" : ""}`}>
        <div className="px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg text-foreground">Dashboard</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button suppressHydrationWarning className="p-2 rounded-full hover:bg-white/50 transition-colors">
              <Search className="h-5 w-5 text-gray-500" />
            </button>
            <button suppressHydrationWarning className="p-2 rounded-full hover:bg-white/50 transition-colors relative">
              <Bell className="h-5 w-5 text-gray-500" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-slate-50"></span>
            </button>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6">
        
        {/* Dynamic Weather Audio Engine - single persistent element */}
        <WeatherAudio 
          src={weather === "raining" ? "https://upload.wikimedia.org/wikipedia/commons/4/4e/Rain_Sound_Effect.ogg" : weather === "cloudy" ? "https://upload.wikimedia.org/wikipedia/commons/2/25/Wind_Sound_Effect.ogg" : "https://upload.wikimedia.org/wikipedia/commons/1/1b/Birdsong_-_nature_sounds_-_238.ogg"} 
          isSoundEnabled={isSoundEnabled} 
        />

        {/* Top Row - Tomato Simulation & Daily Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
          
          {/* Tomato Growth Simulation (Full Card Style) */}
          <Card className={`lg:col-span-7 border-0 overflow-hidden relative shadow-md rounded-2xl ${getBackgroundStyle()} transition-colors duration-1000 h-[480px] flex flex-col`}>
            
            {/* CSS for custom animations */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes rain {
                0% { transform: translateY(-50px) rotate(15deg); opacity: 0; }
                50% { opacity: 1; }
                100% { transform: translateY(300px) rotate(15deg); opacity: 0; }
              }
              .rain-drop { animation: rain 1s linear infinite; }
              .rain-delay-1 { animation-delay: 0.2s; }
              .rain-delay-2 { animation-delay: 0.5s; }
              .rain-delay-3 { animation-delay: 0.7s; }
              
              @keyframes drift {
                0% { transform: translateX(-50px); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateX(300px); opacity: 0; }
              }
              .cloud-drift { animation: drift 15s linear infinite; }
              .cloud-delay { animation-delay: 7s; }

              @keyframes bird {
                0% { transform: translateX(-50px) translateY(0px) scale(0.8); opacity: 0; }
                10% { opacity: 1; transform: translateX(50px) translateY(-5px) scale(0.85); }
                90% { opacity: 1; transform: translateX(450px) translateY(-20px) scale(0.95); }
                100% { transform: translateX(550px) translateY(-25px) scale(1); opacity: 0; }
              }
              .bird-fly { animation: bird 12s linear infinite; }
              .bird-delay { animation-delay: 6s; }
            `}} />
          
            <CardContent className="p-0 flex-1 flex flex-col relative w-full items-center justify-center">
               
               {/* Day Badge at Top Left */}
               <div className="absolute top-6 left-6 z-20">
                 <Badge className="bg-white/20 text-white backdrop-blur-md rounded-lg shadow-sm px-4 py-2 text-base border border-white/30 font-bold tracking-wider hover:bg-white/30 transition">
                   DAY {growthDay}
                 </Badge>
               </div>

               {/* Environmental Indicators & Sound Control */}
               <div className="absolute top-6 right-6 z-20 flex gap-2">
                 <button 
                   suppressHydrationWarning
                   onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                   className="bg-black/20 text-white backdrop-blur-md rounded-full shadow-sm p-2 text-sm border border-white/30 hover:bg-black/30 transition flex items-center justify-center"
                 >
                   {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                 </button>
                 <Badge className="bg-black/20 text-white backdrop-blur-md rounded-full shadow-sm px-4 py-1.5 gap-2 text-sm border border-white/30 hover:bg-black/30 transition">
                   <Droplets className="h-4 w-4" />
                   Humidity: {humidity}%
                 </Badge>
                 <Badge className="bg-black/20 text-white backdrop-blur-md rounded-full shadow-sm px-4 py-1.5 gap-2 text-sm border border-white/30 hover:bg-black/30 transition">
                   🌱 Height: {plantHeight}
                 </Badge>
               </div>

               {/* Weather Animations inside background */}
               <div className="absolute inset-0 z-0">
                 {weather === "sunny" && (
                   <>
                     <Sun className="absolute top-6 right-8 h-16 w-16 text-yellow-300 animate-[spin_20s_linear_infinite]" fill="currentColor" />
                     {/* Birds flying */}
                     <div className="absolute top-16 left-0 bird-fly opacity-70">
                       <svg width="35" height="25" viewBox="0 0 30 20" fill="none">
                         <path d="M0,10 Q5,0 15,10 Q25,0 30,10 Q25,5 15,12 Q5,5 0,10 Z" fill="#334155"/>
                       </svg>
                     </div>
                     <div className="absolute top-24 left-0 bird-fly bird-delay opacity-60" style={{ transform: 'scale(0.7)' }}>
                       <svg width="35" height="25" viewBox="0 0 30 20" fill="none">
                         <path d="M0,10 Q5,0 15,10 Q25,0 30,10 Q25,5 15,12 Q5,5 0,10 Z" fill="#334155"/>
                       </svg>
                     </div>
                   </>
                 )}
                 
                 {weather === "cloudy" && (
                   <>
                     <Cloud className="absolute top-8 left-0 h-12 w-12 text-white/90 cloud-drift drop-shadow-sm" fill="currentColor" />
                     <Cloud className="absolute top-16 -left-10 h-10 w-10 text-white/80 cloud-drift cloud-delay drop-shadow-sm" fill="currentColor" />
                   </>
                 )}
                 
                 {weather === "raining" && (
                   <div className="absolute inset-0 bg-slate-800/20 transition-colors duration-1000">
                     {/* Rain particles */}
                     <div className="absolute top-10 left-10 w-0.5 h-6 bg-white/60 rain-drop"></div>
                     <div className="absolute top-10 left-[25%] w-0.5 h-6 bg-white/60 rain-drop rain-delay-1"></div>
                     <div className="absolute top-10 left-[75%] w-0.5 h-6 bg-white/60 rain-drop rain-delay-2"></div>
                     <div className="absolute top-10 right-10 w-0.5 h-6 bg-white/60 rain-drop rain-delay-3"></div>
                     <div className="absolute top-10 left-[45%] w-0.5 h-6 bg-white/60 rain-drop rain-delay-1"></div>
                   </div>
                 )}
               </div>

               {/* Dirt Base (Full Width) */}
               <div className="absolute -bottom-1 left-0 right-0 h-[30%] bg-[#593c12] z-0 shadow-[inset_0_5px_15px_rgba(0,0,0,0.2)] pb-2 rounded-b-2xl overflow-hidden">
                  <div className="w-full h-3 bg-[#422909]" /> {/* Top rim of dirt */}
               </div>
               
               {/* Plant Graphic */}
               <div 
                  className="absolute bottom-[25%] flex items-end justify-center transition-all duration-700 origin-bottom z-10 w-full"
                  style={{ transform: getPlantSize() }}
               >
                  {/* Dynamic Visual Based on Day */}
                  {growthDay < 5 && (
                    <svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-md">
                      <path d="M20 40 L20 20" stroke="#4d6f1a" strokeWidth="3" fill="none" strokeLinecap="round"/>
                      <path d="M20 25 Q10 15 5 20 Q15 30 20 25" fill="#689f38" />
                      <path d="M20 25 Q30 20 35 15 Q25 10 20 25" fill="#689f38" />
                    </svg>
                  )}
                  {growthDay >= 5 && growthDay < 15 && (
                    <svg width="100" height="100" viewBox="0 0 100 100" className="drop-shadow-md">
                      {/* Stem */}
                      <path d="M50 100 Q45 60 55 20" stroke="#4d6f1a" strokeWidth="4" fill="none" strokeLinecap="round"/>
                      {/* Leaves - Lobed shapes */}
                      <path d="M50 70 Q30 65 20 75 Q35 90 50 70" fill="#558b2f" />
                      <path d="M50 50 Q75 40 85 50 Q65 65 50 50" fill="#689f38" />
                      <path d="M50 35 Q25 25 15 30 Q35 45 50 35" fill="#7cb342" />
                      <path d="M55 20 Q70 5 80 15 Q60 25 55 20" fill="#8bc34a" />
                    </svg>
                  )}
                  {growthDay >= 15 && growthDay < 40 && (
                    <svg width="180" height="200" viewBox="0 0 180 200" className="drop-shadow-lg">
                      {/* Branching Stems */}
                      <path d="M90 200 Q80 120 100 40" stroke="#425c13" strokeWidth="5" fill="none" strokeLinecap="round"/>
                      <path d="M85 140 Q50 100 30 60" stroke="#425c13" strokeWidth="4" fill="none" strokeLinecap="round"/>
                      <path d="M95 100 Q140 70 150 40" stroke="#425c13" strokeWidth="4" fill="none" strokeLinecap="round"/>
                      
                      {/* Assorted leafy clusters */}
                      <g fill="#4caf50">
                        <path d="M30 60 C10 60, 0 40, 20 30 C30 20, 50 30, 30 60" />
                        <path d="M30 60 C10 80, 20 100, 40 90 C60 80, 50 60, 30 60" />
                        <path d="M150 40 C170 30, 180 50, 160 70 C140 90, 130 50, 150 40" />
                        <path d="M100 40 C80 20, 90 0, 110 10 C130 20, 120 40, 100 40" />
                        <path d="M100 40 C120 40, 130 20, 110 30 C90 40, 80 60, 100 40" />
                      </g>
                    </svg>
                  )}
                  {growthDay >= 40 && (
                    <svg width="240" height="260" viewBox="0 0 240 260" className="drop-shadow-xl z-20">
                      {/* Vining stems imitating the reference picture */}
                      <path d="M120 260 Q115 160 130 40" stroke="#466614" strokeWidth="7" fill="none" strokeLinecap="round"/>
                      <path d="M120 200 Q70 120 50 50" stroke="#466614" strokeWidth="5" fill="none" strokeLinecap="round"/>
                      <path d="M125 140 Q190 90 200 40" stroke="#466614" strokeWidth="5" fill="none" strokeLinecap="round"/>
                      <path d="M118 80 Q70 60 40 100" stroke="#466614" strokeWidth="4" fill="none" strokeLinecap="round"/>

                      {/* Leaf clusters (Darker back layer) */}
                      <g fill="#33691e">
                        <path d="M50 50 C20 40, 10 70, 30 80 C50 90, 60 60, 50 50" />
                        <path d="M200 40 C220 50, 230 20, 210 10 C190 0, 180 30, 200 40" />
                        <path d="M120 200 C80 220, 90 250, 140 240 C160 230, 150 200, 120 200" />
                      </g>

                      {/* Leaf clusters (Front brighter layer) */}
                      <g fill="#558b2f">
                        <path d="M130 40 C90 10, 110 -10, 140 0 C170 10, 160 50, 130 40" />
                        <path d="M130 40 C170 40, 160 -10, 120 10 C90 30, 100 60, 130 40" />
                        <path d="M40 100 C10 120, 0 160, 30 150 C60 140, 70 100, 40 100" />
                        <path d="M40 100 C60 80, 80 100, 60 120 C40 140, 20 120, 40 100" />
                        <path d="M200 40 C180 80, 210 100, 230 80 C250 60, 220 30, 200 40" />
                      </g>

                      {/* Tomatoes (Bright Red Groups based on reference) */}
                      {/* Top Right Cluster */}
                      <circle cx="150" cy="55" r="16" fill="#d32f2f" />
                      <circle cx="145" cy="50" r="5" fill="#ffcdd2" opacity="0.4"/>
                      {/* Top Right cluster leaves */}
                      <path d="M150 39 L145 45 M150 39 L155 45 M150 39 L150 47" stroke="#466614" strokeWidth="2" />

                      <circle cx="170" cy="65" r="20" fill="#e53935" />
                      <circle cx="163" cy="58" r="6" fill="#ffcdd2" opacity="0.6"/>
                      <path d="M165 48 L160 55 M165 48 L170 55 M165 48 L165 57" stroke="#466614" strokeWidth="2" />

                      {/* Middle Left Cluster */}
                      <circle cx="90" cy="115" r="18" fill="#d32f2f" />
                      <circle cx="84" cy="108" r="5" fill="#ffcdd2" opacity="0.4"/>
                      <path d="M92 98 L87 105 M92 98 L97 105 M92 98 L92 107" stroke="#466614" strokeWidth="2" />

                      <circle cx="70" cy="140" r="22" fill="#e53935" />
                      <circle cx="62" cy="132" r="7" fill="#ffcdd2" opacity="0.6"/>
                      <path d="M75 120 L70 128 M75 120 L80 128 M75 120 L75 130" stroke="#466614" strokeWidth="2" />

                      <circle cx="105" cy="144" r="15" fill="#c62828" />
                      <circle cx="99" cy="138" r="4" fill="#ffcdd2" opacity="0.4"/>

                      {/* Bottom Right Cluster */}
                      {growthDay > 50 && (
                        <>
                          <circle cx="165" cy="155" r="24" fill="#d32f2f" />
                          <circle cx="155" cy="145" r="8" fill="#ffcdd2" opacity="0.5"/>
                          <path d="M165 133 L160 141 M165 133 L170 141 M165 133 L165 143" stroke="#466614" strokeWidth="2" />

                          <circle cx="190" cy="180" r="18" fill="#e53935" />
                          <circle cx="184" cy="173" r="5" fill="#ffcdd2" opacity="0.6"/>
                          <path d="M185 163 L180 170 M185 163 L190 170 M185 163 L185 172" stroke="#466614" strokeWidth="2" />
                        </>
                      )}

                      {/* Bottom Left Cluster */}
                      {growthDay > 55 && (
                        <>
                          <circle cx="60" cy="205" r="20" fill="#e53935" />
                          <circle cx="53" cy="197" r="6" fill="#ffcdd2" opacity="0.6"/>
                          <path d="M65 186 L60 193 M65 186 L70 193 M65 186 L65 195" stroke="#466614" strokeWidth="2" />

                          <circle cx="95" cy="210" r="14" fill="#c62828" />
                        </>
                      )}
                    </svg>
                  )}
               </div>

               {/* Slider Section */}
               <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 border border-white/30 shadow-sm flex items-center gap-4">
                    <span className="text-sm font-bold text-white tracking-widest uppercase">Seed</span>
                    <input 
                      type="range" 
                      min="1" 
                      max="60" 
                      value={growthDay}
                      onChange={(e) => setGrowthDay(Number(e.target.value))}
                      className="flex-1 h-3 rounded-full appearance-none bg-black/20 cursor-pointer 
                        accent-white hover:accent-gray-100 focus:outline-none"
                    />
                    <span className="text-sm font-bold text-white tracking-widest uppercase">Harvest</span>
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* Daily Action Bar */}
          <Card className="lg:col-span-3 shadow-md border-0 rounded-2xl bg-white relative overflow-hidden h-fit flex flex-col">
            <CardContent className="px-5 py-0 flex flex-col">
              <div className="mb-4 shrink-0 mt-3">
                <h3 className="text-lg font-bold text-slate-800 mb-0.5">Daily Action Bar</h3>
                <p className="text-sm text-slate-500">Recommendations for Day {growthDay}</p>
              </div>
              
              <div className="flex flex-col gap-3 shrink-0">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-3 flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="bg-blue-100 p-1.5 rounded-md">
                      <Droplets className="h-4 w-4 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-slate-800 text-sm">Watering</h4>
                  </div>
                  <p className="text-xs text-slate-600">
                     {weather === "raining" ? "No watering needed today due to rainfall." : `Apply 200ml of water to base.`}
                  </p>
                </div>

                {growthDay > 10 && growthDay < 30 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-3 flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-amber-100 p-1.5 rounded-md">
                        <Sparkles className="h-4 w-4 text-amber-600" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm">Fertilize</h4>
                    </div>
                    <p className="text-xs text-slate-600">
                      Apply NPK balanced fertilizer for optimal vegetative leaf growth.
                    </p>
                  </div>
                )}

                {growthDay >= 40 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-3 flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-red-100 p-1.5 rounded-md">
                        <Leaf className="h-4 w-4 text-red-600" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm">Pruning</h4>
                    </div>
                    <p className="text-xs text-slate-600">
                      Pinch off yellowing leaves at the bottom to improve fruit maturation.
                    </p>
                  </div>
                )}
                
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-3 flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-slate-200 p-1.5 rounded-md">
                        <Wind className="h-4 w-4 text-slate-600" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-sm">Air Flow Check</h4>
                    </div>
                    <p className="text-xs text-slate-600">
                      Ensure plant is spaced correctly to prevent fungal issues.
                    </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Area - Progress Tracker & Chatbot */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 pb-20 items-start">
          
          {/* Progress Tracker / Sensor Input */}
          <Card className="lg:col-span-7 flex h-fit flex-col overflow-hidden rounded-2xl border border-border/50 bg-white py-0 gap-0 shadow-md">
            <CardContent className="p-0 flex flex-col">
               <div className="bg-[#f8f9fa] px-5 py-0 min-h-[60px] border-b border-border/40 flex justify-between items-center shrink-0">
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Progress Tracker</h3>
                   <p className="text-xs text-slate-500 mt-0.5">Sync with mobile or upload manually</p>
                 </div>
                 <div className="bg-emerald-100 p-2 rounded-full">
                    <Smartphone className="h-5 w-5 text-emerald-600" />
                 </div>
               </div>

               <div className="px-5 py-0 flex flex-col gap-4 mt-3">
                 {/* AR Sync Mock Tool */}
                 <div className="border border-dashed border-slate-300 rounded-xl bg-slate-50 p-6 flex flex-col items-center justify-center text-center transition-all hover:bg-slate-100">
                    <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold text-slate-800 mb-1">AR Height Measure</h4>
                    <p className="text-sm text-slate-500 mb-4 max-w-[250px]">
                      Open the AgriFlow app on your phone to scan and measure the plant.
                    </p>
                    
                    {!phoneSynced ? (
                      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
                        <DialogTrigger asChild>
                          <Button suppressHydrationWarning onClick={openArModal} className="rounded-full px-6 font-medium bg-slate-800 hover:bg-slate-700">
                            <Smartphone className="h-4 w-4 mr-2" /> Connect & Measure
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md flex flex-col items-center bg-white border border-border">
                          <DialogHeader>
                            <DialogTitle className="text-center font-bold text-slate-800">Scan with Phone</DialogTitle>
                            <DialogDescription className="text-center text-slate-500">
                              Point your camera at this QR code to open the AR measurement tool.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex justify-center p-6 bg-white rounded-xl shadow-inner border border-slate-100 my-2">
                            {qrUrl && <QRCodeSVG value={qrUrl} size={200} level="H" includeMargin={true} />}
                          </div>
                          <div className="text-sm text-center font-medium text-slate-500 flex items-center justify-center gap-2 mt-2">
                             <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-ping"></span> Waiting for measurement...
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 mb-2">+ Sync Complete</Badge>
                        <p className="text-2xl font-bold tracking-tight text-slate-800">{plantHeight}</p>
                        <p className="text-xs text-slate-500">Calculated on Day {growthDay}</p>
                      </div>
                    )}
                 </div>

                 {/* Manual Add */}
                 <div className="shrink-0">
                   <input
                     ref={photoInputRef}
                     type="file"
                     accept="image/*"
                     className="hidden"
                     onChange={handlePlantPhoto}
                   />
                   <h4 className="font-semibold text-sm text-slate-800 mb-2">Manual Update</h4>
                   <div className="flex gap-2">
                     <button
                       suppressHydrationWarning
                       type="button"
                       onClick={() => photoInputRef.current?.click()}
                       className="flex-1 flex gap-2 items-center justify-center border border-slate-200 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                     >
                       <Camera className="h-4 w-4" /> Add Photo
                     </button>
                     <button suppressHydrationWarning className="flex-1 flex gap-2 items-center justify-center border border-slate-200 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                       <Plus className="h-4 w-4" /> Add Log
                     </button>
                   </div>
                 </div>
               </div>
            </CardContent>
          </Card>

          {/* Plant Tracker AI Chatbot */}
          <Card className={`shadow-md border border-border/50 rounded-2xl bg-white flex flex-col ${
            isChatPopped
              ? 'fixed inset-4 z-[100] max-w-none lg:col-span-3 h-auto'
              : 'lg:col-span-3 h-full min-h-[400px]'
          }`}>
            {isChatPopped && <div className="fixed inset-0 bg-black/40 z-[-1]" onClick={() => setIsChatPopped(false)} />}
            <div className="bg-primary px-4 py-0 min-h-[60px] flex items-center justify-between shrink-0 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center text-xl">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Botanist AI</h3>
                    <p className="text-xs text-primary-foreground/80 cursor-default">Tracking your tomato progress</p>
                  </div>
                </div>
                <button
                  suppressHydrationWarning
                  onClick={() => setIsChatPopped(!isChatPopped)}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
                  title={isChatPopped ? 'Minimize' : 'Expand'}
                >
                  {isChatPopped ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-0 space-y-4 bg-slate-50/50 pt-3">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm shadow-sm
                      ${msg.role === 'ai'
                        ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                        : 'bg-primary text-primary-foreground rounded-tr-sm'}`}
                    >
                       {msg.role === 'ai' ? (
                         <div className="space-y-2">
                           {msg.content.split('\n').filter((l: string) => l.trim()).map((line: string, li: number) => {
                             const headerMatch = line.match(/^(📊|📏|✅|⚠️|🔜|🌿)\s*\*?\*?(.+?)\*?\*?\s*[—–-]\s*(.+)$/);
                             if (headerMatch) {
                               const emoji = headerMatch[1];
                               const title = headerMatch[2].replace(/\*\*/g, '').trim();
                               const body = headerMatch[3].trim();
                               const colorMap: Record<string, string> = {
                                 '📊': 'text-blue-600',
                                 '📏': 'text-indigo-600',
                                 '✅': 'text-emerald-600',
                                 '⚠️': 'text-amber-600',
                                 '🔜': 'text-purple-600',
                                 '🌿': 'text-green-600',
                               };
                               return (
                                 <div key={li} className="py-0.5">
                                   <span className={`font-bold ${colorMap[emoji] || 'text-slate-800'}`}>{emoji} {title}</span>
                                   <span className="text-slate-600"> — {body}</span>
                                 </div>
                               );
                             }
                             return <p key={li} className="text-slate-600">{line}</p>;
                           })}
                         </div>
                       ) : (
                         msg.content
                       )}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                     <div className="max-w-[85%] rounded-2xl p-4 text-sm bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm flex items-center gap-2">
                       <span className="h-2 w-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                       <span className="h-2 w-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                       <span className="h-2 w-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                     </div>
                  </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="px-4 py-0 min-h-[60px] flex flex-col justify-center border-t border-slate-100 bg-white shrink-0 rounded-b-2xl">
              <form onSubmit={handleChatSubmit} className="flex gap-2 relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Describe your plant or ask for advice..."
                  className="w-full h-11 px-4 pr-12 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  disabled={isChatLoading}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-1.5 top-1.5 w-8 h-8 rounded-full shadow-sm"
                  disabled={!chatInput.trim() || isChatLoading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </Card>
          
        </div>
      </div>
    </div>
  )
}
