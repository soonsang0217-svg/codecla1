import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import { articleContentSchema } from "@/lib/ai/schema";
import { dbErrorResponse } from "@/lib/api-error";
import type { ArticleContent, NeedsCheckItem, RevisionSummary } from "@/lib/article";

function serialize(row: typeof interviews.$inferSelect) {
  return {
    id: row.id,
    intervieweeName: row.intervieweeName,
    status: row.status,
    article: JSON.parse(row.articleJson) as ArticleContent,
    needsCheck: JSON.parse(row.needsCheckJson) as NeedsCheckItem[],
    revisionSummary: JSON.parse(row.revisionSummaryJson) as RevisionSummary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [row] = await db.select().from(interviews).where(eq(interviews.id, id));
    if (!row) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
    return NextResponse.json({ interview: serialize(row) });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

const updateSchema = z.object({
  intervieweeName: z.string().min(1).optional(),
  article: articleContentSchema.optional(),
  needsCheck: z.array(z.object({ item: z.string(), reason: z.string(), resolved: z.boolean().optional() })).optional(),
  status: z.enum(["draft", "complete"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다", details: parsed.error.flatten() }, { status: 400 });
  }

  const update: Partial<typeof interviews.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.intervieweeName) update.intervieweeName = parsed.data.intervieweeName;
  if (parsed.data.article) update.articleJson = JSON.stringify(parsed.data.article);
  if (parsed.data.needsCheck) update.needsCheckJson = JSON.stringify(parsed.data.needsCheck);
  if (parsed.data.status) update.status = parsed.data.status;

  try {
    await db.update(interviews).set(update).where(eq(interviews.id, id));

    const [row] = await db.select().from(interviews).where(eq(interviews.id, id));
    if (!row) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
    return NextResponse.json({ interview: serialize(row) });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.delete(interviews).where(eq(interviews.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
