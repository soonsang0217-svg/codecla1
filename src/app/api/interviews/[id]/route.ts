import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import { articleContentSchema } from "@/lib/ai/schema";
import { dbErrorResponse } from "@/lib/api-error";
import { parseArticle, type NeedsCheckItem, type RevisionSummary } from "@/lib/article";
import { getSession, canAccessInterview } from "@/lib/auth";

function forbiddenResponse() {
  return NextResponse.json({ error: "작성자만 열람 및 편집할 수 있습니다" }, { status: 403 });
}

function serialize(row: typeof interviews.$inferSelect) {
  return {
    id: row.id,
    intervieweeName: row.intervieweeName,
    status: row.status,
    createdBy: row.createdBy,
    article: parseArticle(row.articleJson),
    needsCheck: JSON.parse(row.needsCheckJson) as NeedsCheckItem[],
    revisionSummary: JSON.parse(row.revisionSummaryJson) as RevisionSummary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [row] = await db.select().from(interviews).where(eq(interviews.id, id));
    if (!row) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
    if (!canAccessInterview(getSession(request), row.createdBy)) return forbiddenResponse();
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

  try {
    const [existing] = await db.select().from(interviews).where(eq(interviews.id, id));
    if (!existing) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
    if (!canAccessInterview(getSession(request), existing.createdBy)) return forbiddenResponse();

    const update: Partial<typeof interviews.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.intervieweeName) update.intervieweeName = parsed.data.intervieweeName;
    if (parsed.data.article) update.articleJson = JSON.stringify(parsed.data.article);
    if (parsed.data.needsCheck) update.needsCheckJson = JSON.stringify(parsed.data.needsCheck);
    if (parsed.data.status) update.status = parsed.data.status;

    await db.update(interviews).set(update).where(eq(interviews.id, id));

    const [row] = await db.select().from(interviews).where(eq(interviews.id, id));
    if (!row) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
    return NextResponse.json({ interview: serialize(row) });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [existing] = await db.select().from(interviews).where(eq(interviews.id, id));
    if (!existing) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
    if (!canAccessInterview(getSession(request), existing.createdBy)) return forbiddenResponse();

    await db.delete(interviews).where(eq(interviews.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
