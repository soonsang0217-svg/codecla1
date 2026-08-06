import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/googleAuth";

export async function GET() {
  return NextResponse.redirect(await getAuthUrl());
}
