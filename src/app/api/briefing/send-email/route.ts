import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiAuth";
import { sendBriefingEmailNow } from "@/lib/briefingEmailJob";
import { parseLocationFromRequest } from "@/lib/directions";

// Session-cookie gated by proxy.ts like every other /api/ route (this isn't
// the cron job — it's the "지금 메일로 보내기" button, triggered by the
// logged-in user from the dashboard).
export async function POST(request: Request) {
  try {
    const currentLocation = parseLocationFromRequest(request);
    await sendBriefingEmailNow(currentLocation);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
