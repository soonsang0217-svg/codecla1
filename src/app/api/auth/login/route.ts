import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createSessionCookie, verifyTeamPassword, SESSION_COOKIE, SESSION_MAX_AGE, type UserRole } from "@/lib/session";
import { verifyPasswordHash } from "@/lib/password";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { dbErrorResponse } from "@/lib/api-error";

const ADMIN_USERNAME = "admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해 주세요" }, { status: 400 });
  }

  let role: UserRole | null = null;

  if (username === ADMIN_USERNAME) {
    try {
      role = verifyTeamPassword(password) ? "admin" : null;
    } catch (err) {
      console.error("TEAM_PASSWORD not configured", err);
      return NextResponse.json({ error: "서버에 관리자 비밀번호가 설정되지 않았습니다" }, { status: 500 });
    }
  } else {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (user && verifyPasswordHash(password, user.passwordHash)) {
        role = user.role;
      }
    } catch (err) {
      return dbErrorResponse(err);
    }
  }

  if (!role) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, username, role });
  response.cookies.set(SESSION_COOKIE, createSessionCookie({ username, role }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
