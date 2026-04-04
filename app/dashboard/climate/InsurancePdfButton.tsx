"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Download, Loader2, RotateCcw } from "lucide-react"

type FormDataState = {
  fullName: string
  icNumber: string
  contact: string
  farmArea: string
  location: string
}

const defaultFormData: FormDataState = {
  fullName: "Ahmad bin Ali",
  icNumber: "850212-10-5541",
  contact: "012-3456789",
  farmArea: "5",
  location: "Selangor, Petaling Jaya",
}

function SignaturePad({
  onChange,
}: {
  onChange: (value: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isDrawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  const exportSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data, width, height } = imageData
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3]
        if (alpha > 0) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }

    if (maxX === -1 || maxY === -1) {
      onChange("")
      return
    }

    const padding = 12
    const cropX = Math.max(minX - padding, 0)
    const cropY = Math.max(minY - padding, 0)
    const cropWidth = Math.min(maxX - minX + padding * 2 + 1, width - cropX)
    const cropHeight = Math.min(maxY - minY + padding * 2 + 1, height - cropY)

    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = cropWidth
    tempCanvas.height = cropHeight
    const tempCtx = tempCanvas.getContext("2d")
    if (!tempCtx) return

    tempCtx.putImageData(ctx.getImageData(cropX, cropY, cropWidth, cropHeight), 0, 0)
    onChange(tempCanvas.toDataURL("image/png"))
  }

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    const ratio = window.devicePixelRatio || 1
    const width = wrapper.clientWidth
    const height = 300
    const previous = hasDrawnRef.current ? canvas.toDataURL("image/png") : null

    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineWidth = 2.5
    ctx.strokeStyle = "#111111"

    if (previous) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
      }
      img.src = previous
    }
  }

  useEffect(() => {
    redrawCanvas()

    const handleResize = () => redrawCanvas()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const point = getPoint(event)
    isDrawingRef.current = true
    canvas.setPointerCapture(event.pointerId)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !isDrawingRef.current) return

    const point = getPoint(event)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    hasDrawnRef.current = true
  }

  const stopDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (event && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }

    isDrawingRef.current = false
    exportSignature()
  }

  const clearSignature = () => {
    hasDrawnRef.current = false
    onChange("")
    redrawCanvas()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">E-Signature</Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearSignature}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
      <div ref={wrapperRef} className="rounded-xl border border-border bg-white p-2">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none rounded-lg"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sign inside the box. Your signature will be placed into the declaration section of the PDF.
      </p>
    </div>
  )
}

export default function InsurancePdfButton() {
  const [isPreFilling, setIsPreFilling] = useState(false)
  const [preFillSuccess, setPreFillSuccess] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState("")
  const [formData, setFormData] = useState<FormDataState>(defaultFormData)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleDownload = async () => {
    if (!formData.fullName || !formData.icNumber || !formData.farmArea) {
      alert("Please fill in all required fields.")
      return
    }

    if (!signatureDataUrl) {
      alert("Please add your signature before generating the PDF.")
      return
    }

    setIsPreFilling(true)

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          signatureDataUrl,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to generate PDF")
      }

      window.location.href = result.downloadUrl

      setTimeout(() => {
        setIsPreFilling(false)
        setPreFillSuccess(true)
      }, 1500)
    } catch (err) {
      console.error(err)
      setIsPreFilling(false)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  if (preFillSuccess) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="mb-1 text-base font-semibold">Download Complete!</p>
          <p className="text-xs">
            Your application form for <strong>{formData.farmArea} hectares</strong> in <strong>{formData.location}</strong> has been generated successfully. Please print the PDF and proceed to your nearest Agrobank branch or PPK to finalize your STTP registration.
          </p>
          <Button className="mt-3 w-full" variant="outline" onClick={() => setPreFillSuccess(false)}>
            Generate Another Form
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-4">
        <div className="mb-2 text-sm font-semibold">Applicant Details</div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="fullName" className="text-xs">Full Name</Label>
            <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="icNumber" className="text-xs">IC Number</Label>
            <Input id="icNumber" name="icNumber" value={formData.icNumber} onChange={handleChange} className="h-8 text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="contact" className="text-xs">Contact Number</Label>
            <Input id="contact" name="contact" value={formData.contact} onChange={handleChange} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="farmArea" className="text-xs">Farm Area (Hectares)</Label>
            <Input id="farmArea" name="farmArea" type="number" step="0.1" value={formData.farmArea} onChange={handleChange} className="h-8 text-xs" />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="location" className="text-xs">Farm Location</Label>
          <Input id="location" name="location" value={formData.location} onChange={handleChange} className="h-8 text-xs" />
        </div>

        <SignaturePad onChange={setSignatureDataUrl} />
      </div>

      <Button onClick={handleDownload} disabled={isPreFilling} className="w-full gap-2">
        {isPreFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {isPreFilling ? "Generating Secure PDF..." : "Generate & Download PDF"}
      </Button>
    </div>
  )
}
