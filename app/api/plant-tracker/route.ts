import { NextRequest, NextResponse } from "next/server"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2"

const SYSTEM_PROMPT = `You are AgriFlow Plant Tracker, an expert botanical AI assistant. The user is on the "Dashboard" page, monitoring their plant's progression (e.g., Tomato). They may provide physical measurements, upload descriptions of the plant, or ask for daily actions.
Your job is to provide concise, encouraging, and highly specific botanical advice. Provide insights on their crop's current growth stage and any risks they should watch out for.`

export async function POST(request: NextRequest) {
  try {
    const { message, chatHistory } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Format history for Ollama
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(chatHistory || []).map((msg: any) => ({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.content
      })),
      { role: "user", content: message }
    ]

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
      }),
    })

    if (!ollamaResponse.ok) {
        throw new Error(`Ollama Error: ${ollamaResponse.statusText}`)
    }

    const data = await ollamaResponse.json()
    return NextResponse.json({ reply: data.message.content })

  } catch (error) {
    console.error("Plant Tracker Assistant Error:", error)
    return NextResponse.json({ reply: getFallbackReply() }, { status: 500 })
  }
}

function getFallbackReply() {
  return "I'm the AgriFlow Plant Tracker. My AI connection to Ollama is currently down. Based on standard timelines, ensure you continue watering your tomato plant daily and monitor its height!"
}
