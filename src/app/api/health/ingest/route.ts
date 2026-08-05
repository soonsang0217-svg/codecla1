import { NextRequest, NextResponse } from "next/server";
import { saveHealthSnapshot } from "@/lib/health";

interface RawHealthPayload {
  sleepDurationMinutes?: number;
  sleepScore?: number;
  recordedAt?: string;
  // Shortcuts flattens a list magic variable dropped into a text field into a
  // single "\n"-joined string — one raw sample value per line.
  heartRateRaw?: string;
  heartRateVariabilityRaw?: string;
}

function parseRawSeries(raw: unknown): number[] | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const values = trimmed
    .split("\n")
    .map((line) => Number(line.trim()))
    .filter((n) => Number.isFinite(n));

  return values.length > 0 ? values : null;
}

/**
 * Called by an iOS/iPadOS Shortcuts automation (not the browser), so it's
 * authenticated with a static bearer token instead of the session cookie —
 * see proxy.ts, which allows this exact path through unauthenticated.
 */
export async function POST(request: NextRequest) {
  const expectedToken = process.env.HEALTH_INGEST_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "HEALTH_INGEST_TOKEN not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const providedToken = authHeader.replace(/^Bearer\s+/i, "");
  if (providedToken !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  console.log("Health ingest payload:", JSON.stringify(rawBody));

  const body = (rawBody ?? {}) as RawHealthPayload;

  try {
    const snapshot = await saveHealthSnapshot({
      sleepDurationMinutes:
        typeof body.sleepDurationMinutes === "number" ? body.sleepDurationMinutes : null,
      sleepScore: typeof body.sleepScore === "number" ? body.sleepScore : null,
      heartRateSeries: parseRawSeries(body.heartRateRaw),
      heartRateVariabilitySeries: parseRawSeries(body.heartRateVariabilityRaw),
      recordedAt: typeof body.recordedAt === "string" ? body.recordedAt : null,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error("Failed to save health snapshot", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
