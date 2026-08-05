import { NextRequest, NextResponse } from "next/server";
import { saveHealthSnapshot, type HealthSnapshotInput } from "@/lib/health";

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

  // Logged in full so we can see exactly what shape Shortcuts sends for
  // fields we don't have strict parsing for yet (e.g. raw sample arrays) —
  // check this in Vercel's Runtime Logs.
  console.log("Health ingest payload:", JSON.stringify(rawBody));

  const body = (rawBody ?? {}) as HealthSnapshotInput;

  try {
    const snapshot = await saveHealthSnapshot({
      sleepDurationMinutes:
        typeof body.sleepDurationMinutes === "number" ? body.sleepDurationMinutes : null,
      sleepScore: typeof body.sleepScore === "number" ? body.sleepScore : null,
      heartRate: typeof body.heartRate === "number" ? body.heartRate : null,
      heartRateVariability:
        typeof body.heartRateVariability === "number" ? body.heartRateVariability : null,
      recordedAt: typeof body.recordedAt === "string" ? body.recordedAt : null,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error("Failed to save health snapshot", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
