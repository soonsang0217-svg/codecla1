import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { calendarEvents } from "@/lib/db/schema";

const createSchema = z.object({
  intervieweeName: z.string().min(1),
  publishDate: z.string().min(1), // "YYYY-MM-DD"
  memo: z.string().optional(),
});

export async function GET() {
  const rows = await db.select().from(calendarEvents).orderBy(calendarEvents.publishDate);
  return NextResponse.json({ events: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다", details: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const row = {
    id: randomUUID(),
    intervieweeName: parsed.data.intervieweeName,
    publishDate: parsed.data.publishDate,
    memo: parsed.data.memo ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(calendarEvents).values(row);
  return NextResponse.json({ event: row }, { status: 201 });
}
