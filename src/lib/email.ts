import { requireEnv } from "./config";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Sends an email via Resend's REST API (https://resend.com — free tier,
 * no domain verification needed as long as `to` is the address you signed
 * up with). No SDK dependency; it's a single JSON POST.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = process.env.EMAIL_FROM || "Morning Briefing <onboarding@resend.dev>";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API returned ${res.status}: ${body}`);
  }
}
