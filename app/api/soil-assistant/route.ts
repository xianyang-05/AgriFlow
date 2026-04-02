import { NextRequest, NextResponse } from "next/server"

// =======================================================
// Soil Assistant API Route (Ollama / Local LLM)
// =======================================================
// This endpoint accepts a soil image (base64) and/or a text
// description and sends it to a local Ollama instance running
// a multimodal model (e.g., llava, bakllava, or gemma3).
//
// HOW TO USE:
// 1. Install Ollama: https://ollama.com/download
// 2. Pull a multimodal model:
//    ollama pull llava        (or bakllava, gemma3, etc.)
// 3. Start Ollama (it runs on http://localhost:11434 by default)
// 4. If you want to use an external API instead, set SOIL_API_KEY
//    and SOIL_API_URL in your .env.local file.
// =======================================================

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llava"

// Optional: external API key (user can add this later)
const SOIL_API_KEY = process.env.SOIL_API_KEY || ""
const SOIL_API_URL = process.env.SOIL_API_URL || ""

const SOIL_TYPES = ["sandy", "clay", "loamy", "silt", "peat", "chalky"] as const

const SYSTEM_PROMPT = `You are an expert agricultural soil analyst. When given an image of soil and/or a text description, you must:
1. Identify the soil type from these categories: Sandy Soil, Clay Soil, Loamy Soil, Silt Soil, Peat Soil, Chalky Soil
2. Provide a confidence level (low, medium, high)
3. Give a short explanation of why you identified it as that type based on texture, color, moisture, and composition

Respond ONLY in this exact JSON format:
{
  "soilType": "Loamy Soil",
  "confidence": "high",
  "explanation": "The soil has a crumbly, dark-brown texture with visible organic matter..."
}

If you cannot determine the soil type, use your best guess and set confidence to "low".`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image, description, chatHistory } = body

    // Build the prompt
    let userPrompt = ""
    if (description) {
      userPrompt += `Soil description from user: ${description}\n`
    }
    if (!image && !description) {
      return NextResponse.json(
        { error: "Please provide an image or description" },
        { status: 400 }
      )
    }

    // If chat history is provided, this is a follow-up question
    if (chatHistory && chatHistory.length > 0) {
      userPrompt = chatHistory.map((msg: { role: string; content: string }) => 
        `${msg.role}: ${msg.content}`
      ).join("\n") + "\n" + (description || "")
    } else {
      userPrompt += "Analyze this soil and identify its type."
    }

    // =====================================================
    // Option A: Use external API (if SOIL_API_KEY is set)
    // =====================================================
    if (SOIL_API_KEY && SOIL_API_URL) {
      const externalResponse = await fetch(SOIL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SOIL_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.SOIL_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: image
                ? [
                    { type: "text", text: userPrompt },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
                  ]
                : userPrompt,
            },
          ],
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

      return NextResponse.json(parseAIResponse(content))
    }

    // =====================================================
    // Option B: Use local Ollama (default, free)
    // =====================================================
    const ollamaPayload: Record<string, unknown> = {
      model: OLLAMA_MODEL,
      prompt: `${SYSTEM_PROMPT}\n\nUser: ${userPrompt}`,
      stream: false,
    }

    // Attach image if provided (base64 string without data: prefix)
    if (image) {
      ollamaPayload.images = [image]
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
          error: "Could not connect to Ollama. Make sure Ollama is running locally.",
          details: errText,
          fallback: getFallbackResponse(description || "")
        },
        { status: 502 }
      )
    }

    const ollamaData = await ollamaResponse.json()
    const responseText = ollamaData.response || ""

    return NextResponse.json(parseAIResponse(responseText))

  } catch (error) {
    console.error("Soil assistant error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        fallback: getFallbackResponse("")
      },
      { status: 500 }
    )
  }
}

// Parse the AI response text into structured JSON
function parseAIResponse(text: string): {
  soilType: string
  confidence: string
  explanation: string
} {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        soilType: parsed.soilType || "Unknown",
        confidence: parsed.confidence || "low",
        explanation: parsed.explanation || text,
      }
    }
  } catch {
    // If JSON parsing fails, try to extract soil type from text
  }

  // Fallback: try to find soil type mention in text
  const lower = text.toLowerCase()
  for (const type of SOIL_TYPES) {
    if (lower.includes(type)) {
      return {
        soilType: `${type.charAt(0).toUpperCase() + type.slice(1)} Soil`,
        confidence: "medium",
        explanation: text.slice(0, 300),
      }
    }
  }

  return {
    soilType: "Unknown",
    confidence: "low",
    explanation: text.slice(0, 300) || "Could not determine soil type from the provided input.",
  }
}

// Keyword-based fallback when AI is unavailable
function getFallbackResponse(description: string): {
  soilType: string
  confidence: string
  explanation: string
} {
  const lower = description.toLowerCase()

  if (lower.includes("sticky") || lower.includes("hard") || lower.includes("dense")) {
    return { soilType: "Clay Soil", confidence: "medium", explanation: "Based on your description of sticky/hard texture, this is likely Clay Soil." }
  }
  if (lower.includes("sand") || lower.includes("loose") || lower.includes("gritty")) {
    return { soilType: "Sandy Soil", confidence: "medium", explanation: "The loose, gritty texture you described is characteristic of Sandy Soil." }
  }
  if (lower.includes("dark") || lower.includes("spongy") || lower.includes("wet")) {
    return { soilType: "Peat Soil", confidence: "medium", explanation: "Dark and spongy characteristics suggest Peat Soil." }
  }
  if (lower.includes("white") || lower.includes("chalk") || lower.includes("stone")) {
    return { soilType: "Chalky Soil", confidence: "medium", explanation: "White/chalky appearance with stones indicates Chalky Soil." }
  }
  if (lower.includes("smooth") || lower.includes("silky") || lower.includes("fine")) {
    return { soilType: "Silt Soil", confidence: "medium", explanation: "The smooth, silky texture you described is typical of Silt Soil." }
  }

  return { soilType: "Loamy Soil", confidence: "low", explanation: "Based on the limited description, this appears to be Loamy Soil (the most common agricultural soil)." }
}
