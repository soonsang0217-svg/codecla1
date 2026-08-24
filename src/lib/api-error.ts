import { NextResponse } from "next/server";

/**
 * Turns a caught DB/server error into an actionable message instead of a
 * generic 500 — the two most common causes for this internal tool are a
 * missing Turso env var or a migration that was never applied.
 */
export function dbErrorResponse(err: unknown) {
  console.error("Database error", err);
  const message = err instanceof Error ? err.message : String(err);
  // Drizzle wraps the underlying libsql/sqlite error in `.cause` (e.g.
  // "SQLITE_ERROR: no such table: ..."), not in `.message` itself.
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  const full = `${message} ${cause}`;

  let hint = "데이터베이스 오류가 발생했습니다.";
  if (message.includes("TURSO_DATABASE_URL")) {
    hint = "TURSO_DATABASE_URL 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 확인해주세요.";
  } else if (/no such table/i.test(full)) {
    hint = "DB 테이블이 없습니다. 배포 전에 `npm run db:migrate`로 마이그레이션을 적용했는지 확인해주세요.";
  } else if (/UNAUTHENTICATED|401|invalid.*token/i.test(full)) {
    hint = "TURSO_AUTH_TOKEN이 올바르지 않습니다. Turso에서 토큰을 다시 발급해 확인해주세요.";
  } else if (/getaddrinfo|ENOTFOUND|fetch failed|network/i.test(full)) {
    hint = "데이터베이스에 연결하지 못했습니다. TURSO_DATABASE_URL 주소가 올바른지 확인해주세요.";
  }

  return NextResponse.json({ error: hint, detail: full.trim() }, { status: 500 });
}
