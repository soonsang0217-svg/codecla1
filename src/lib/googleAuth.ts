import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";
import { getKV, setKV, deleteKV } from "./db";
import { requireEnv } from "./config";

const TOKENS_KEY = "google_tokens";

export const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
];

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<Credentials> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function saveTokens(tokens: Credentials): void {
  const existing = getKV<Credentials>(TOKENS_KEY) || {};
  setKV(TOKENS_KEY, { ...existing, ...tokens });
}

export function loadTokens(): Credentials | null {
  return getKV<Credentials>(TOKENS_KEY);
}

export function clearTokens(): void {
  deleteKV(TOKENS_KEY);
}

export function isConnected(): boolean {
  const tokens = loadTokens();
  return !!tokens?.refresh_token;
}

/**
 * Returns an OAuth2 client hydrated with stored tokens. Persists refreshed
 * access tokens back to storage automatically via the "tokens" event.
 */
export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) return null;

  const client = createOAuthClient();
  client.setCredentials(tokens);
  client.on("tokens", (newTokens) => saveTokens(newTokens));

  return client;
}

export async function getUserEmail(client: OAuth2Client): Promise<string | null> {
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? null;
}

export function isEmailAllowed(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(email.toLowerCase());
}
