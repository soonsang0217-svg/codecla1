import { NextResponse } from "next/server";
import { getLatestHealth } from "@/lib/health";
import { handleApiError } from "@/lib/apiAuth";

export async function GET() {
  try {
    const snapshot = await getLatestHealth();
    return NextResponse.json({ snapshot });
  } catch (err) {
    return handleApiError(err);
  }
}
