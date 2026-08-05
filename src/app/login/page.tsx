const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "허용되지 않은 Google 계정입니다. 관리자에게 문의하세요.",
  missing_code: "로그인 요청이 올바르지 않습니다. 다시 시도해주세요.",
  oauth_failed: "Google 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const errorParam = searchParams.error;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;
  const message = error ? ERROR_MESSAGES[error] ?? "로그인에 실패했습니다." : null;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">아침 브리핑</h1>
          <p className="mt-2 text-sm text-slate-500">
            일정, 할 일, 주식, 뉴스, 이동 경로를 한 화면에서 확인하세요.
          </p>
        </div>

        {message && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{message}</p>
        )}

        <a
          href="/api/auth/google"
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="m6.3 14.7 6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.3 0 10.1-2 13.7-5.4l-6.3-5.3C29.4 35.3 26.8 36 24 36c-5.3 0-9.8-3.4-11.4-8.1l-6.5 5C9.6 39.6 16.3 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.6 6.9l6.3 5.3C38.6 37.2 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z"
            />
          </svg>
          Google 계정으로 로그인
        </a>

        <p className="text-xs text-slate-400">
          캘린더/할 일 연동을 위해 Google 계정 접근 권한이 필요합니다.
        </p>
      </div>
    </main>
  );
}
