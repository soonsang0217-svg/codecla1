import Link from "next/link";
import Stepper from "@/components/Stepper";
import CalendarPanel from "@/components/CalendarPanel";
import InterviewList from "@/components/InterviewList";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <Stepper current={1} />
        <Link
          href="/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          새 인터뷰 작업 시작
        </Link>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800">사용법</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>&ldquo;새 인터뷰 작업 시작&rdquo;을 눌러 녹취록과 질문지를 업로드하세요.</li>
          <li>AI가 초안을 만들면 무엇을 고쳤는지 요약을 확인하세요.</li>
          <li>에디터에서 직접 다듬고, 완료되면 워드 파일로 내려받거나 브런치에 붙여넣으세요.</li>
        </ol>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-800">발행 일정 캘린더</h2>
        <CalendarPanel />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-800">작업했던 인터뷰</h2>
        <InterviewList />
      </section>
    </main>
  );
}
