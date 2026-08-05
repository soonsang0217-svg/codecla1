import { NextResponse } from "next/server";
import { isConnected } from "@/lib/googleAuth";
import { handleApiError } from "@/lib/apiAuth";

export async function GET() {
  try {
    return NextResponse.json({ connected: await isConnected() });
  } catch (err) {
    return handleApiError(err);
  }
}
