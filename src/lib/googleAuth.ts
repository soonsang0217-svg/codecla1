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

/**
 * `prompt: "consent"` forces Google's full permission screen every single
 * time, which is only actually necessary once — to obtain a refresh_token
 * on the very first authorization. Once we already have one stored, logging
 * back in only needs to re-confirm identity for the session cookie, so we
 * omit prompt entirely and let Google skip the consent/account screens
 * whenever it can (already-granted scopes, active Google session).
 */
export async function getAuthUrl(): Promise<string> {
  const client = createOAuthClient();
  const alreadyConnected = await isConnected();
  return client.generateAuthUrl({
    access_type: "offline",
    ...(alreadyConnected ? {} : { prompt: "consent" }),
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<Credentials> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function saveTokens(tokens: Credentials): Promise<void> {
  const existing = (await getKV<Credentials>(TOKENS_KEY)) || {};
  await setKV(TOKENS_KEY, { ...existing, ...tokens });
}

export async function loadTokens(): Promise<Credentials | null> {
  return getKV<Credentials>(TOKENS_KEY);
}

export async function clearTokens(): Promise<void> {
  await deleteKV(TOKENS_KEY);
}

export async function isConnected(): Promise<boolean> {
  const tokens = await loadTokens();
  return !!tokens?.refresh_token;
}

/**
 * Returns an OAuth2 client hydrated with stored tokens. Persists refreshed
 * access tokens back to storage automatically via the "tokens" event.
 */
export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
  const tokens = await loadTokens();
  if (!tokens?.refresh_token) return null;

  const client = createOAuthClient();
  client.setCredentials(tokens);
  client.on("tokens", (newTokens) => {
    saveTokens(newTokens).catch((err) => console.error("Failed to persist refreshed tokens", err));
  });

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
