import fs from "node:fs"
import path from "node:path"

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

const BACKEND_ENV_PATH = path.join(process.cwd(), "backend", ".env")

function readBackendEnv(): Record<string, string> {
  try {
    const envText = fs.readFileSync(BACKEND_ENV_PATH, "utf8")
    const result: Record<string, string> = {}

    for (const rawLine of envText.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith("#")) {
        continue
      }

      const separatorIndex = line.indexOf("=")
      if (separatorIndex === -1) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "")
      result[key] = value
    }

    return result
  } catch {
    return {}
  }
}

const BACKEND_ENV = readBackendEnv()
const OLLAMA_URL =
  BACKEND_ENV.OLLAMA_BASE_URL || process.env.OLLAMA_URL || "http://localhost:11434"
const OLLAMA_MODEL =
  BACKEND_ENV.OLLAMA_MODEL || process.env.OLLAMA_MODEL || "llava"

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

type SoilAssistantResult = {
  soilType: string
  confidence: string
  explanation: string
  degraded?: boolean
  needsMoreDetail?: boolean
}

const VAGUE_MESSAGES = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "help",
  "test",
  "soil",
])

function logSoilAssistant(level: "warn" | "error", event: string, details: Record<string, unknown>) {
  const logger = level === "error" ? console.error : console.warn
  logger(`[soil-assistant] ${event}`, details)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image, description, chatHistory } = body
    const trimmedDescription = typeof description === "string" ? description.trim() : ""

    // Build the prompt
    let userPrompt = ""
    if (trimmedDescription) {
      userPrompt += `Soil description from user: ${trimmedDescription}\n`
    }
    if (!image && !description) {
      return NextResponse.json(
        { error: "Please provide an image or description" },
        { status: 400 }
      )
    }
    if (!image && isVagueDescription(trimmedDescription)) {
      const response: SoilAssistantResult = {
        soilType: "Need More Detail",
        confidence: "low",
        explanation:
          "Please describe the soil's color, texture, moisture, or smell. For example: dark and crumbly, sticky when wet, sandy and loose, or pale with small stones.",
        needsMoreDetail: true,
      }
      logSoilAssistant("warn", "vague_description_rejected", {
        descriptionPreview: trimmedDescription.slice(0, 200),
        response,
      })
      return NextResponse.json(response)
    }

    // If chat history is provided, this is a follow-up question
    if (chatHistory && chatHistory.length > 0) {
      userPrompt = chatHistory.map((msg: { role: string; content: string }) => 
        `${msg.role}: ${msg.content}`
      ).join("\n") + "\n" + trimmedDescription
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
        logSoilAssistant("error", "external_api_failed", {
          status: externalResponse.status,
          statusText: externalResponse.statusText,
          details: err,
          hasImage: Boolean(image),
          hasDescription: Boolean(description),
        })
        return NextResponse.json(
          { error: "External API failed", details: err },
          { status: 502 }
        )
      }

      const externalData = await externalResponse.json()
      const content = externalData.choices?.[0]?.message?.content || ""

      return NextResponse.json(
        parseAIResponse(content, {
          provider: "external",
          hasImage: Boolean(image),
          hasDescription: Boolean(description),
        })
      )
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
      logSoilAssistant("error", "ollama_request_failed", {
        status: ollamaResponse.status,
        statusText: ollamaResponse.statusText,
        model: OLLAMA_MODEL,
        url: `${OLLAMA_URL}/api/generate`,
        details: errText,
        hasImage: Boolean(image),
        hasDescription: Boolean(description),
      })
      const fallback = getFallbackResponse(trimmedDescription, {
        reason: "ollama_request_failed",
        hasImage: Boolean(image),
        hasDescription: Boolean(trimmedDescription),
      })
      return NextResponse.json(
        {
          error: "Could not connect to Ollama. Make sure Ollama is running locally.",
          details: errText,
          ...fallback,
          degraded: true,
        }
      )
    }

    const ollamaData = await ollamaResponse.json()
    const responseText = ollamaData.response || ""

    return NextResponse.json(
      parseAIResponse(responseText, {
        provider: "ollama",
        model: OLLAMA_MODEL,
        hasImage: Boolean(image),
        hasDescription: Boolean(trimmedDescription),
      })
    )

  } catch (error) {
    logSoilAssistant("error", "route_exception", {
      error: error instanceof Error ? error.message : String(error),
    })
    const fallback = getFallbackResponse("", {
      reason: "route_exception",
    })
    return NextResponse.json(
      {
        error: "Internal server error",
        ...fallback,
        degraded: true,
      }
    )
  }
}

// Parse the AI response text into structured JSON
function parseAIResponse(text: string, context: Record<string, unknown>): SoilAssistantResult {
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
  } catch (error) {
    logSoilAssistant("warn", "response_json_parse_failed", {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      preview: text.slice(0, 300),
    })
  }

  // Fallback: try to find soil type mention in text
  const lower = text.toLowerCase()
  for (const type of SOIL_TYPES) {
    if (lower.includes(type)) {
      const result = {
        soilType: `${type.charAt(0).toUpperCase() + type.slice(1)} Soil`,
        confidence: "medium",
        explanation: text.slice(0, 300),
      }
      logSoilAssistant("warn", "response_used_text_extraction_fallback", {
        ...context,
        detectedType: result.soilType,
        preview: text.slice(0, 300),
      })
      return result
    }
  }

  const result = {
    soilType: "Unknown",
    confidence: "low",
    explanation: text.slice(0, 300) || "Could not determine soil type from the provided input.",
  }
  logSoilAssistant("warn", "response_unstructured", {
    ...context,
    preview: text.slice(0, 300),
  })
  return result
}

// Keyword-based fallback when AI is unavailable
function getFallbackResponse(
  description: string,
  context: Record<string, unknown> = {}
): SoilAssistantResult {
  const lower = description.toLowerCase()
  let result: SoilAssistantResult

  if (lower.includes("sticky") || lower.includes("hard") || lower.includes("dense")) {
    result = { soilType: "Clay Soil", confidence: "medium", explanation: "Based on your description of sticky/hard texture, this is likely Clay Soil." }
  } else if (lower.includes("sand") || lower.includes("loose") || lower.includes("gritty")) {
    result = { soilType: "Sandy Soil", confidence: "medium", explanation: "The loose, gritty texture you described is characteristic of Sandy Soil." }
  } else if (lower.includes("dark") || lower.includes("spongy") || lower.includes("wet")) {
    result = { soilType: "Peat Soil", confidence: "medium", explanation: "Dark and spongy characteristics suggest Peat Soil." }
  } else if (lower.includes("white") || lower.includes("chalk") || lower.includes("stone")) {
    result = { soilType: "Chalky Soil", confidence: "medium", explanation: "White/chalky appearance with stones indicates Chalky Soil." }
  } else if (lower.includes("smooth") || lower.includes("silky") || lower.includes("fine")) {
    result = { soilType: "Silt Soil", confidence: "medium", explanation: "The smooth, silky texture you described is typical of Silt Soil." }
  } else {
    result = { soilType: "Loamy Soil", confidence: "low", explanation: "Based on the limited description, this appears to be Loamy Soil (the most common agricultural soil)." }
  }

  logSoilAssistant("warn", "keyword_fallback_used", {
    ...context,
    descriptionPreview: description.slice(0, 200),
    fallback: result,
  })

  return result
}

function isVagueDescription(description: string): boolean {
  if (!description) {
    return true
  }

  const normalized = description.trim().toLowerCase()
  if (VAGUE_MESSAGES.has(normalized)) {
    return true
  }

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length
  if (tokenCount <= 2 && normalized.length < 12) {
    return true
  }

  return false
}
