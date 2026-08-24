import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, verifyTeamPassword, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  let valid = false;
  try {
    valid = password.length > 0 && verifyTeamPassword(password);
  } catch (err) {
    console.error("TEAM_PASSWORD not configured", err);
    return NextResponse.json({ error: "서버에 팀 비밀번호가 설정되지 않았습니다" }, { status: 500 });
  }

  if (!valid) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionCookie(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
