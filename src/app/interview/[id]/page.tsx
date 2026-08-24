import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import InterviewEditor from "@/components/InterviewEditor";
import type { ArticleContent, NeedsCheckItem } from "@/lib/article";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(interviews).where(eq(interviews.id, id));
  if (!row) notFound();

  return (
    <InterviewEditor
      id={row.id}
      intervieweeName={row.intervieweeName}
      status={row.status}
      article={JSON.parse(row.articleJson) as ArticleContent}
      needsCheck={JSON.parse(row.needsCheckJson) as NeedsCheckItem[]}
      updatedAt={row.updatedAt.toISOString()}
    />
  );
}
