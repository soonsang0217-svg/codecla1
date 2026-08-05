import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, type AppSettings } from "@/lib/config";
import { handleApiError } from "@/lib/apiAuth";

export async function GET() {
  try {
    return NextResponse.json(await getSettings());
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AppSettings>;
    const next = await updateSettings(body);
    return NextResponse.json(next);
  } catch (err) {
    return handleApiError(err);
  }
}
