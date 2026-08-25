# 인터뷰 기사 초안 생성기

인터뷰 녹취록과 질문지를 업로드하면 AI가 [대신 만나드립니다] 스타일의 인터뷰 기사 초안을 만들어주고,
에디터에서 직접 다듬은 뒤 워드 파일로 내려받거나 브런치에 붙여넣을 수 있는 팀 내부 도구입니다.
50명 내외의 소규모 팀이 함께 쓰는 것을 전제로 하며 Vercel에 배포합니다.

## 전체 흐름 (5단계)

1. **대시보드** — 발행 일정 캘린더, 작업했던 인터뷰 목록, 사용법 안내
2. **업로드** — 녹취록(.txt/.docx), 질문지(.txt/.docx/.pdf, 필수), 인터뷰이 이름 입력 (항상 녹취록 전체를 대상으로 함)
3. **AI 생성** — 이 단계에서만 AI API를 호출(토큰 비용 발생 지점). 생성 완료 시점부터 DB에 초안으로 저장
4. **검토·수정** — 에디터로 직접 수정, 사이드바에 분량/예상 읽기 시간 표시, 자동저장
5. **완료** — 워드 파일(.docx) 다운로드, 브런치 붙여넣기용 서식 복사, 브런치 글쓰기 페이지 링크

모든 페이지는 상단 스테퍼 UI로 현재 단계를 보여주며, 앱의 모든 라우트는 `src/proxy.ts`에서
팀 공통 비밀번호 세션 쿠키를 확인합니다(URL 직접 접근 포함).

## 기술 스택

- **Next.js 16 (App Router, TypeScript)** — `middleware`가 `proxy`로 이름이 바뀐 최신 버전입니다.
  코드를 수정하기 전에 `node_modules/next/dist/docs/`의 문서를 참고하세요 (`AGENTS.md` 참고).
- **Tailwind CSS 4**
- **Turso (libSQL) + Drizzle ORM** — 캘린더 일정, 인터뷰 기사(구조화 JSON) 저장
- **docx** — 워드 파일 생성
- **mammoth** — 서버사이드 .docx 텍스트 추출. .pdf 질문지는 텍스트 추출 없이 원본 그대로 AI에게 첨부 파일로
  전달합니다 (Claude/Gemini 모두 PDF를 직접 읽을 수 있어, 자체 PDF 파싱에서 반복적으로 발생한 문제를 피함)
- **@google/genai / @anthropic-ai/sdk** — AI Provider 추상화 (`src/lib/ai/`). 기본값은 Gemini Flash(유료 API)
- **react-day-picker** — 캘린더 UI

## 왜 Turso인가 (DB 선택 트레이드오프)

| | Turso (libSQL) + Drizzle | Vercel Postgres(Neon) + Drizzle |
|---|---|---|
| 구현 난이도 | 매우 낮음. SQLite 문법 그대로, 로컬 개발 시 `file:local.db`로 별도 서버 없이 개발 가능 | 낮음. 표준 Postgres, JSONB 등 더 풍부한 타입 |
| 무료 티어 | 500 DB, 총 5GB, 월 5억 row read 등 — 이 앱(팀 50명, 저사용량) 규모에서는 사실상 무제한급 | 프로젝트 1개, 스토리지/컴퓨트 제한적, 일정 시간 미사용 시 컴퓨트 슬립(첫 요청 지연) |
| Vercel 궁합 | Vercel 공식 통합은 아니지만 REST 기반 `@libsql/client`로 서버리스 환경에서 별 문제 없이 동작 | Vercel Storage 탭에서 원클릭 연결, 가장 "네이티브"함 |
| 결론 | **이 프로젝트 규모(소규모 팀, 캘린더+인터뷰 기사만 저장)에는 설정이 더 간단하고 무료 한도가 넉넉한 Turso를 추천** | 더 복잡한 관계형 쿼리나 JSONB 인덱싱이 필요해지면 이쪽으로 이전 고려 |

두 옵션 모두 Drizzle ORM을 그대로 사용하므로, 필요하면 `src/lib/db/client.ts`와
`drizzle.config.ts`의 `dialect`만 바꿔서 전환할 수 있습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env
```

`.env`를 채웁니다:

- `TEAM_PASSWORD`, `SESSION_SECRET`(`openssl rand -base64 32`)
- `TURSO_DATABASE_URL` — 로컬 개발만 할 거라면 `file:local.db`로 두면 별도 가입 없이 바로 됩니다.
  실제 팀에서 공유하려면 [turso.tech](https://turso.tech)에서 무료 DB를 만들고
  `libsql://...` URL과 `TURSO_AUTH_TOKEN`을 채우세요.
- `GEMINI_API_KEY` (기본 provider, [aistudio.google.com](https://aistudio.google.com/apikey)에서 발급). Anthropic으로 전환할 거면 `ANTHROPIC_API_KEY`도.

마이그레이션 적용 후 개발 서버 실행:

```bash
npm run db:generate   # 스키마 변경 시 마이그레이션 파일 생성 (이미 생성된 drizzle/ 폴더는 커밋되어 있음)
npm run db:migrate    # DB에 마이그레이션 적용
npm run dev
```

## Vercel 배포

1. [turso.tech](https://turso.tech)에서 DB 생성 → `libsql://...` URL과 auth token 발급
   (`turso db create interview-drafts`, `turso db tokens create interview-drafts`)
2. 로컬에서 그 DB를 대상으로 마이그레이션 적용: `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate`
3. Vercel에서 이 저장소를 Import (Next.js 프로젝트 자동 인식)
4. Environment Variables에 `.env.example`의 모든 항목 입력
   (`TEAM_PASSWORD`, `SESSION_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
   `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)
5. Deploy

이후 `git push`하면 Vercel이 자동으로 재배포합니다.

## AI_PROVIDER 전환 방법

`src/lib/ai/provider.ts`가 `AI_PROVIDER` 환경변수(`gemini` 기본값 | `anthropic`)를 보고
`src/lib/ai/gemini.ts` 또는 `src/lib/ai/anthropic.ts` 구현체를 선택합니다. 두 구현체 모두
`src/lib/ai/schema.ts`에 정의된 동일한 구조화 JSON(zod 스키마)을 반환하도록 강제되어 있어,
전환 시 나머지 코드는 전혀 바꿀 필요가 없습니다. 현재 기본 모델은 Gemini Flash(`gemini-3.6-flash`,
유료 API, `src/lib/ai/gemini.ts`의 `GEMINI_MODEL` 상수에서 변경 가능)입니다.

Anthropic으로 되돌리려면 Vercel 환경변수에서 `AI_PROVIDER=anthropic`으로 바꾸고
`ANTHROPIC_API_KEY`를 채운 뒤 재배포하면 됩니다.

## Rate limit

`src/lib/rate-limit.ts` — `/api/generate`(AI 호출, 유일한 비용 발생 지점)에 한해 IP당 시간당 5회로
제한합니다. 메모리 기반이라 서버리스 인스턴스가 여러 개면 인스턴스별로 카운트되지만, 팀 내부용
저사용량 도구 규모에서는 충분합니다.

## 프로젝트 구조

```
src/
  app/
    login/                 팀 비밀번호 입력 (1단계 이전, proxy가 게이팅)
    page.tsx               1단계: 대시보드 (캘린더 + 작업 목록)
    new/                    2·3단계: 업로드 + AI 생성 (한 페이지, 내부 스테퍼)
    interview/[id]/         4·5단계: 검토·수정 + 완료 (탭으로 구분)
    api/
      auth/                 로그인/로그아웃
      calendar-events/      캘린더 CRUD
      interviews/           인터뷰 목록/상세/수정/docx 다운로드
      extract/              업로드 파일 → 텍스트 추출
      generate/             AI 생성 (유일한 비용 발생 지점) + DB 레코드 생성
  components/                Stepper, CalendarPanel, InterviewList, InterviewEditor
  lib/
    ai/                      AI Provider 추상화 (provider.ts, anthropic.ts, gemini.ts, schema.ts, prompt.ts)
    db/                      Drizzle 스키마 + 클라이언트
    article.ts                구조화 기사 타입 + 분량/읽기시간 계산
    docx-export.ts             워드 파일 생성 ([대신 만나드립니다] 스타일)
    clipboard-html.ts          브런치 붙여넣기용 서식 HTML
    extract-text.ts             .txt/.docx/.pdf 텍스트 추출
    session.ts / rate-limit.ts  인증 세션 / 레이트리밋
  proxy.ts                   전체 라우트 비밀번호 게이팅 + /api/generate 레이트리밋
```
