"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Leaf, MapPin, Ruler, Wallet, FlaskConical, ArrowRight, CheckCircle2, HelpCircle, Image as ImageIcon, Send, Loader2, Bot, User } from "lucide-react"
import dynamic from 'next/dynamic'
import Image from "next/image"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const SelectMap = dynamic(() => import('@/components/SelectMap'), { ssr: false })

const steps = [
  { id: 1, title: "Location", icon: MapPin },
  { id: 2, title: "Farm Details", icon: Ruler },
  { id: 3, title: "Budget", icon: Wallet },
  { id: 4, title: "Soil Type", icon: FlaskConical },
]

const soilTypesInfo = [
  { id: "loamy", name: "Loamy Soil", image: "/soil/loamy_soil_1775015791041.png", desc: "A balanced mixture of sand, silt, and clay. Considered the ideal soil for most agricultural uses due to its excellent moisture retention and nutrient-rich composition." },
  { id: "clay", name: "Clay Soil", image: "/soil/clay_soil_1775016303702.png", desc: "Dense soil with tiny particles that stick together. Holds moisture and nutrients well, but can be prone to poor drainage and becomes hard when dry." },
  { id: "sandy", name: "Sandy Soil", image: "/soil/sandy_soil_1775016320859.png", desc: "Loose and granular soil that drains water quickly. Warms up fast in spring but struggles to retain nutrients and moisture, requiring frequent irrigation." },
  { id: "silt", name: "Silt Soil", image: "/soil/silt_soil_1775016335728.png", desc: "Fine, smooth soil particles that retain water well. Very fertile but easily compacted and prone to waterlogging." },
  { id: "peat", name: "Peat Soil", image: "/soil/peat_soil_1775016349935.png", desc: "Dark and rich in organic material. Excellent for retaining moisture but can be highly acidic, often requiring amendments to balance pH." },
  { id: "chalky", name: "Chalky Soil", image: "/soil/chalky_soil_1775016364929.png", desc: "Highly alkaline soil containing large stones or limestone. Drains freely but can cause stunted growth in plants lacking iron or manganese." }
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    location: "",
    coordinates: null as { lat: number; lng: number } | null,
    farmSize: "",
    budget: "",
    soilType: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Chatbot State
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{role: "user" | "bot", content: string, type: "text" | "image"}[]>([
    { role: "bot", content: "Hi! I'm your Agritwin soil assistant. Describe your soil's texture, color, or behavior, or upload a photo to get help identifying it.", type: "text" }
  ])

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMessage = chatInput
    setChatInput("")
    setChatMessages(prev => [...prev, { role: "user", content: userMessage, type: "text" }])
    setIsChatLoading(true)

    // Simulate AI thinking and replying
    setTimeout(() => {
      const lower = userMessage.toLowerCase()
      let reply = "Based on your description, it sounds like you might have Loamy soil. It's the most ideal for farming! If you check the soil reference (?) icon, you can see if the layers match your field."
      
      if (lower.includes("sticky") || lower.includes("hard")) {
        reply = "That sticky and hard texture usually points to Clay soil. Clay holds water well but needs proper drainage."
      } else if (lower.includes("sand") || lower.includes("loose") || lower.includes("drain")) {
        reply = "Loose soil that drains fast is generally Sandy soil. It warms quickly but needs more watering."
      } else if (lower.includes("dark") || lower.includes("rich")) {
        reply = "Dark, rich soil is often Peat or highly organic Loam. Peat is great for retaining moisture."
      } else if (lower.includes("white") || lower.includes("stone") || lower.includes("chalk")) {
        reply = "Limestone fragments and lighter color typically indicate Chalky soil, which is very alkaline."
      }

      setChatMessages(prev => [...prev, { role: "bot", content: reply, type: "text" }])
      setIsChatLoading(false)
    }, 1500)
  }

  const handleMockImageUpload = () => {
    setChatMessages(prev => [...prev, { role: "user", content: "Uploaded a photo of my soil.", type: "image" }])
    setIsChatLoading(true)
    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: "bot", content: "Looking at the distinct topsoil chunks and color, it appears highly organic. It looks like Loamy or Peat soil. I recommend selecting Loamy for your plan.", type: "text" }])
      setIsChatLoading(false)
    }, 2500)
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
    // Store form data in localStorage for demo purposes
    localStorage.setItem("farmData", JSON.stringify(formData))
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    router.push("/planning")
  }

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1:
        return formData.location.length > 0
      case 2:
        return formData.farmSize.length > 0
      case 3:
        return formData.budget.length > 0
      case 4:
        return formData.soilType.length > 0
      default:
        return false
    }
  }

  const canProceed = isStepComplete(currentStep)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg text-foreground">AgriTwin AI</span>
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

          <div className={`transition-all duration-500 ease-in-out ${currentStep === 4 ? "grid grid-cols-1 lg:grid-cols-5 gap-6" : ""}`}>
            {/* Form Card */}
            <Card className={`shadow-xl shadow-primary/5 border-border/50 flex flex-col ${currentStep === 4 ? "lg:col-span-3 h-[550px]" : ""}`}>
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
            <CardContent className="space-y-6 flex-1 overflow-y-auto">
              {/* Step 1: Location */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Farm Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="location"
                        placeholder="e.g., Punjab, India or California, USA"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="pl-10 h-12"
                      />
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
                    <Label htmlFor="farmSize">Farm Size (in acres)</Label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="farmSize"
                        type="number"
                        placeholder="e.g., 50"
                        value={formData.farmSize}
                        onChange={(e) => setFormData({ ...formData, farmSize: e.target.value })}
                        className="pl-10 h-12"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Budget */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget">Investment Budget (USD)</Label>
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
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="soilType">Soil Type</Label>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="text-muted-foreground hover:text-primary transition-colors focus:outline-none">
                            <HelpCircle className="h-4 w-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0">
                          <div className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 px-6 py-4 border-b">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <FlaskConical className="h-5 w-5 text-primary" />
                                Soil Type Reference Guide
                              </DialogTitle>
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
                          <div className="flex items-center gap-2">
                            <ImageIcon className="h-4 w-4" />
                            <span>Image uploaded</span>
                          </div>
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
                  <form onSubmit={handleChatSubmit} className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="shrink-0 h-10 w-10 border-dashed"
                      onClick={handleMockImageUpload}
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
