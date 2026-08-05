import crypto from "node:crypto";

export const SESSION_COOKIE = "briefing_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  email: string;
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

export function createSessionCookie(email: string): string {
  const payload: SessionPayload = {
    email,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function verifySessionCookie(cookieValue: string | undefined | null): { email: string } | null {
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
    return { email: payload.email };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;
