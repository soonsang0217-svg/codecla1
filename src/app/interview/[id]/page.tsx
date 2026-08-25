import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { cookies } from "next/headers";
import { db } from "@/lib/db/client";
import { interviews } from "@/lib/db/schema";
import InterviewEditor from "@/components/InterviewEditor";
import { parseArticle, type NeedsCheckItem } from "@/lib/article";
import { verifySessionCookie, SESSION_COOKIE } from "@/lib/session";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(interviews).where(eq(interviews.id, id));
  if (!row) notFound();

  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  const isOwner = !!session && (session.role === "admin" || (row.createdBy !== null && row.createdBy === session.username));

  if (!isOwner) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-neutral-800">접근 권한이 없습니다</p>
        <p className="text-sm text-neutral-500">작성자만 열람 및 편집할 수 있습니다.</p>
        <Link
          href="/"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          대시보드로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <InterviewEditor
      id={row.id}
      intervieweeName={row.intervieweeName}
      status={row.status}
      article={parseArticle(row.articleJson)}
      needsCheck={JSON.parse(row.needsCheckJson) as NeedsCheckItem[]}
      updatedAt={row.updatedAt.toISOString()}
    />
  );
}
