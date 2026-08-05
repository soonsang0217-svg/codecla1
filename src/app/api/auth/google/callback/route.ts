import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  saveTokens,
  createOAuthClient,
  getUserEmail,
  isEmailAllowed,
} from "@/lib/googleAuth";
import { createSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const client = createOAuthClient();
    client.setCredentials(tokens);

    const email = await getUserEmail(client);
    if (!email || !isEmailAllowed(email)) {
      return NextResponse.redirect(new URL("/login?error=not_allowed", request.url));
    }

    saveTokens(tokens);

    const response = NextResponse.redirect(new URL("/briefing", request.url));
    response.cookies.set(SESSION_COOKIE, createSessionCookie(email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}
