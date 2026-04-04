type OllamaEndpoint = "/api/chat" | "/api/generate"

type OllamaErrorKind =
  | "provider_error"
  | "request_error"
  | "timeout"
  | "unauthorized"
  | "unreachable"

type OllamaContext = Record<string, unknown>

const DEFAULT_OLLAMA_BASE_URL = "https://ollama.com"
const DEFAULT_OLLAMA_TEXT_MODEL = "llama3.2"
const DEFAULT_OLLAMA_VISION_MODEL = "llava"
const DEFAULT_TIMEOUT_MS = 10_000
const MODEL_FALLBACKS: Record<string, string> = {
  llama3: DEFAULT_OLLAMA_TEXT_MODEL,
  [DEFAULT_OLLAMA_TEXT_MODEL]: "gemma3",
  llava: "gemma3",
}

export class OllamaRequestError extends Error {
  kind: OllamaErrorKind
  status?: number
  details?: string

  constructor(message: string, kind: OllamaErrorKind, status?: number, details?: string) {
    super(message)
    this.name = "OllamaRequestError"
    this.kind = kind
    this.status = status
    this.details = details
  }
}

export function getOllamaConfig() {
  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, "")
  const requestTimeoutSeconds = Number(process.env.REQUEST_TIMEOUT_SECONDS || "10")
  const timeoutMs =
    Number.isFinite(requestTimeoutSeconds) && requestTimeoutSeconds > 0
      ? Math.round(requestTimeoutSeconds * 1000)
      : DEFAULT_TIMEOUT_MS
  const apiKey = process.env.OLLAMA_API_KEY?.trim() || ""

  return {
    apiKey,
    authenticated: Boolean(apiKey),
    baseUrl,
    baseUrlHost: safeUrlHost(baseUrl),
    model: process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_TEXT_MODEL,
    visionModel: process.env.OLLAMA_VISION_MODEL || DEFAULT_OLLAMA_VISION_MODEL,
    timeoutMs,
  }
}

export async function callOllamaGenerate<T>(
  payload: Record<string, unknown>,
  context: OllamaContext = {},
) {
  return requestOllamaJson<T>("/api/generate", payload, context)
}

export async function callOllamaChat<T>(
  payload: Record<string, unknown>,
  context: OllamaContext = {},
) {
  return requestOllamaJson<T>("/api/chat", payload, context)
}

function buildHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

function classifyStatus(status: number): OllamaErrorKind {
  if (status === 401 || status === 403) {
    return "unauthorized"
  }
  if (status >= 500) {
    return "provider_error"
  }
  return "request_error"
}

async function requestOllamaJson<T>(
  endpoint: OllamaEndpoint,
  payload: Record<string, unknown>,
  context: OllamaContext,
) {
  const config = getOllamaConfig()
  const url = `${config.baseUrl}${endpoint}`
  const initialModel = resolveRequestedModel(
    payload,
    payloadHasImages(payload) ? config.visionModel : config.model,
  )
  const attemptedModels = new Set<string>()
  let activeModel = initialModel

  while (true) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: buildHeaders(config.apiKey),
        body: JSON.stringify({
          ...payload,
          model: activeModel,
        }),
        cache: "no-store",
        signal: controller.signal,
      })

      if (!response.ok) {
        const details = trimDetails(await response.text())
        const fallbackModel = selectFallbackModel(response.status, details, activeModel, attemptedModels)
        if (fallbackModel) {
          attemptedModels.add(activeModel)
          logOllamaEvent("warn", "model_fallback", {
            ...context,
            authenticated: config.authenticated,
            baseUrlHost: config.baseUrlHost,
            endpoint,
            fallbackModel,
            missingModel: activeModel,
            status: response.status,
          })
          activeModel = fallbackModel
          continue
        }

        const kind = classifyStatus(response.status)
        logOllamaEvent("error", "request_failed", {
          ...context,
          authenticated: config.authenticated,
          baseUrlHost: config.baseUrlHost,
          details,
          endpoint,
          errorKind: kind,
          model: activeModel,
          status: response.status,
        })
        throw new OllamaRequestError("Ollama request failed.", kind, response.status, details)
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof OllamaRequestError) {
        throw error
      }

      const normalized = normalizeThrownError(error)
      logOllamaEvent("error", "request_failed", {
        ...context,
        authenticated: config.authenticated,
        baseUrlHost: config.baseUrlHost,
        endpoint,
        error: normalized.message,
        errorKind: normalized.kind,
        model: activeModel,
        status: normalized.status,
      })
      throw normalized
    } finally {
      clearTimeout(timeout)
    }
  }
}

function normalizeThrownError(error: unknown) {
  if (error instanceof OllamaRequestError) {
    return error
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new OllamaRequestError("Ollama request timed out.", "timeout")
  }
  if (error instanceof Error) {
    return new OllamaRequestError(error.message, "unreachable")
  }
  return new OllamaRequestError("Unknown Ollama error.", "unreachable")
}

function safeUrlHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

function payloadHasImages(payload: Record<string, unknown>) {
  return Array.isArray(payload.images) && payload.images.length > 0
}

function resolveRequestedModel(payload: Record<string, unknown>, defaultModel: string) {
  const requestedModel = payload.model
  return typeof requestedModel === "string" && requestedModel.trim()
    ? requestedModel.trim()
    : defaultModel
}

function selectFallbackModel(
  status: number,
  details: string | undefined,
  activeModel: string,
  attemptedModels: Set<string>,
) {
  if (!isModelNotFound(status, details, activeModel)) {
    return undefined
  }

  const fallbackModel = MODEL_FALLBACKS[activeModel]
  if (!fallbackModel || fallbackModel === activeModel || attemptedModels.has(fallbackModel)) {
    return undefined
  }

  return fallbackModel
}

function isModelNotFound(status: number, details: string | undefined, activeModel: string) {
  if (status !== 404 || !details) {
    return false
  }

  const normalizedDetails = details.toLowerCase()
  return (
    normalizedDetails.includes("model") &&
    normalizedDetails.includes("not found") &&
    normalizedDetails.includes(activeModel.toLowerCase())
  )
}

function trimDetails(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  return trimmed.slice(0, 300)
}

function logOllamaEvent(level: "error" | "warn", event: string, details: OllamaContext) {
  const logger = level === "error" ? console.error : console.warn
  logger(`[ollama] ${event}`, details)
}
