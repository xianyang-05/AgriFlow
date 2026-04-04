import { NextResponse } from 'next/server';

type CachedMeasurement = {
  plant_id?: string | null;
  height_cm: number;
  timestamp: string;
}

// Local fallback for dev when the backend API is unavailable.
const globalAny: any = global;
if (!globalAny.__measurementsCache) {
  globalAny.__measurementsCache = {};
}
const cache = globalAny.__measurementsCache as Record<string, CachedMeasurement>;

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function getApiBaseUrl(request: Request) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (configuredBaseUrl) {
    if (/^https?:\/\//i.test(configuredBaseUrl)) {
      return configuredBaseUrl;
    }

    const origin = new URL(request.url).origin;
    return `${origin}${configuredBaseUrl.startsWith("/") ? "" : "/"}${configuredBaseUrl}`;
  }

  if (process.env.VERCEL) {
    return `${new URL(request.url).origin}/server`;
  }

  return "http://localhost:8000";
}

function buildProxyHeaders(
  request: Request,
  initHeaders?: Record<string, string>,
) {
  const headers = new Headers(initHeaders);
  const forwardedHeaderNames = [
    "authorization",
    "cookie",
    "x-vercel-protection-bypass",
    "x-vercel-set-bypass-cookie",
  ];

  for (const headerName of forwardedHeaderNames) {
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  return headers;
}

async function readBackendJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getCachedMeasurement(sessionId: string) {
  const measurement = cache[sessionId];
  if (!measurement) {
    return null;
  }

  delete cache[sessionId];
  return measurement;
}

// Desktop calls this to poll for results
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const cachedMeasurement = getCachedMeasurement(sessionId);
  if (cachedMeasurement) {
    return NextResponse.json({ success: true, data: cachedMeasurement });
  }

  const backendUrl = `${getApiBaseUrl(request)}/api/v1/measurements/${encodeURIComponent(sessionId)}`;

  try {
    const response = await fetch(backendUrl, {
      cache: "no-store",
      headers: buildProxyHeaders(request),
    });
    const payload = await readBackendJson(response);

    if (response.ok || response.status === 202) {
      return NextResponse.json(payload, { status: response.status });
    }
  } catch {
  }

  const fallbackMeasurement = getCachedMeasurement(sessionId);
  if (fallbackMeasurement) {
    return NextResponse.json({ success: true, data: fallbackMeasurement });
  }

  if (!isLocalRequest(request)) {
    return NextResponse.json({ success: false, message: 'Waiting for data...' }, { status: 202 });
  }

  return NextResponse.json({ success: false, message: 'Waiting for data...' }, { status: 202 });
}

// Mobile AR calls this to submit the measurement
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id, plant_id, height_cm } = body;

    if (!session_id || height_cm === undefined) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const backendUrl = `${getApiBaseUrl(request)}/api/v1/measurements`;
    const payload = {
      session_id,
      plant_id,
      height_cm,
    };
    const cachedMeasurement: CachedMeasurement = {
      plant_id,
      height_cm: Number(height_cm),
      timestamp: new Date().toISOString()
    };
    cache[session_id] = cachedMeasurement;

    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: buildProxyHeaders(request, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await readBackendJson(response);

      if (response.ok) {
        return NextResponse.json(data, { status: response.status });
      }
    } catch {
    }

    return NextResponse.json({
      success: true,
      degraded: true,
      message: 'Measurement captured. Durable storage is temporarily unavailable, so sync will rely on the active web session.',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process payload' }, { status: 400 });
  }
}
