import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import { buildArticleDocx, docxFileName } from "@/lib/docx-export";
import { dbErrorResponse } from "@/lib/api-error";
import { parseArticle } from "@/lib/article";
import { getSession, canAccessInterview } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let row: typeof interviews.$inferSelect | undefined;
  try {
    [row] = await db.select().from(interviews).where(eq(interviews.id, id));
  } catch (err) {
    return dbErrorResponse(err);
  }
  if (!row) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });
  if (!canAccessInterview(getSession(request), row.createdBy)) {
    return NextResponse.json({ error: "작성자만 열람 및 편집할 수 있습니다" }, { status: 403 });
  }

  const article = parseArticle(row.articleJson);
  const buffer = await buildArticleDocx(article);
  const fileName = docxFileName(row.intervieweeName);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
