import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import { buildArticleDocx, docxFileName } from "@/lib/docx-export";
import type { ArticleContent } from "@/lib/article";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(interviews).where(eq(interviews.id, id));
  if (!row) return NextResponse.json({ error: "찾을 수 없습니다" }, { status: 404 });

  const article = JSON.parse(row.articleJson) as ArticleContent;
  const buffer = await buildArticleDocx(article);
  const fileName = docxFileName(row.intervieweeName);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
