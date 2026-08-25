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

/**
 * Turns a caught AI-provider error (Anthropic/Gemini SDK) into an actionable
 * message — this is almost always a missing/invalid API key, which the raw
 * SDK error buries inside a nested JSON blob that isn't useful to read as-is.
 */
export function aiErrorResponse(err: unknown) {
  console.error("AI generation failed", err);
  const message = err instanceof Error ? err.message : String(err);
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const keyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";

  let hint = "AI 생성 중 오류가 발생했습니다.";
  if (message.includes(`${keyName} environment variable is not set`)) {
    hint = `${keyName} 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 확인해주세요.`;
  } else if (/API_KEY_INVALID|API key not valid|invalid x-api-key|authentication_error|401/i.test(message)) {
    hint = `${keyName}가 올바르지 않습니다. 발급받은 키를 다시 확인해 Vercel 환경변수에 정확히 입력했는지 확인해주세요.`;
  } else if (/RESOURCE_EXHAUSTED|rate_limit|429/i.test(message)) {
    hint = "AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
  } else if (/UNAVAILABLE|"code":\s*503|high demand|overloaded/i.test(message)) {
    hint = "AI 서버가 일시적으로 혼잡합니다. 잠시 후(1~2분 뒤) 다시 시도해주세요.";
  } else if (/PERMISSION_DENIED|billing/i.test(message)) {
    hint = `${keyName}에 결제(billing)가 연결되어 있는지 확인해주세요.`;
  } else if (provider === "gemini" && /"code":\s*404|NOT_FOUND|is no longer available|no longer available to new/i.test(message)) {
    hint = "설정된 Gemini 모델을 더 이상 쓸 수 없습니다. src/lib/ai/gemini.ts의 GEMINI_MODEL을 코드에 안내된 대체 모델로 바꿔주세요.";
  }

  return NextResponse.json({ error: hint, detail: message }, { status: 502 });
}
