import { NextRequest, NextResponse } from "next/server"

const OLLAMA_URL =
  process.env.OLLAMA_BASE_URL ||
  process.env.OLLAMA_URL ||
  "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2"
/** Use a vision-capable model when images are sent (e.g. llava, llama3.2-vision). */
const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || process.env.OLLAMA_MODEL || "llava"

const SYSTEM_PROMPT = `You are AgriFlow Plant Tracker, an expert botanical AI assistant. The user monitors a tomato plant on the Dashboard.

RESPONSE FORMAT — Always structure your reply using these short sections with emoji headers. Keep each section to 1-2 sentences max:

📊 **Status** — Current growth stage and whether it's on track, ahead, or behind.

📏 **Height Check** — Comment on the measured height vs expected range for this day. (Only when height data is given.)

✅ **What's Good** — One positive observation.

⚠️ **Recommendation** — If growth is slow or behind schedule, give 1-2 specific corrective actions (e.g. increase sunlight, adjust watering, add fertilizer). If on track, give a maintenance tip instead.

🔜 **Next Milestone** — What to expect or aim for next.

RULES:
- Keep total response under 120 words.
- Use the emoji headers exactly as shown above.
- If progress is slow (height below expected for the day), ALWAYS include a clear recommendation to fix it.
- Expected tomato height: ~2cm by day 5, ~15cm by day 15, ~40cm by day 30, ~80cm by day 45, ~120cm by day 60.
- Be encouraging but honest about slow progress.
- When given a photo, replace "Height Check" with "🌿 Visual Check" describing what you see.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      message,
      chatHistory,
      images,
      heightCm,
      growthDay,
    } = body as {
      message?: string
      chatHistory?: { role: string; content: string }[]
      images?: string[]
      heightCm?: number
      growthDay?: number
    }

    let userText = (message || "").trim()
    if (heightCm != null && Number.isFinite(Number(heightCm))) {
      userText += `${userText ? "\n\n" : ""}[Context: measured plant height ${heightCm} cm. Tracking day ${growthDay ?? "unknown"} for a home-grown tomato.]`
    }
    if (!userText && (!images || images.length === 0)) {
      return NextResponse.json({ error: "Message or image required" }, { status: 400 })
    }
    if (!userText && images?.length) {
      userText =
        "The user uploaded a photo of their plant. Describe what you see and comment on growth and health."
    }

    const useVision = Array.isArray(images) && images.length > 0
    const model = useVision ? OLLAMA_VISION_MODEL : OLLAMA_MODEL

    const historyMsgs = (chatHistory || []).map((msg: { role: string; content: string }) => ({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.content,
    }))

    const userPayload: Record<string, unknown> = {
      role: "user",
      content: userText,
    }
    if (useVision) {
      userPayload.images = images
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMsgs,
      userPayload,
    ]

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    })

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama Error: ${ollamaResponse.status}`)
    }

    const data = await ollamaResponse.json()
    const reply = data.message?.content || getFallbackReply()
    return NextResponse.json({ reply })
  } catch (error) {
    console.error("Plant Tracker Assistant Error:", error)
    return NextResponse.json({ reply: getFallbackReply() }, { status: 500 })
  }
}

function getFallbackReply() {
  return "I'm the AgriFlow Plant Tracker. Ollama is unreachable from this server. Start Ollama locally (`ollama serve`) and set OLLAMA_URL / OLLAMA_MODEL in `.env`. For photos, use a vision model (e.g. `ollama pull llava`) and set OLLAMA_VISION_MODEL."
}
