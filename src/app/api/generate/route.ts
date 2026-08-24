import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai/provider";
import { dbErrorResponse, aiErrorResponse } from "@/lib/api-error";

const requestSchema = z.object({
  transcript: z.string().min(1),
  questionnaire: z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), value: z.string().min(1) }),
    z.object({ type: z.literal("pdf"), base64: z.string().min(1) }),
  ]),
  scope: z.string().optional().default("전체"),
  intervieweeName: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다", details: parsed.error.flatten() }, { status: 400 });
  }

  let result;
  try {
    const provider = await getAIProvider();
    result = await provider.generateArticle(parsed.data);
  } catch (err) {
    return aiErrorResponse(err);
  }

  const now = new Date();
  const row = {
    id: randomUUID(),
    intervieweeName: parsed.data.intervieweeName,
    status: "draft" as const,
    articleJson: JSON.stringify(result.article),
    needsCheckJson: JSON.stringify(result.needsCheck),
    revisionSummaryJson: JSON.stringify(result.revisionSummary),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.insert(interviews).values(row);
  } catch (err) {
    return dbErrorResponse(err);
  }

  return NextResponse.json({
    id: row.id,
    article: result.article,
    needsCheck: result.needsCheck,
    revisionSummary: result.revisionSummary,
  });
}
