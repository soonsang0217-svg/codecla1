# 아침 브리핑 (Morning Briefing)

매일 아침 Google 캘린더 일정, Google Tasks 할 일, 관심 종목 시세, 주요 뉴스, 그리고 일정에
장소가 있을 경우 집에서부터의 예상 이동 시간/경로까지 한 화면에서 확인하고, 그 자리에서 바로
수정할 수 있는 개인용 웹 앱입니다. **터미널이나 별도 PC 서버 없이, 아이패드(또는 아무 브라우저)
만으로 배포와 매일 사용이 모두 가능하도록** Vercel + Upstash 조합을 기본 배포 방식으로 설계했습니다.

## 주요 기능

- **오늘 일정** — Google 캘린더 조회, 생성, 수정, 삭제
- **월별 캘린더** (`/calendar`) — 달력에서 날짜 클릭해 그날 일정 확인·추가·수정
- **할 일** — Google Tasks 조회, 체크, 생성, 수정, 삭제
- **주식 현황** — 설정에서 등록한 관심 종목의 실시간에 가까운 시세 (해외: Finnhub, 국내: Naver 금융)
- **주요 뉴스** — 국가/키워드 기준 헤드라인 (Google 뉴스 RSS, 키 불필요)
- **이동 경로/시간** — 일정에 장소가 있으면 집 주소 기준 예상 자동차 이동 시간·거리·출발 시각 (Kakao)
  와 지도 링크를 함께 표시. 일정 등록 시 장소는 Kakao 검색 자동완성으로 입력해 오탈자로 인한
  경로 계산 실패를 방지
- **건강** (선택) — 아이패드 단축어 자동화로 전송한 지난밤 수면 시간/점수, 최근 심박수 표시
- Google 계정으로 로그인(허용된 이메일만), 세션 쿠키로 이후 접근 보호
- 아이패드 홈 화면에 추가하면 앱처럼 아이콘으로 실행 가능 (PWA manifest)

## 아키텍처

- **Next.js 16 (App Router, TypeScript)** — 단일 서비스로 프론트엔드 + API 라우트 제공
- **googleapis** — Google Calendar API v3, Google Tasks API v1 연동 (OAuth2, refresh token 자동 갱신)
- **Upstash Redis** (REST 기반, 서버리스 친화적) — Google 토큰, 사용자 설정, 외부 API 응답
  캐시를 저장. 로컬 파일에 의존하지 않으므로 Vercel 같은 서버리스 플랫폼에서도 재배포/재시작과
  무관하게 데이터가 유지됩니다.
- **Finnhub / Naver 금융 / Google 뉴스 RSS / Kakao Local·Mobility API** — 외부 데이터 소스
- 서명된 쿠키 기반 세션(자체 구현) — 별도 인증 서버 없이 허용된 Google 계정 1명(또는 소수)만
  접근하도록 게이팅

## 배포: Vercel + Upstash (터미널 없이, 아이패드만으로 가능)

전체 과정이 브라우저 안에서 클릭 몇 번으로 끝납니다. PC/홈서버가 필요 없습니다.

### 1) Upstash Redis 만들기

1. [upstash.com](https://upstash.com) 접속 → 가입(GitHub 계정으로 바로 가능) → **Create Database**
2. 리전은 배포할 Vercel 리전과 가까운 곳으로 선택 (예: 서울에서 쓸 거면 도쿄/싱가포르 등)
3. 생성된 데이터베이스의 **REST API** 탭에서 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   값을 복사해둡니다 (다음 단계에서 Vercel에 붙여넣습니다)

### 2) 나머지 API 키 발급

| 항목 | 어디서 | 필요한 것 |
|---|---|---|
| Google OAuth (필수) | [Google Cloud Console](https://console.cloud.google.com/) | Calendar API + Tasks API 활성화 → OAuth 클라이언트(웹 앱) 생성 |
| 주식 시세 | [finnhub.io](https://finnhub.io) 무료 가입 | API 키 |
| 뉴스 | 없음 (Google 뉴스 RSS, 키/가입 불필요) | - |
| 이동 경로 | [Kakao Developers](https://developers.kakao.com) | 앱 생성 → Local + 길찾기(Directions) 제품 활성화 → REST API 키 |

Google OAuth 클라이언트의 **승인된 리디렉션 URI**는 3단계에서 Vercel이 발급해주는 주소를
알아야 정확히 채울 수 있으므로, Google 클라이언트 생성은 4단계 이후에 마무리해도 됩니다
(먼저 임시로 `https://example.com/api/auth/google/callback`을 넣어두고 나중에 실제 주소로
수정 → 저장하면 됩니다).

### 3) Vercel에 배포

1. [vercel.com](https://vercel.com) 가입(GitHub 계정으로) → **Add New... > Project**
2. 이 저장소(`codecla1`)를 Import (Vercel이 Next.js 프로젝트임을 자동 인식, 빌드 설정 변경 불필요)
3. **Environment Variables**에 `.env.example`의 항목을 모두 입력:
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (1단계에서 복사한 값)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `https://<프로젝트명>.vercel.app/api/auth/google/callback`
     (정확한 도메인은 Deploy 후 확인 가능; 미리 원하는 프로젝트명을 정해서 입력해도 됨)
   - `ALLOWED_EMAIL`, `SESSION_SECRET`(`openssl rand -base64 32` 또는 아무 긴 무작위 문자열)
   - `FINNHUB_API_KEY`, `STOCK_SYMBOLS`, `NEWS_COUNTRY`, `NEWS_QUERY`
   - `KAKAO_REST_API_KEY`, `HOME_ADDRESS`
4. **Deploy** 클릭 → 몇 분 내 `https://<프로젝트명>.vercel.app` 주소 발급
5. Google Cloud Console로 돌아가 OAuth 클라이언트의 **승인된 리디렉션 URI**를 실제 Vercel
   주소(`https://<프로젝트명>.vercel.app/api/auth/google/callback`)로 정확히 맞춰줍니다

이후 코드를 수정해서 `git push`하면 Vercel이 자동으로 재배포합니다. 아이패드에서 Safari로
[vercel.com](https://vercel.com) 대시보드에 접속해 위 과정을 그대로 따라 할 수 있습니다.

### 4) 아이패드에서 매일 확인하기

1. Safari에서 `https://<프로젝트명>.vercel.app` 접속 → Google 로그인
2. 공유 버튼 → **홈 화면에 추가** → 앱 아이콘처럼 홈 화면에서 바로 실행 가능
3. `/settings`에서 집 주소, 관심 종목, 뉴스 옵션을 한 번 설정해두면 계속 유지됩니다
4. 매일 아침 아이콘을 눌러 실행 → 새로고침 버튼으로 언제든 최신 데이터 갱신

> **알려진 제한사항**: Kakao의 공개 REST API는 자동차 길찾기만 제공하며, 대중교통(버스/지하철)
> 경로 API는 별도 상용 계약이 필요합니다. 앱은 자동차 기준 예상 시간을 보여주고, 대중교통 경로는
> "지도에서 보기" 링크로 카카오맵을 열어 직접 확인하도록 안내합니다.

## Apple 건강 데이터 연동 (선택, 아이패드 단축어 자동화)

아이패드/아이폰 웹 앱은 Apple 건강(HealthKit) 데이터에 기술적으로 직접 접근할 수 없습니다
(iOS 네이티브 앱만 가능). 대신 **단축어(Shortcuts) 앱의 자동화**로 매일 아침 건강 데이터를
읽어 우리 서버로 전송하는 방식을 씁니다.

### 1) 서버에 비밀 토큰 설정

Vercel 환경변수에 `HEALTH_INGEST_TOKEN`을 추가합니다 (`openssl rand -base64 32`로 생성한
무작위 문자열). 이 토큰을 아는 요청만 건강 데이터를 전송할 수 있습니다.

### 2) 아이패드에서 단축어 자동화 만들기

1. **단축어** 앱 → **자동화** 탭 → **+** → **개인 자동화 생성** → **시간대** 선택
   (예: 매일 오전 7시) → **즉시 실행**(알림 없이 바로 실행)으로 설정
2. **동작 추가** → **"건강 샘플 찾기"**(Find Health Samples) 액션을 필요한 만큼 추가:
   - 수면 관련 항목(예: 수면 시간, 수면 점수 — 기기에 표시되는 이름대로 선택), 최신 1개
   - 심박수, 최신 1개
3. **"사전"**(Dictionary) 액션으로 아래 키에 맞춰 값을 채워 넣습니다:
   ```json
   {
     "sleepDurationMinutes": 452,
     "sleepScore": 85,
     "heartRate": 58,
     "heartRateVariability": 45
   }
   ```
   (전송하고 싶은 항목만 넣어도 됩니다 — 나머지는 이전 값이 유지됩니다)
4. **"URL의 콘텐츠 가져오기"**(Get Contents of URL) 액션 추가:
   - URL: `https://<프로젝트명>.vercel.app/api/health/ingest`
   - 방법: `POST`
   - 헤더: `Authorization: Bearer <HEALTH_INGEST_TOKEN 값>`, `Content-Type: application/json`
   - 요청 본문: 위에서 만든 사전(JSON)

단축어 앱의 정확한 화면/항목 이름은 iOS 버전에 따라 다를 수 있습니다. 막히는 화면이 있으면
캡처해서 확인 요청하세요.

## 대안 배포: Docker로 직접 호스팅

집 서버/PC나 Railway·Fly.io 같은 곳에 직접 띄우고 싶다면 Docker로도 실행할 수 있습니다.
저장소는 여전히 Upstash Redis를 사용하므로(로컬 볼륨 불필요), `.env`만 채우면 됩니다.

```bash
cp .env.example .env   # 값 채워넣기 (GOOGLE_REDIRECT_URI는 실제 접속 주소로 지정)
docker compose up -d --build
```

컨테이너는 3000번 포트로 서비스됩니다. 홈 네트워크 밖에서도 접속하려면 Tailscale 등 VPN으로
서버를 홈 네트워크에 연결한 뒤 아이패드에서도 같은 VPN으로 접속하는 방식을 권장합니다
(포트를 공인 인터넷에 직접 노출하는 것은 권장하지 않습니다).

## 로컬 개발 실행

```bash
npm install
cp .env.example .env   # 값 채워넣기 (Upstash는 무료 DB 하나 만들어서 연결)
npm run dev
```

## 환경변수 요약

`.env.example` 참고. 필수: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET`.
나머지(주식/뉴스/경로 API 키, 허용 이메일, `HEALTH_INGEST_TOKEN`)는 비워두면 해당 기능만
비활성화된 채로 앱은 정상 동작합니다.

## 프로젝트 구조

```
src/
  app/
    login/           로그인 페이지
    briefing/         메인 대시보드 (일정/할 일/건강/시세/뉴스)
    calendar/          월별 캘린더 뷰
    settings/          집 주소·관심 종목·뉴스 설정
    api/
      auth/            Google OAuth 로그인/콜백/로그아웃/상태
      calendar/        캘린더 이벤트 CRUD
      tasks/           할 일 CRUD
      places/          장소 자동완성 (Kakao 검색 프록시)
      health/          건강 데이터 조회 / 단축어 수신(ingest)
      briefing/        일간 브리핑 집계 API
      settings/        사용자 설정 조회/저장
  lib/                 Google API, 외부 데이터 소스, 세션, Upstash, 타임존 등 핵심 로직
  components/          일정/할 일 작성-수정 모달, 카드 UI, 장소 자동완성
  proxy.ts             인증 게이팅 (로그인 안 된 요청 차단)
```
