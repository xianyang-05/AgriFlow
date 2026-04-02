import { NextRequest, NextResponse } from "next/server"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llava"

const SOIL_API_KEY = process.env.SOIL_API_KEY || ""
const SOIL_API_URL = process.env.SOIL_API_URL || ""

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

    // =====================================================
    // Option A: Use external API (if SOIL_API_KEY is set)
    // =====================================================
    if (SOIL_API_KEY && SOIL_API_URL) {
      const messagesPayload = [
        { role: "system", content: SYSTEM_PROMPT },
      ]
      
      if (chatHistory && chatHistory.length > 0) {
        chatHistory.forEach((msg: { role: string; content: string }) => {
          messagesPayload.push({
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: msg.content
          })
        })
      }
      
      messagesPayload.push({ role: "user", content: message })

      const externalResponse = await fetch(SOIL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SOIL_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.SOIL_MODEL || "gpt-4o-mini",
          messages: messagesPayload,
          max_tokens: 500,
        }),
      })

      if (!externalResponse.ok) {
        const err = await externalResponse.text()
        console.error("External API error:", err)
        return NextResponse.json(
          { error: "External API failed", details: err },
          { status: 502 }
        )
      }

      const externalData = await externalResponse.json()
      const content = externalData.choices?.[0]?.message?.content || ""

      return NextResponse.json({ reply: content })
    }

    // =====================================================
    // Option B: Use local Ollama (default, free)
    // =====================================================
    const ollamaPayload = {
      model: OLLAMA_MODEL,
      prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}\nAssistant:`,
      stream: false,
    }

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaPayload),
    })

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text()
      console.error("Ollama error:", errText)
      return NextResponse.json(
        { 
          error: "Could not connect to Ollama.",
          details: errText,
          reply: getFallbackResponse(message)
        },
        { status: 200 } // Return 200 with fallback so the UI handles it gracefully
      )
    }

    const ollamaData = await ollamaResponse.json()
    const responseText = ollamaData.response || ""

    return NextResponse.json({ reply: responseText })

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

  return "I'm your AgriFlow Assistant. My AI brain (Ollama) is currently unreachable, but I'm here to help! Make sure your Ollama instance is running locally."
}
