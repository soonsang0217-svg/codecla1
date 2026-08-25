import crypto from "node:crypto";

export const SESSION_COOKIE = "interview_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type UserRole = "admin" | "member";

export interface SessionUser {
  username: string;
  role: UserRole;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionCookie(user: SessionUser): string {
  const payload: SessionPayload = { ...user, exp: Date.now() + SESSION_TTL_SECONDS * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionCookie(cookieValue: string | undefined | null): SessionUser | null {
  if (!cookieValue) return null;
  const [data, signature] = cookieValue.split(".");
  if (!data || !signature) return null;

  const expectedSignature = sign(data);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    if (payload.role !== "admin" && payload.role !== "member") return null;
    if (typeof payload.username !== "string" || !payload.username) return null;
    return { username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

/** Only the "admin" account authenticates this way — see src/app/api/auth/login/route.ts. */
export function verifyTeamPassword(candidate: string): boolean {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) {
    throw new Error("TEAM_PASSWORD environment variable is not set");
  }
  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(expected);
  if (candidateBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;
