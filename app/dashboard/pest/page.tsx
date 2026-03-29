"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Bug, Upload, ImageIcon, AlertTriangle, CheckCircle2, 
  MapPin, Calendar, Leaf, ShieldAlert, FlaskConical, Info
} from "lucide-react"

interface DetectionResult {
  disease: string
  severity: "low" | "medium" | "high"
  confidence: number
  treatment: string
  prevention: string
}

const nearbyAlerts = [
  {
    id: 1,
    pest: "Aphids",
    location: "5km north",
    date: "2 days ago",
    severity: "medium",
  },
  {
    id: 2,
    pest: "Leaf Blight",
    location: "8km east",
    date: "5 days ago",
    severity: "high",
  },
  {
    id: 3,
    pest: "Whiteflies",
    location: "3km west",
    date: "1 week ago",
    severity: "low",
  },
]

const recentScans = [
  {
    id: 1,
    crop: "Wheat Field A3",
    result: "Healthy",
    date: "Yesterday",
    severity: null,
  },
  {
    id: 2,
    crop: "Rice Paddy B1",
    result: "Brown Spot",
    date: "3 days ago",
    severity: "low",
  },
  {
    id: 3,
    crop: "Vegetable Plot C2",
    result: "Healthy",
    date: "1 week ago",
    severity: null,
  },
]

export default function PestDetectionPage() {
  const [image, setImage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
        analyzeImage()
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
        analyzeImage()
      }
      reader.readAsDataURL(file)
    }
  }

  const analyzeImage = () => {
    setIsAnalyzing(true)
    setResult(null)
    // Simulate AI analysis
    setTimeout(() => {
      setResult({
        disease: "Late Blight (Phytophthora infestans)",
        severity: "medium",
        confidence: 94,
        treatment: "Apply copper-based fungicide immediately. Remove and destroy affected leaves. Ensure proper plant spacing for air circulation.",
        prevention: "Use certified disease-free seeds. Avoid overhead irrigation. Apply preventive fungicides during humid conditions.",
      })
      setIsAnalyzing(false)
    }, 2000)
  }

  const getSeverityStyle = (severity: string | null) => {
    switch (severity) {
      case "high":
        return "bg-destructive/15 text-destructive border-destructive/30"
      case "medium":
        return "bg-warning/15 text-warning-foreground border-warning/30"
      case "low":
        return "bg-success/15 text-success border-success/30"
      default:
        return "bg-primary/15 text-primary border-primary/30"
    }
  }

  const resetScan = () => {
    setImage(null)
    setResult(null)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="px-6 h-16 flex items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pest Detection</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered disease and pest identification
            </p>
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Upload Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-primary" />
                  Upload Plant Image
                </CardTitle>
                <CardDescription>
                  Take a photo or upload an image of the affected plant
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!image ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-foreground">
                          Drag and drop your image here
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          or click to browse from your device
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                        <span>Supports JPG, PNG, WEBP</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image Preview */}
                    <div className="relative rounded-2xl overflow-hidden bg-muted aspect-video">
                      <img
                        src={image}
                        alt="Uploaded plant"
                        className="w-full h-full object-cover"
                      />
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <div className="text-center space-y-3">
                            <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                            <p className="text-sm font-medium text-foreground">Analyzing image...</p>
                            <p className="text-xs text-muted-foreground">
                              AI is scanning for diseases and pests
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" onClick={resetScan} className="w-full">
                      Scan Another Image
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detection Result */}
            {result && (
              <Card className="shadow-lg shadow-primary/5 border-primary/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-primary" />
                      Detection Result
                    </CardTitle>
                    <Badge className={getSeverityStyle(result.severity)}>
                      {result.severity} severity
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Disease Name */}
                  <div className="p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Identified Disease</span>
                      <span className="text-sm text-primary font-medium">{result.confidence}% confidence</span>
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{result.disease}</h3>
                  </div>

                  {/* Treatment */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">Recommended Treatment</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                      {result.treatment}
                    </p>
                  </div>

                  {/* Prevention */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-success" />
                      <span className="font-medium text-foreground">Prevention Tips</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                      {result.prevention}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button className="flex-1">Save to Records</Button>
                    <Button variant="outline" className="flex-1">Get Expert Help</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Nearby Alerts */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Nearby Pest Alerts
                </CardTitle>
                <CardDescription>
                  Reported pest activity in your area
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nearbyAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-xl border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium text-foreground">{alert.pest}</span>
                        <Badge className={getSeverityStyle(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {alert.location}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {alert.date}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Scans */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Recent Scans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{scan.crop}</p>
                        <p className="text-xs text-muted-foreground">{scan.date}</p>
                      </div>
                      <Badge className={getSeverityStyle(scan.severity)}>
                        {scan.result}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="shadow-lg shadow-primary/5 bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Pro Tip</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      For best results, take close-up photos of affected leaves in natural daylight. Include both healthy and affected areas for comparison.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
