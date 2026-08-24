import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai/provider";
import { dbErrorResponse } from "@/lib/api-error";

const requestSchema = z.object({
  transcript: z.string().min(1),
  questionnaire: z.string().optional().default(""),
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
    console.error("AI generation failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI 생성 중 오류가 발생했습니다" },
      { status: 502 },
    );
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
