import { NextRequest } from "next/server";
import { verifySessionCookie, SESSION_COOKIE, type SessionUser } from "@/lib/session";

/** Re-verifies the session cookie inside a route handler (proxy.ts already gates the route, this is for identity + ownership checks). */
export function getSession(request: NextRequest): SessionUser | null {
  return verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
}

/** Admins can access everything. Members only their own. Interviews created before this feature (createdBy is null) are admin-only. */
export function canAccessInterview(session: SessionUser | null, createdBy: string | null): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  return createdBy !== null && createdBy === session.username;
}
