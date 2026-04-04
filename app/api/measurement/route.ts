import { NextResponse } from 'next/server';

// Temporary in-memory cache for AR measurements
// Using globalThis prevents the variable from being garaged collected
// or wiped out completely during standard Next.js HMR reloads.
const globalAny: any = global;
if (!globalAny.__measurementsCache) {
  globalAny.__measurementsCache = {};
}
const cache = globalAny.__measurementsCache;

// Desktop calls this to poll for results
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  const measurement = cache[sessionId];
  
  if (measurement) {
    // Remove to act as a consumed event flag
    delete cache[sessionId];
    return NextResponse.json({ success: true, data: measurement });
  }

  // Return a 202 indicating it's still processing / waiting
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

    cache[session_id] = {
      plant_id,
      height_cm,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({ success: true, message: 'Measurement saved locally.' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process payload' }, { status: 400 });
  }
}
