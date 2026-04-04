/**
 * YOLODetector — runs a YOLOv8 ONNX plant disease detection model in-browser
 * using ONNX Runtime Web (WebAssembly backend).
 *
 * Supports any YOLOv8 ONNX model with output shape [1, 4+num_classes, 8400].
 */

export interface Detection {
  label: string
  displayName: string
  crop: string
  confidence: number
  /** Bounding box in original image pixels: [x1, y1, x2, y2] */
  bbox: [number, number, number, number]
  severity: 'low' | 'medium' | 'high' | 'none'
  treatment: string
  prevention: string
  isHealthy: boolean
  color: string
}

interface PlantClass {
  id: number
  name: string
  displayName: string
  crop: string
  severity: 'low' | 'medium' | 'high' | 'none'
  treatment: string
  prevention: string
  isHealthy: boolean
}

// Severity → bounding box colour
const SEVERITY_COLORS: Record<string, string> = {
  none: '#22c55e',   // green
  low: '#eab308',    // yellow
  medium: '#f97316', // orange
  high: '#ef4444',   // red
}

class YOLODetector {
  private session: import('onnxruntime-web').InferenceSession | null = null
  private classes: PlantClass[] = []
  private loading = false
  private loaded = false

  private lastMode: string | null = null

  /** Load model + class labels. Safe to call multiple times with different modes. */
  async load(mode: 'disease' | 'pest' = 'disease'): Promise<void> {
    if (this.loaded && this.lastMode === mode) return
    if (this.loading) return
    
    this.loading = true
    this.loaded = false // reset for new mode
    this.lastMode = mode

    // Gracefully release the prior session to prevent WASM WASI memory leaks
    if (this.session) {
      try {
        await this.session.release()
      } catch (e) {
        // Safe to ignore release errors
      }
      this.session = null
    }


    try {
      // Dynamic import keeps onnxruntime-web out of SSR
      const ort = await import('onnxruntime-web')

      // Use jsDelivr CDN for WASM files – no special webpack config required
      // NOTE: The version here MUST exactly match the installed npm version
      ort.env.wasm.wasmPaths =
        'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'

      const classesFile = mode === 'pest' ? '/models/pest-classes.json' : '/models/plant-classes.json'
      const modelFile = mode === 'pest' ? '/models/yolov8-pest.onnx' : '/models/yolov8-plant.onnx'

      // Load class labels
      const res = await fetch(classesFile)
      if (!res.ok) throw new Error(`Could not load ${classesFile}`)
      this.classes = await res.json()

      // Load the ONNX model
      this.session = await ort.InferenceSession.create(modelFile, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      })

      this.loaded = true
    } finally {
      this.loading = false
    }
  }

  get isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Run detection on an image element.
   * Returns the strongest post-NMS detections without applying a confidence cutoff.
   */
  async detect(
    imageEl: HTMLImageElement | HTMLCanvasElement,
  ): Promise<Detection[]> {
    if (!this.session) throw new Error('Model not loaded – call detect.load() first')

    const ort = await import('onnxruntime-web')
    const INPUT_SIZE = 640

    // ── 1. Letterbox-resize the image to 640×640 ──────────────────────────────
    const origW =
      imageEl instanceof HTMLImageElement ? imageEl.naturalWidth : imageEl.width
    const origH =
      imageEl instanceof HTMLImageElement ? imageEl.naturalHeight : imageEl.height

    const scale = Math.min(INPUT_SIZE / origW, INPUT_SIZE / origH)
    const newW = Math.round(origW * scale)
    const newH = Math.round(origH * scale)
    const padX = (INPUT_SIZE - newW) / 2
    const padY = (INPUT_SIZE - newH) / 2

    const canvas = document.createElement('canvas')
    canvas.width = INPUT_SIZE
    canvas.height = INPUT_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#808080'          // neutral grey padding
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
    ctx.drawImage(imageEl, padX, padY, newW, newH)

    // ── 2. Convert RGBA pixel data → Float32 CHW ──────────────────────────────
    const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
    const N = INPUT_SIZE * INPUT_SIZE
    const float32 = new Float32Array(3 * N)
    for (let i = 0; i < N; i++) {
      float32[i]         = data[i * 4]     / 255  // R
      float32[N + i]     = data[i * 4 + 1] / 255  // G
      float32[2 * N + i] = data[i * 4 + 2] / 255  // B
    }

    // ── 3. Run ONNX inference ──────────────────────────────────────────────────
    const inputTensor = new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE])
    const feeds: Record<string, import('onnxruntime-web').Tensor> = {}
    feeds[this.session.inputNames[0]] = inputTensor
    const results = await this.session.run(feeds)
    const output = results[this.session.outputNames[0]]
    const outputData = output.data as Float32Array

    // ── 4. Parse output tensor [1, 4+nc, 8400] or [1, 8400, 4+nc] ────────────
    let numAnchors: number
    let numClassesPlusFour: number
    let transposed = false

    if (output.dims[1] < output.dims[2]) {
      // [1, 4+nc, 8400]  → standard YOLOv8 export
      numClassesPlusFour = output.dims[1]
      numAnchors          = output.dims[2]
    } else {
      // [1, 8400, 4+nc]  → transposed variant
      numAnchors          = output.dims[1]
      numClassesPlusFour  = output.dims[2]
      transposed          = true
    }
    const numClasses = numClassesPlusFour - 4

    const raw: Detection[] = []

    for (let i = 0; i < numAnchors; i++) {
      const get = (row: number) =>
        transposed
          ? outputData[i * numClassesPlusFour + row]
          : outputData[row * numAnchors + i]

      const cx = get(0)
      const cy = get(1)
      const bw = get(2)
      const bh = get(3)

      let maxScore = -Infinity
      let maxIdx   = 0
      for (let c = 0; c < numClasses; c++) {
        const s = get(4 + c)
        if (s > maxScore) { maxScore = s; maxIdx = c }
      }

      // Convert cx,cy,w,h (letterbox coords) → x1,y1,x2,y2 (original pixels)
      const x1 = Math.max(0,     ((cx - bw / 2) - padX) / scale)
      const y1 = Math.max(0,     ((cy - bh / 2) - padY) / scale)
      const x2 = Math.min(origW, ((cx + bw / 2) - padX) / scale)
      const y2 = Math.min(origH, ((cy + bh / 2) - padY) / scale)

      const confidencePercent = Math.round(maxScore * 100)

      // Skip invalid boxes and detections that would display as 0% confidence.
      if (!Number.isFinite(maxScore) || confidencePercent <= 0 || x2 <= x1 || y2 <= y1) continue

      const cls: PlantClass = this.classes[maxIdx] ?? {
        id: maxIdx,
        name: `class_${maxIdx}`,
        displayName: `Unknown Class ${maxIdx}`,
        crop: 'Unknown',
        severity: 'medium',
        treatment: 'Consult an agricultural expert.',
        prevention: 'Monitor crops regularly.',
        isHealthy: false,
      }

      raw.push({
        label:       cls.name,
        displayName: cls.displayName,
        crop:        cls.crop,
        confidence:  maxScore,
        bbox:        [x1, y1, x2, y2],
        severity:    cls.severity,
        treatment:   cls.treatment,
        prevention:  cls.prevention,
        isHealthy:   cls.isHealthy,
        color:       SEVERITY_COLORS[cls.severity] ?? '#ef4444',
      })
    }

    // ── 5. Non-Maximum Suppression ─────────────────────────────────────────────
    return this.nms(raw, 0.45).slice(0, 50)
  }

  /**
   * Draw bounding boxes + labels onto a canvas that overlays the image.
   */
  drawDetections(
    canvas: HTMLCanvasElement,
    detections: Detection[],
    origW: number,
    origH: number,
  ): void {
    const ctx = canvas.getContext('2d')!
    const scaleX = canvas.width  / origW
    const scaleY = canvas.height / origH

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const det of detections) {
      const [x1, y1, x2, y2] = det.bbox
      const sx1 = x1 * scaleX
      const sy1 = y1 * scaleY
      const sw  = (x2 - x1) * scaleX
      const sh  = (y2 - y1) * scaleY

      // Adjust sizes proportionally to the image's natural resolution
      const baseScale = Math.max(canvas.width, canvas.height) / 640
      const fontSize = Math.max(4, Math.round(14 * baseScale))
      const paddingX = Math.max(2, Math.round(6 * baseScale))
      const paddingY = Math.max(2, Math.round(4 * baseScale))

      // Box
      ctx.strokeStyle = det.color
      ctx.lineWidth   = Math.max(1.5, 3 * baseScale)
      ctx.strokeRect(sx1, sy1, sw, sh)

      // Label background
      const label = `${det.displayName} ${Math.round(det.confidence * 100)}%`
      ctx.font = `bold ${fontSize}px Inter, sans-serif`
      const textW = ctx.measureText(label).width + paddingX * 2
      const labelHeight = fontSize + paddingY * 2
      const labelY = sy1 > labelHeight ? sy1 - labelHeight : sy1 + (2 * baseScale)

      ctx.fillStyle = det.color
      ctx.fillRect(sx1, labelY, textW, labelHeight)

      // Label text
      ctx.fillStyle = '#ffffff'
      // +1 to help vertically center the text in the box
      ctx.fillText(label, sx1 + paddingX, labelY + fontSize + paddingY - 1)
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private nms(detections: Detection[], iouThreshold: number): Detection[] {
    const sorted   = [...detections].sort((a, b) => b.confidence - a.confidence)
    const keep: Detection[] = []
    const skip      = new Set<number>()

    for (let i = 0; i < sorted.length; i++) {
      if (skip.has(i)) continue
      keep.push(sorted[i])
      for (let j = i + 1; j < sorted.length; j++) {
        if (skip.has(j)) continue
        if (this.iou(sorted[i].bbox, sorted[j].bbox) > iouThreshold) skip.add(j)
      }
    }
    return keep
  }

  private iou(
    a: [number, number, number, number],
    b: [number, number, number, number],
  ): number {
    const ix1 = Math.max(a[0], b[0])
    const iy1 = Math.max(a[1], b[1])
    const ix2 = Math.min(a[2], b[2])
    const iy2 = Math.min(a[3], b[3])
    if (ix2 < ix1 || iy2 < iy1) return 0
    const inter   = (ix2 - ix1) * (iy2 - iy1)
    const areaA   = (a[2] - a[0]) * (a[3] - a[1])
    const areaB   = (b[2] - b[0]) * (b[3] - b[1])
    return inter / (areaA + areaB - inter)
  }
}

// Singleton — one model instance shared across the app
export const detector = new YOLODetector()
