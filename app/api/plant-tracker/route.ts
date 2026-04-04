import { NextRequest, NextResponse } from "next/server"
import { callOllamaChat, OllamaRequestError } from "@/lib/server/ollama"

const SYSTEM_PROMPT = `You are AgriFlow Plant Tracker, an expert botanical AI assistant. The user is on the "Dashboard" page, monitoring their plant's progression (e.g., Tomato). They may provide physical measurements, upload descriptions of the plant, or ask for daily actions.
Your job is to provide concise, encouraging, and highly specific botanical advice. Provide insights on their crop's current growth stage and any risks they should watch out for.`

type ChatMessage = {
  role: string
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { message, chatHistory } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Format history for Ollama
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...((chatHistory || []) as ChatMessage[]).map((msg) => ({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.content
      })),
      { role: "user", content: message }
    ]

    const data = await callOllamaChat<{ message?: { content?: string } }>(
      {
        messages,
        stream: false,
      },
      {
        historyCount: Array.isArray(chatHistory) ? chatHistory.length : 0,
        route: "plant-tracker",
      }
    )
    return NextResponse.json({ reply: data.message?.content || getFallbackReply() })

  } catch (error) {
    if (error instanceof OllamaRequestError) {
      console.error("[plant-tracker] ollama_request_failed", {
        errorKind: error.kind,
        status: error.status,
      })
    } else {
      console.error("Plant Tracker Assistant Error:", error)
    }
    return NextResponse.json({ reply: getFallbackReply() }, { status: 500 })
  }
}

function getFallbackReply() {
  return "I'm the AgriFlow Plant Tracker. My AI connection is currently down. Based on standard timelines, ensure you continue watering your tomato plant daily and monitor its height!"
}
