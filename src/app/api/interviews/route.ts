import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";

export async function GET() {
  const rows = await db
    .select({
      id: interviews.id,
      intervieweeName: interviews.intervieweeName,
      status: interviews.status,
      createdAt: interviews.createdAt,
      updatedAt: interviews.updatedAt,
    })
    .from(interviews)
    .orderBy(desc(interviews.updatedAt));

  return NextResponse.json({ interviews: rows });
}
