"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import PaddyFieldLoadingScreen from "@/components/PaddyFieldLoadingScreen"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FlaskConical,
  HelpCircle,
  Image as ImageIcon,
  Leaf,
  Loader2,
  MapPin,
  Ruler,
  Send,
  User,
  Wallet,
  X,
} from "lucide-react"
import dynamic from "next/dynamic"
import Image from "next/image"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  createPreviewRecommendation,
  getRecommendationErrorMessage,
} from "@/lib/recommendations"

const SUPPORTED_AREA_UNIT_REGEX =
  /\b(m2|sqm|square meter|square meters|acre|acres|ekar|rai|hectare|hectares|football field|football fields)\b/i

const extractDimension = (text: string) => {
  const match = text.match(/[\d.]+/)
  const count = match ? Number.parseFloat(match[0]) : 0
  if (!count) return 0

  const normalized = text.toLowerCase()
  const objectLengths: Record<string, number> = {
    broom: 1.2,
    brooms: 1.2,
    car: 4.5,
    cars: 4.5,
    bus: 12,
    buses: 12,
    shoe: 0.3,
    shoes: 0.3,
    step: 0.75,
    steps: 0.75,
    person: 1.7,
    people: 1.7,
    "football pitch": 105,
    "football pitches": 105,
  }

  let multiplier = 1
  for (const [objectName, length] of Object.entries(objectLengths)) {
    if (normalized.includes(objectName)) {
      multiplier = length
      break
    }
  }

  if (normalized.includes("cm") || normalized.includes("centimeter")) multiplier = 0.01
  else if (normalized.includes("km") || normalized.includes("kilometer")) multiplier = 1000
  else if (
    normalized.includes("feet") ||
    normalized.includes("foot") ||
    /\bft\b/.test(normalized)
  ) {
    multiplier = 0.3048
  } else if (normalized.includes("inch") || /\bin\b/.test(normalized)) {
    multiplier = 0.0254
  }

  return count * multiplier
}

const shouldRequireDimensions = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!Number.isNaN(Number(trimmed))) return false
  return !SUPPORTED_AREA_UNIT_REGEX.test(trimmed)
}

const formatAreaInSquareMeters = (area: number) => {
  const normalizedArea = Number.isInteger(area) ? area.toString() : area.toFixed(2)
  return `${normalizedArea} square meters`
}

const extractAreaInSquareMeters = (text: string) => {
  const match = text.match(/[\d.]+/)
  const count = match ? Number.parseFloat(match[0]) : 0
  if (!count) return null

  const normalized = text.toLowerCase()
  let multiplier = 0

  if (normalized.includes("m2") || normalized.includes("sqm") || normalized.includes("square meter") || normalized.includes("square meters")) multiplier = 1
  else if (normalized.includes("acre") || normalized.includes("acres") || normalized.includes("ekar") || normalized.includes("ekars")) multiplier = 4046.86
  else if (normalized.includes("rai")) multiplier = 1600
  else if (normalized.includes("hectare") || normalized.includes("hectares")) multiplier = 10000
  else if (normalized.includes("football field") || normalized.includes("football fields")) multiplier = 7140

  if (multiplier === 0) return null
  return count * multiplier
}

const SelectMap = dynamic(() => import("@/components/SelectMap"), { ssr: false })

const steps = [
  { id: 1, title: "Location", icon: MapPin },
  { id: 2, title: "Farm Details", icon: Ruler },
  { id: 3, title: "Budget", icon: Wallet },
  { id: 4, title: "Soil Type", icon: FlaskConical },
]

const soilTypesInfo = [
  { id: "loamy", name: "Loamy Soil", image: "/soil/loamy_soil_1775015791041.png", desc: "I can feel the crumbly, perfect texture of this loamy soil. It holds a pleasant moisture without being soaking wet, and it has a rich, dark-orange to brown hue. You can just tell it's full of life and nutrients." },
  { id: "clay", name: "Clay Soil", image: "/soil/clay_soil_1775016303702.png", desc: "Touching this clay soil, it feels distinctively dense, sticky and heavy when wet. The dark reddish-grey hue gives it away. It holds together like modeling clay when you squeeze it, indicating strong moisture retention but poor drainage." },
  { id: "sandy", name: "Sandy Soil", image: "/soil/sandy_soil_1775016320859.png", desc: "Running this soil through my fingers, it feels very rough, loose, and granular. It has a light yellow-brown color. It falls apart instantly because it drains water extremely quickly and doesn't hold nutrients well." },
  { id: "silt", name: "Silt Soil", image: "/soil/silt_soil_1775016335728.png", desc: "This silt soil feels incredibly fine and smooth to the touch, almost like flour or talcum powder. It has an earthy, uniform brown tone and holds moisture well, though you can easily compact it if you press hard." },
  { id: "peat", name: "Peat Soil", image: "/soil/peat_soil_1775016349935.png", desc: "Squeezing this peat soil, I notice how dark, almost black, and spongy it feels. It's incredibly rich in organic matter and holds a lot of moisture, smelling deeply of damp earth." },
  { id: "chalky", name: "Chalky Soil", image: "/soil/chalky_soil_1775016364929.png", desc: "This soil looks very pale and feels stony. You can clearly see the white limestone and chalk fragments mixed in. It feels dry and alkaline, and water seems to drain straight through it." }
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    location: "",
    coordinates: null as { lat: number; lng: number } | null,
    farmSize: "",
    farmLength: "",
    farmWidth: "",
    requiresDimensions: false,
    budget: "",
    soilType: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSearchingMap, setIsSearchingMap] = useState(false)
  const [searchedLocation, setSearchedLocation] = useState<{lat: number; lng: number} | null>(null)

  // Chatbot State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{role: "user" | "bot", content: string, type: "text" | "image", imageUrl?: string}[]>([
    { role: "bot", content: "Hi! I'm your Agritwin soil assistant. Describe your soil's texture, color, or behavior, or upload a photo to get help identifying it.", type: "text" }
  ])

  // Helper to highlight soil type names in bot messages
  const highlightSoilTypes = (text: string) => {
    // First convert **bold** markdown to html
    let result = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    const soilNames = ["Loamy Soil", "Clay Soil", "Sandy Soil", "Silt Soil", "Peat Soil", "Chalky Soil", "Loamy", "Clay", "Sandy", "Silt", "Peat", "Chalky", "Loam"]
    // Sort by length descending so longer matches go first
    const sorted = [...soilNames].sort((a, b) => b.length - a.length)
    sorted.forEach(name => {
      const regex = new RegExp(`(?!<[^>]*)(\\b${name}\\b)(?![^<]*>)`, 'gi')
      result = result.replace(regex, `<span class="font-bold text-primary">$1</span>`)
    })
    return result
  }

  const getComputedAreaText = () => {
    if (!formData.requiresDimensions) return null

    const length = extractDimension(formData.farmLength)
    const width = extractDimension(formData.farmWidth)
    if (length <= 0 || width <= 0) return null

    return formatAreaInSquareMeters(length * width)
  }

  const buildSoilAssistantReply = (result: {
    soilType: string
    confidence: string
    explanation: string
    degraded?: boolean
    needsMoreDetail?: boolean
  }) => {
    if (result.needsMoreDetail) {
      return result.explanation
    }

    const prefix = result.degraded
      ? "I couldn't reach the soil model, so this is a fallback guess. "
      : ""

    return `${prefix}I identified this as **${result.soilType}** (confidence: ${result.confidence}). ${result.explanation}`
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMessage = chatInput
    setChatInput("")
    setChatMessages(prev => [...prev, { role: "user", content: userMessage, type: "text" }])
    setIsChatLoading(true)

    try {
      const res = await fetch("/api/soil-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: userMessage }),
      })
      const data = await res.json()
      const result = data
      const reply = buildSoilAssistantReply(result)
      setChatMessages(prev => [...prev, { role: "bot", content: reply, type: "text" }])
    } catch {
      // Fallback to keyword-based
      const lower = userMessage.toLowerCase()
      let reply = "Based on your description, it sounds like you might have Loamy Soil. It's the most ideal for farming!"
      if (lower.includes("sticky") || lower.includes("hard")) {
        reply = "That sticky and hard texture usually points to Clay Soil. Clay holds water well but needs proper drainage."
      } else if (lower.includes("sand") || lower.includes("loose") || lower.includes("drain")) {
        reply = "Loose soil that drains fast is generally Sandy Soil. It warms quickly but needs more watering."
      } else if (lower.includes("dark") || lower.includes("rich")) {
        reply = "Dark, rich soil is often Peat Soil or highly organic Loamy Soil. Peat is great for retaining moisture."
      } else if (lower.includes("white") || lower.includes("stone") || lower.includes("chalk")) {
        reply = "Limestone fragments and lighter color typically indicate Chalky Soil, which is very alkaline."
      }
      setChatMessages(prev => [...prev, { role: "bot", content: reply, type: "text" }])
    }
    setIsChatLoading(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const imageUrl = URL.createObjectURL(file)
    setChatMessages(prev => [...prev, { role: "user", content: file.name, type: "image", imageUrl }])
    setIsChatLoading(true)

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      )
      const res = await fetch("/api/soil-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, description: "Analyze this soil photo" }),
      })
      const data = await res.json()
      const result = data
      const reply = buildSoilAssistantReply(result)
      setChatMessages(prev => [...prev, { role: "bot", content: reply, type: "text" }])
    } catch {
      setChatMessages(prev => [...prev, { role: "bot", content: "Looking at the distinct topsoil chunks and color, it appears highly organic. The crumbly texture and dark brown-orange hue suggest rich Loamy Soil composition. I recommend selecting Loamy Soil for your plan.", type: "text" }])
    }
    setIsChatLoading(false)
    // Reset input so same file can be re-uploaded
    e.target.value = ""
  }

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    const computedAreaText = getComputedAreaText()
    const areaText = computedAreaText || formData.farmSize.trim() || null

    try {
      const recommendation = await createPreviewRecommendation({
        area_text: areaText,
        budget_text: formData.budget.trim() || null,
        location_text: formData.coordinates
          ? `${formData.coordinates.lat}, ${formData.coordinates.lng}`
          : formData.location.trim() || null,
        notes: null,
        soil_type_text: formData.soilType || null,
      })

      const params = new URLSearchParams()
      if (areaText) {
        params.set("area_text", areaText)
      }
      if (formData.budget.trim()) {
        params.set("budget_text", formData.budget.trim())
      }
      const locationText = formData.coordinates
        ? `${formData.coordinates.lat}, ${formData.coordinates.lng}`
        : formData.location.trim()
      if (locationText) {
        params.set("location_text", locationText)
      }
      if (formData.soilType) {
        params.set("soil_type_text", formData.soilType)
      }
      router.push(`/planning?${params.toString()}`)
    } catch (error) {
      setSubmitError(getRecommendationErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1:
        return formData.location.length > 0
      case 2:
        if (formData.requiresDimensions) {
          return extractDimension(formData.farmLength) > 0 && extractDimension(formData.farmWidth) > 0
        }
        return formData.farmSize.trim().length > 0
      case 3:
        return formData.budget.length > 0
      case 4:
        return formData.soilType.length > 0
      default:
        return false
    }
  }

  const canProceed = isStepComplete(currentStep)
  const computedAreaText = getComputedAreaText()

  if (isSubmitting) {
    return (
      <PaddyFieldLoadingScreen
        title="Growing your smart plan"
        description="The paddy field keeps growing from seedling to mature stalks while we prepare your farm recommendation."
      />
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground">AgriFlow</span>
          </div>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Intelligent Farming System
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className={`w-full transition-all duration-500 ease-in-out ${currentStep === 4 ? "max-w-5xl" : "max-w-2xl"}`}>
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isComplete = currentStep > step.id || isStepComplete(step.id)
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                            : isComplete
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isComplete && !isActive ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium transition-colors ${
                          isActive ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-2 rounded-full transition-colors ${
                          currentStep > step.id ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className={`transition-all duration-500 ease-in-out ${currentStep === 4 ? "grid grid-cols-1 lg:grid-cols-5 gap-6 items-start" : ""}`}>
            {/* Form Card */}
            <Card className={`shadow-xl shadow-primary/5 border-border/50 ${currentStep === 4 ? "lg:col-span-3 h-fit" : ""}`}>
              <CardHeader className="pb-4 shrink-0">
              <CardTitle className="text-2xl">
                {currentStep === 1 && "Where is your farm located?"}
                {currentStep === 2 && "Tell us about your farm"}
                {currentStep === 3 && "What&apos;s your budget?"}
                {currentStep === 4 && "What type of soil do you have?"}
              </CardTitle>
              <CardDescription>
                {currentStep === 1 && "Enter your farm's location to get localized weather and market insights"}
                {currentStep === 2 && "We'll use this to calculate optimal crop recommendations"}
                {currentStep === 3 && "This helps us suggest crops that fit your investment capacity"}
                {currentStep === 4 && "Soil type affects crop selection and yield predictions"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Location */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Farm Location</Label>
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="location"
                          placeholder="e.g., Punjab, India or California, USA"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="pl-10 h-12"
                        />
                      </div>
                      <Button 
                        type="button" 
                        variant="secondary"
                        className="h-12 px-6"
                        disabled={!formData.location || isSearchingMap}
                        onClick={async () => {
                          setIsSearchingMap(true)
                          try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.location)}`)
                            const data = await res.json()
                            if (data && data.length > 0) {
                              const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
                              setSearchedLocation(coords)
                              setFormData({ ...formData, coordinates: coords, location: data[0].display_name })
                            }
                          } catch (err) {
                            console.error(err)
                          }
                          setIsSearchingMap(false)
                        }}
                      >
                        {isSearchingMap ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search Map"}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                     <Label>Or drop a pin on the map</Label>
                     <p className="text-xs text-muted-foreground mb-2">
                       Click on the map to accurately set your farm's location.
                     </p>
                     {/* @ts-ignore */}
                     <SelectMap
                       onLocationSelect={(coords: { lat: number; lng: number }) => {
                         setFormData({
                           ...formData,
                           coordinates: coords,
                           location: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
                         })
                       }}
                       searchedLocation={searchedLocation}
                     />
                     {formData.coordinates && (
                       <p className="text-sm font-medium text-primary mt-2 flex items-center gap-1">
                         <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                         Location Selected: {formData.coordinates.lat.toFixed(4)}, {formData.coordinates.lng.toFixed(4)}
                       </p>
                     )}
                  </div>
                </div>
              )}

              {/* Step 2: Farm Size */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="farmSize">Farm Size</Label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="farmSize"
                        type="text"
                        placeholder="e.g., 1 acre, 2 hectares, 10 football fields, or 10 brooms"
                        value={formData.farmSize}
                        onChange={(e) => {
                          const nextValue = e.target.value
                          const requiresDimensions = shouldRequireDimensions(nextValue)
                          setFormData({
                            ...formData,
                            farmSize: nextValue,
                            requiresDimensions,
                            farmLength: requiresDimensions ? formData.farmLength : "",
                            farmWidth: requiresDimensions ? formData.farmWidth : "",
                          })
                        }}
                        className="pl-10 h-12"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Supported direct inputs include square meters, acres, ekar, rai,
                        hectares, and football fields. For descriptive measurements like
                        objects or steps, we&apos;ll ask for exact dimensions below.
                      </p>
                      {!formData.requiresDimensions && extractAreaInSquareMeters(formData.farmSize) !== null && (
                        <p className="text-sm font-medium text-primary mt-2">
                          Approximate Area: {formatAreaInSquareMeters(extractAreaInSquareMeters(formData.farmSize)!)}
                        </p>
                      )}
                    </div>
                  </div>
                  {formData.requiresDimensions && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <p className="text-sm text-foreground/80">
                        We detected a descriptive measurement. For accuracy, please provide the exact dimensions of your farm below.
                      </p>
                      <div className="flex gap-4">
                        <div className="space-y-2 flex-1">
                          <Label htmlFor="farmLength">Length</Label>
                          <Input
                            id="farmLength"
                            type="text"
                            placeholder="e.g., 5 cars"
                            value={formData.farmLength}
                            onChange={(e) => setFormData({ ...formData, farmLength: e.target.value })}
                            className="h-11"
                          />
                          {formData.farmLength && extractDimension(formData.farmLength) > 0 && (
                            <p className="text-xs text-muted-foreground pl-1">
                              ≈ {extractDimension(formData.farmLength).toLocaleString()} m
                            </p>
                          )}
                        </div>
                        <div className="space-y-2 flex-1">
                          <Label htmlFor="farmWidth">Width</Label>
                          <Input
                            id="farmWidth"
                            type="text"
                            placeholder="e.g., 10 brooms"
                            value={formData.farmWidth}
                            onChange={(e) => setFormData({ ...formData, farmWidth: e.target.value })}
                            className="h-11"
                          />
                          {formData.farmWidth && extractDimension(formData.farmWidth) > 0 && (
                            <p className="text-xs text-muted-foreground pl-1">
                              ≈ {extractDimension(formData.farmWidth).toLocaleString()} m
                            </p>
                          )}
                        </div>
                      </div>
                      {computedAreaText && (
                        <p className="text-sm font-medium text-primary">
                          Total Area: {computedAreaText}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Budget */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget">Investment Budget (MYR)</Label>
                    <div className="relative">
                      <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="budget"
                        type="number"
                        placeholder="e.g., 10000"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        className="pl-10 h-12"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Soil Type */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="soilType">Soil Type</Label>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="text-muted-foreground hover:text-primary transition-colors focus:outline-none">
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[85vh] overflow-y-auto p-0 gap-0">
                          <div className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 px-6 py-4 border-b">
                            <DialogHeader>
                              <div className="flex items-center justify-between">
                                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                  <FlaskConical className="h-5 w-5 text-primary" />
                                  Soil Type Reference Guide
                                </DialogTitle>
                                <DialogClose asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full border border-red-200 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </DialogClose>
                              </div>
                              <DialogDescription>
                                Review these layered 3D models to help identify your soil type. Look at the texture, color, and layer composition.
                              </DialogDescription>
                            </DialogHeader>
                          </div>
                          <div className="p-6 grid grid-cols-1 gap-6">
                            {soilTypesInfo.map((soil) => (
                              <div key={soil.id} className="flex flex-col sm:flex-row gap-6 items-center sm:items-start p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                                <div className="shrink-0 w-48 h-48 relative rounded-xl overflow-hidden shadow-sm items-center justify-center flex bg-white/5 border border-border">
                                  <Image 
                                    src={soil.image}
                                    alt={soil.name}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <div className="space-y-2 flex-1">
                                  <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                    {soil.name}
                                  </h3>
                                  <p className="text-muted-foreground leading-relaxed">
                                    {soil.desc}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Select
                      value={formData.soilType}
                      onValueChange={(value) => setFormData({ ...formData, soilType: value })}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select soil type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loamy">Loamy Soil</SelectItem>
                        <SelectItem value="clay">Clay Soil</SelectItem>
                        <SelectItem value="sandy">Sandy Soil</SelectItem>
                        <SelectItem value="silt">Silt Soil</SelectItem>
                        <SelectItem value="peat">Peat Soil</SelectItem>
                        <SelectItem value="chalky">Chalky Soil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Unable to generate a plan</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col pt-4 mt-auto">
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                    className="h-11"
                  >
                    Previous
                  </Button>
                  {currentStep < 4 ? (
                    <Button
                      onClick={handleNext}
                      disabled={!canProceed}
                      className="h-11 gap-2"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        onClick={handleSubmit}
                        disabled={!canProceed || isSubmitting}
                        className="h-11 gap-2 bg-primary hover:bg-primary/90"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Generating Plan...
                          </>
                        ) : (
                          <>
                            Generate Smart Plan
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mr-1">
                        Your data is secure.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chatbot Card */}
          {currentStep === 4 && (
            <Card className="shadow-xl shadow-primary/5 border-border/50 lg:col-span-2 h-[550px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
              <CardHeader className="border-b bg-muted/10 pb-4 h-18 shrink-0 flex flex-row items-center space-y-0 gap-3">
                <div className="h-10 w-10 bg-primary/15 rounded-xl flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-foreground font-semibold">Soil Assistant</CardTitle>
                  <CardDescription className="text-xs">AI identifying your soil</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex items-end gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-muted" : "bg-primary/10"}`}>
                        {msg.role === "user" ? <User className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4 text-primary" />}
                      </div>
                      <div className={`max-w-[75%] rounded-2xl p-3 text-sm ${
                        msg.role === "user" 
                          ? "bg-primary text-primary-foreground rounded-br-none" 
                          : "bg-muted text-foreground rounded-bl-none"
                      }`}>
                        {msg.type === "image" ? (
                          <div className="space-y-2">
                            {msg.imageUrl && (
                              <img src={msg.imageUrl} alt="Uploaded soil" className="rounded-lg max-w-full max-h-40 object-cover" />
                            )}
                            <div className="flex items-center gap-2 text-xs opacity-80">
                              <ImageIcon className="h-3 w-3" />
                              <span>{msg.content}</span>
                            </div>
                          </div>
                        ) : msg.role === "bot" ? (
                          <span dangerouslySetInnerHTML={{ __html: highlightSoilTypes(msg.content) }} />
                        ) : (
                          msg.content
                        )}
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
                          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Chat Input */}
                <div className="p-3 border-t bg-card shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="shrink-0 h-10 w-10 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isChatLoading}
                      title="Upload photo"
                    >
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Input 
                      placeholder="Describe the soil, color, texture, etc..." 
                      className="flex-1 h-10 text-sm focus-visible:ring-1"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isChatLoading}
                    />
                    <Button 
                      type="submit" 
                      size="icon" 
                      className="shrink-0 h-10 w-10 transition-all hover:scale-105"
                      disabled={!chatInput.trim() || isChatLoading}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          )}

          </div>

          {/* Help Text removed from here and moved under the Generate button */}
        </div>
      </main>
    </div>
  )
}
