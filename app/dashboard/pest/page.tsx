"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Bug, Upload, ImageIcon, AlertTriangle, CheckCircle2,
  MapPin, Calendar, Leaf, FlaskConical,
  ScanLine, RefreshCw, ChevronDown, ChevronUp, Cpu, Zap,
  CircleAlert, CircleCheck, Sparkles, FileWarning,
} from "lucide-react"
import { detector, type Detection } from "@/lib/yolo-detector"

// ─── Static sidebar data ──────────────────────────────────────────────────────

const nearbyAlerts = [
  { id: 1, pest: "Aphids",      location: "5km north", date: "2 days ago", severity: "medium" },
  { id: 2, pest: "Leaf Blight", location: "8km east",  date: "5 days ago", severity: "high"   },
  { id: 3, pest: "Whiteflies",  location: "3km west",  date: "1 week ago", severity: "low"    },
]

const recentScans = [
  { id: 1, crop: "Wheat Field A3",    result: "Healthy",    date: "Yesterday",  severity: null  },
  { id: 2, crop: "Rice Paddy B1",     result: "Brown Spot", date: "3 days ago", severity: "low" },
  { id: 3, crop: "Vegetable Plot C2", result: "Healthy",    date: "1 week ago", severity: null  },
]

// ─── Helper: severity → tailwind classes ──────────────────────────────────────

const getSeverityStyle = (severity: string | null) => {
  switch (severity) {
    case "high":   return "bg-red-500/15    text-red-500    border-red-500/30"
    case "medium": return "bg-orange-500/15 text-orange-500 border-orange-500/30"
    case "low":    return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30"
    default:       return "bg-green-500/15  text-green-600  border-green-500/30"
  }
}

const SeverityDot = ({ s }: { s: string }) =>
  s === "high"   ? <CircleAlert className="h-3.5 w-3.5 text-red-500" />    :
  s === "medium" ? <CircleAlert className="h-3.5 w-3.5 text-orange-500" /> :
  s === "low"    ? <CircleAlert className="h-3.5 w-3.5 text-yellow-500" /> :
                   <CircleCheck className="h-3.5 w-3.5 text-green-500" />

// ─── Component ────────────────────────────────────────────────────────────────

type ModelStatus = "idle" | "loading" | "ready" | "error"

export default function PestDetectionPage() {
  const [detectionMode, setDetectionMode] = useState<'disease' | 'pest'>('disease')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging]     = useState(false)
  const [modelStatus, setModelStatus]   = useState<ModelStatus>("idle")
  const [loadProgress, setLoadProgress] = useState(0)
  const [isAnalyzing, setIsAnalyzing]   = useState(false)
  const [detections, setDetections]     = useState<Detection[]>([])
  const [expandedIdx, setExpandedIdx]   = useState<number | null>(0)
  const [origSize, setOrigSize]          = useState<{ w: number; h: number } | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const imgRef    = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ── Load model on first mount and layer switch ──────────────────────────────────────────────
  useEffect(() => {
    setModelStatus("loading")
    let progress = 0
    const tick = setInterval(() => {
      progress = Math.min(progress + Math.random() * 12, 90)
      setLoadProgress(Math.round(progress))
    }, 300)

    detector.load(detectionMode)
      .then(() => {
        clearInterval(tick)
        setLoadProgress(100)
        setTimeout(() => setModelStatus("ready"), 300)
        
        // Auto-run if there is an image loaded when swapping!
        if (imgRef.current) {
          runDetection(imgRef.current)
        }
      })
      .catch((e) => {
        clearInterval(tick)
        setModelStatus("error")
        setError(String(e))
      })

    return () => clearInterval(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionMode])

  // ── Re-draw bounding boxes whenever detections change ─────────────────────
  useEffect(() => {
    if (!canvasRef.current || !origSize || detections.length === 0) {
      canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      return
    }
    const renderScale = Math.max(1, 1200 / origSize.w)
    canvasRef.current.width = origSize.w * renderScale
    canvasRef.current.height = origSize.h * renderScale
    detector.drawDetections(canvasRef.current, detections, origSize.w, origSize.h)
  }, [detections, origSize])

  // ── Process uploaded file ──────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImageDataUrl(dataUrl)
      setDetections([])
      setExpandedIdx(null)

      const img = new Image()
      img.onload = () => {
        setOrigSize({ w: img.naturalWidth, h: img.naturalHeight })
        runDetection(img)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0])
    e.target.value = ""
  }

  // ── YOLO inference ────────────────────────────────────────────────────────
  const runDetection = async (imgEl: HTMLImageElement) => {
    setIsAnalyzing(true)
    setDetections([])
    try {
      if (!detector.isLoaded) await detector.load(detectionMode)
      const found = await detector.detect(imgEl)
      setDetections(found)
      setExpandedIdx(found.length > 0 ? 0 : null)
    } catch (e) {
      setError(`Detection failed: ${e}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const rerun = () => {
    if (imgRef.current) runDetection(imgRef.current)
  }

  const resetScan = () => {
    setImageDataUrl(null)
    setDetections([])
    setOrigSize(null)
    setExpandedIdx(null)
    setError(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bug className="h-6 w-6 text-primary" />
              Pest &amp; Disease Detection
            </h1>
            <p className="text-xs text-muted-foreground">
              YOLOv8 · {detectionMode === 'pest' ? 'Pest detection' : 'Disease detection'}
            </p>
          </div>

          {/* Model status pill */}
          <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
            modelStatus === "ready"   ? "bg-green-500/10  text-green-600  border-green-500/30"  :
            modelStatus === "loading" ? "bg-blue-500/10   text-blue-500   border-blue-500/30 animate-pulse" :
            modelStatus === "error"   ? "bg-red-500/10    text-red-500    border-red-500/30"    :
                                        "bg-muted text-muted-foreground border-border"
          }`}>
            <Cpu className="h-3.5 w-3.5" />
            {modelStatus === "ready"   && `${detectionMode === 'pest' ? 'Pest' : 'Disease'} Model · Ready`}
            {modelStatus === "loading" && `Loading ${detectionMode === 'pest' ? 'Pest' : 'Disease'} Model… ${loadProgress}%`}
            {modelStatus === "error"   && "Model error"}
            {modelStatus === "idle"    && "Initialising…"}
          </div>
        </div>

        {/* Loading bar under header */}
        {modelStatus === "loading" && (
          <Progress value={loadProgress} className="h-0.5 rounded-none" />
        )}
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">

          {/* ── Main column ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Mode toggle */}
            <div className="flex bg-muted/50 p-1.5 rounded-xl w-full max-w-sm mb-4 border border-border">
              <button
                onClick={() => { if (detectionMode !== 'disease') { resetScan(); setDetectionMode('disease') } }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                  detectionMode === 'disease' 
                    ? 'bg-background shadow-sm text-foreground ring-1 ring-border' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Leaf className="h-4 w-4" />
                Diagnose Diseases
              </button>
              <button
                onClick={() => { if (detectionMode !== 'pest') { resetScan(); setDetectionMode('pest') } }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
                  detectionMode === 'pest' 
                    ? 'bg-background shadow-sm text-foreground ring-1 ring-border' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Bug className="h-4 w-4" />
                Detect Pests
              </button>
            </div>

            {/* ── Upload / Preview card ──────────────────────────────────── */}
            <Card className="shadow-lg shadow-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-primary" />
                  Upload Plant Image
                </CardTitle>
                <CardDescription>
                  Drag & drop or click to upload — YOLO AI detects objects and pests instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {!imageDataUrl ? (
                  /* ── Drop zone ──────────────────────────────────────────── */
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
                      isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    } ${modelStatus === "loading" ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-4 pointer-events-none">
                      <div className={`h-20 w-20 rounded-2xl flex items-center justify-center transition-all ${
                        isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"
                      }`}>
                        <Upload className={`h-9 w-9 transition-colors ${isDragging ? "text-primary" : "text-primary/70"}`} />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {modelStatus === "loading" ? "Model loading — please wait…" : "Drop your plant photo here"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {modelStatus !== "loading" && "or click to browse from your device"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>JPG · PNG · WEBP</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          <span>In-browser WASM inference</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Image + canvas overlay ──────────────────────────── */
                  <div className="space-y-3">
                    <div
                      className="relative rounded-2xl overflow-hidden bg-muted"
                      style={{ maxHeight: 500 }}
                    >
                      <img
                        ref={imgRef}
                        src={imageDataUrl}
                        alt="Uploaded plant"
                        className="w-full object-contain block"
                        style={{ maxHeight: 500 }}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{ pointerEvents: "none" }}
                      />
                      {/* Analysing overlay */}
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
                          <div className="text-center space-y-3 p-6">
                            <div className="relative mx-auto h-14 w-14">
                              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                              <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                              <Bug className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Running YOLO detection…</p>
                            <p className="text-xs text-muted-foreground">Scanning for pests and diseases</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={resetScan} className="flex-1 gap-2">
                        <Upload className="h-4 w-4" />
                        Upload New
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={rerun}
                        disabled={isAnalyzing || modelStatus !== "ready"}
                        className="flex-1 gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                        Re-analyze
                      </Button>
                    </div>
                  </div>
                )}


              </CardContent>
            </Card>

            {/* ── Error alert ───────────────────────────────────────────── */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/5">
                <FileWarning className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-500">Error</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{error}</p>
                </div>
              </div>
            )}

            {/* ── Detection results ──────────────────────────────────────── */}
            {!isAnalyzing && imageDataUrl && !error && (
              <>
                {detections.length === 0 ? (
                  <Card className="border-green-500/30 bg-green-500/5">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">No objects detected</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Try a clearer image or capture the plant from a closer angle.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {/* Result summary row */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-medium text-muted-foreground">
                        {detections.length} detection{detections.length !== 1 ? "s" : ""} found
                      </h2>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">YOLOv8 Results</Badge>
                    </div>

                    {/* Detection cards */}
                    {detections.map((det, idx) => {
                      const confidencePercent = Math.round(det.confidence * 100)

                      return (
                        <Card
                          key={idx}
                          className="overflow-hidden transition-all duration-200"
                          style={{ borderColor: `${det.color}50` }}
                        >
                        {/* Clickable header */}
                        <button
                          className="w-full text-left focus:outline-none"
                          onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        >
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Colour swatch icon */}
                                <div
                                  className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: `${det.color}20` }}
                                >
                                  {det.isHealthy
                                    ? <Leaf className="h-4 w-4" style={{ color: det.color }} />
                                    : <Bug  className="h-4 w-4" style={{ color: det.color }} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-foreground truncate">
                                    {det.displayName}
                                  </p>
                                  {det.crop !== "N/A" && (
                                    <p className="text-xs text-muted-foreground">{det.crop}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0 sm:gap-3">
                                {det.severity !== "none" && (
                                  <Badge className={`text-xs ${getSeverityStyle(det.severity)}`}>
                                    {det.severity}
                                  </Badge>
                                )}
                                <div
                                  className="min-w-[74px] rounded-lg border px-2 py-1 text-center"
                                  style={{
                                    backgroundColor: `${det.color}12`,
                                    borderColor: `${det.color}55`,
                                    boxShadow: `0 12px 20px -24px ${det.color}`,
                                  }}
                                >
                                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Confidence
                                  </p>
                                  <p
                                    className="mt-0.5 text-lg font-black leading-none tabular-nums"
                                    style={{ color: det.color }}
                                  >
                                    {confidencePercent}%
                                  </p>
                                </div>
                                <div className="rounded-full border border-border/70 bg-background/80 p-1">
                                  {expandedIdx === idx
                                    ? <ChevronUp   className="h-4 w-4 text-muted-foreground" />
                                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        </button>

                        {/* Expanded body */}
                        {expandedIdx === idx && (
                          <CardContent className="pt-0 pb-4 px-4 space-y-4 border-t border-border">
                            {/* Bounding box coords */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {[["X1", Math.round(det.bbox[0])], ["Y1", Math.round(det.bbox[1])],
                                ["X2", Math.round(det.bbox[2])], ["Y2", Math.round(det.bbox[3])]].map(([k, v]) => (
                                <div key={k} className="bg-muted/50 rounded-lg px-3 py-2 flex justify-between">
                                  <span className="text-muted-foreground">{k}</span>
                                  <span className="font-mono font-medium">{v} px</span>
                                </div>
                              ))}
                            </div>

                            {/* Treatment (only for non-N/A) */}
                            {det.treatment !== "N/A" && !det.isHealthy && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <FlaskConical className="h-4 w-4 text-primary" />
                                  Treatment
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                  {det.treatment}
                                </p>
                              </div>
                            )}

                            {/* Prevention (only for non-N/A) */}
                            {det.prevention !== "N/A" && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <Leaf className="h-4 w-4 text-green-500" />
                                  {det.isHealthy ? "Care Tips" : "Prevention"}
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                  {det.prevention}
                                </p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <Button size="sm" className="flex-1">Save to Records</Button>
                              <Button size="sm" variant="outline" className="flex-1">Expert Help</Button>
                            </div>
                          </CardContent>
                        )}
                        </Card>
                    )})}
                  </div>
                )}
              </>
            )}

          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">

            {/* Nearby alerts */}
            <Card className="shadow shadow-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Nearby Pest Alerts
                </CardTitle>
                <CardDescription>Reported pest activity in your area</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {nearbyAlerts.map((a) => (
                    <div key={a.id} className="p-3 rounded-xl border border-border hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <SeverityDot s={a.severity} />
                          <span className="text-sm font-medium text-foreground">{a.pest}</span>
                        </div>
                        <Badge className={`text-xs ${getSeverityStyle(a.severity)}`}>{a.severity}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><MapPin   className="h-3 w-3" />{a.location}</div>
                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{a.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent scans */}
            <Card className="shadow shadow-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Recent Scans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {recentScans.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.crop}</p>
                        <p className="text-xs text-muted-foreground">{s.date}</p>
                      </div>
                      <Badge className={`text-xs ${getSeverityStyle(s.severity)}`}>{s.result}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}
