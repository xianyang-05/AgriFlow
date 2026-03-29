"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Leaf, MapPin, Ruler, Wallet, FlaskConical, ArrowRight, CheckCircle2 } from "lucide-react"

const steps = [
  { id: 1, title: "Location", icon: MapPin },
  { id: 2, title: "Farm Details", icon: Ruler },
  { id: 3, title: "Budget", icon: Wallet },
  { id: 4, title: "Soil Type", icon: FlaskConical },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    location: "",
    farmSize: "",
    budget: "",
    soilType: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        <div className="w-full max-w-2xl">
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

          {/* Form Card */}
          <Card className="shadow-xl shadow-primary/5 border-border/50">
            <CardHeader className="pb-4">
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="soilType">Soil Type</Label>
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

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4">
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
                )}
              </div>
            </CardContent>
          </Card>

          {/* Help Text */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Your data is secure and will only be used to generate personalized recommendations.
          </p>
        </div>
      </main>
    </div>
  )
}
