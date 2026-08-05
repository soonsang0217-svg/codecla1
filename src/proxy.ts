import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/manifest.json",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
  // Called by an iOS Shortcuts automation, not the browser — authenticated
  // with its own bearer token (HEALTH_INGEST_TOKEN) instead of the session
  // cookie. See src/app/api/health/ingest/route.ts.
  "/api/health/ingest",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  let session: { email: string } | null = null;
  try {
    session = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  } catch (err) {
    // Most likely SESSION_SECRET is missing/misconfigured. Fail closed to
    // the login page instead of crashing the whole site with a raw 500.
    console.error("Failed to verify session cookie", err);
  }
  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
