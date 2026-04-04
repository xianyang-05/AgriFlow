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

async function readBackendJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Desktop calls this to poll for results
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const backendUrl = `${getApiBaseUrl(request)}/api/v1/measurements/${encodeURIComponent(sessionId)}`;

  try {
    const response = await fetch(backendUrl, { cache: "no-store" });
    const payload = await readBackendJson(response);

    if (response.ok || response.status === 202) {
      return NextResponse.json(payload, { status: response.status });
    }

    if (!isLocalRequest(request)) {
      return NextResponse.json(payload ?? { error: 'Measurement lookup failed' }, { status: response.status });
    }
  } catch {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: 'Measurement lookup failed' }, { status: 502 });
    }
  }

  const measurement = cache[sessionId];
  if (measurement) {
    delete cache[sessionId];
    return NextResponse.json({ success: true, data: measurement });
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

    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await readBackendJson(response);

      if (response.ok) {
        return NextResponse.json(data, { status: response.status });
      }

      if (!isLocalRequest(request)) {
        return NextResponse.json(data ?? { error: 'Failed to save measurement' }, { status: response.status });
      }
    } catch {
      if (!isLocalRequest(request)) {
        return NextResponse.json({ error: 'Failed to save measurement' }, { status: 502 });
      }
    }

    cache[session_id] = {
      plant_id,
      height_cm: Number(height_cm),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({ success: true, message: 'Measurement saved locally.' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process payload' }, { status: 400 });
  }
}
