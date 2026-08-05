import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, type AppSettings } from "@/lib/config";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Partial<AppSettings>;
  const next = updateSettings(body);
  return NextResponse.json(next);
}
