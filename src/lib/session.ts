import crypto from "node:crypto";

export const SESSION_COOKIE = "interview_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
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

export function createSessionCookie(): string {
  const payload: SessionPayload = { exp: Date.now() + SESSION_TTL_SECONDS * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionCookie(cookieValue: string | undefined | null): boolean {
  if (!cookieValue) return false;
  const [data, signature] = cookieValue.split(".");
  if (!data || !signature) return false;

  const expectedSignature = sign(data);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    return payload.exp >= Date.now();
  } catch {
    return false;
  }
}

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
