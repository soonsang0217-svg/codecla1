import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { calendarEvents } from "@/lib/db/schema";
import { dbErrorResponse } from "@/lib/api-error";

const updateSchema = z.object({
  intervieweeName: z.string().min(1).optional(),
  publishDate: z.string().min(1).optional(),
  memo: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  try {
    await db
      .update(calendarEvents)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id));

    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    if (!event) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
    return NextResponse.json({ event });
  } catch (err) {
    return dbErrorResponse(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return dbErrorResponse(err);
  }
}
