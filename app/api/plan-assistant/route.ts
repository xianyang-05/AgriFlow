import { NextRequest, NextResponse } from "next/server"
import { callOllamaGenerate, OllamaRequestError } from "@/lib/server/ollama"

const SYSTEM_PROMPT = `You are AgriFlow Assistant, an expert agricultural AI. The user is on the "Smart Planning" page, exploring crop recommendations, market trends, and execution scenarios based on their farm's data (location, farm size, budget, soil type).
Your job is to provide concise, practical, and helpful answers. Respond directly to the user's questions about crop selections, market prices, risks, or farming strategies.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, chatHistory } = body

    if (!message) {
      return NextResponse.json(
        { error: "Please provide a message" },
        { status: 400 }
      )
    }

    // Build the prompt
    let userPrompt = ""
    if (chatHistory && chatHistory.length > 0) {
      // Include recent history (last 5 messages)
      const recentHistory = chatHistory.slice(-5)
      userPrompt = recentHistory.map((msg: { role: string; content: string }) =>
        `${msg.role === 'ai' ? 'Assistant' : 'User'}: ${msg.content}`
      ).join("\n") + "\nUser: " + message
    } else {
      userPrompt = "User: " + message
    }

    const ollamaPayload = {
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}\nAssistant:`,
      stream: false,
    }

    try {
      const ollamaData = await callOllamaGenerate<{ response?: string }>(ollamaPayload, {
        historyCount: Array.isArray(chatHistory) ? chatHistory.length : 0,
        route: "plan-assistant",
      })
      const responseText = ollamaData.response || ""
      return NextResponse.json({ reply: responseText })
    } catch (error) {
      if (error instanceof OllamaRequestError) {
        console.error("[plan-assistant] ollama_request_failed", {
          errorKind: error.kind,
          status: error.status,
        })
      }
      return NextResponse.json(
        {
          error: getOllamaErrorMessage(error),
          details: error instanceof OllamaRequestError ? error.details : undefined,
          reply: getFallbackResponse(message)
        },
        { status: 200 } // Return 200 with fallback so the UI handles it gracefully
      )
    }
  } catch (error) {
    console.error("Plan assistant error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        reply: "I am having trouble connecting to my brain right now. Please try again later!"
      },
      { status: 200 }
    )
  }
}

// Keyword-based fallback when AI is unavailable
function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes("wheat") || lower.includes("rice") || lower.includes("vegetables")) {
    return "Based on current market trends and your farm data, this is a solid choice. It balances yield potential with acceptable risk levels."
  }
  if (lower.includes("risk") || lower.includes("weather")) {
    return "Climate risks appear manageable this season. However, ensure you have an adequate watering plan in place."
  }
  if (lower.includes("profit") || lower.includes("money") || lower.includes("price")) {
    return "Market prices are currently stable. The scenario simulation graph provides a good estimate of your potential returns."
  }

  return "I'm your AgriFlow Assistant. My AI connection is currently unavailable, but I'm here to help with a lightweight fallback response."
}

function getOllamaErrorMessage(error: unknown) {
  if (error instanceof OllamaRequestError && error.kind === "unauthorized") {
    return "Could not authenticate with the configured Ollama endpoint."
  }

  return "Could not connect to the configured Ollama endpoint."
}
