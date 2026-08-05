import { NextResponse } from "next/server";
import type { OAuth2Client } from "google-auth-library";
import { getAuthorizedClient } from "./googleAuth";

export class UnauthorizedError extends Error {}

export async function requireGoogleClient(): Promise<OAuth2Client> {
  const client = await getAuthorizedClient();
  if (!client) {
    throw new UnauthorizedError("Google account not connected");
  }
  return client;
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 401 });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}
