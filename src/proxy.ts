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

  const session = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
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
