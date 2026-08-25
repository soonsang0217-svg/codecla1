import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie, SESSION_COOKIE } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

const PUBLIC_PATHS = ["/login", "/favicon.ico"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPublic(pathname)) {
    let session = null;
    try {
      session = verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
    } catch (err) {
      // Most likely SESSION_SECRET is missing/misconfigured. Fail closed to
      // the login page instead of crashing the whole site with a raw 500.
      console.error("Failed to verify session cookie", err);
    }

    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // AI generation is the only token-costing endpoint — rate-limit it per IP.
  if (pathname === "/api/generate" && request.method === "POST") {
    if (!checkRateLimit(clientIp(request))) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요. (시간당 5회 제한)" },
        { status: 429 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
