# 아침 브리핑 (Morning Briefing)

매일 아침 Google 캘린더 일정, Google Tasks 할 일, 관심 종목 시세, 주요 뉴스, 그리고 일정에
장소가 있을 경우 집에서부터의 예상 이동 시간/경로까지 한 화면에서 확인하고, 그 자리에서 바로
수정할 수 있는 개인용 웹 앱입니다. 집 서버/PC에서 Docker로 상시 구동하고, 아이패드에서 매일
브라우저(또는 홈 화면에 추가한 웹 앱)로 접속해 확인하는 용도로 설계했습니다.

## 주요 기능

- **오늘 일정** — Google 캘린더 조회, 생성, 수정, 삭제
- **할 일** — Google Tasks 조회, 체크, 생성, 수정, 삭제
- **주식 현황** — 설정에서 등록한 관심 종목의 실시간에 가까운 시세 (Finnhub)
- **주요 뉴스** — 국가/키워드 기준 헤드라인 (NewsAPI.org)
- **이동 경로/시간** — 일정에 장소가 있으면 집 주소 기준 예상 자동차 이동 시간·거리 (Kakao)
  와 지도 링크를 함께 표시
- Google 계정으로 로그인(허용된 이메일만), 세션 쿠키로 이후 접근 보호
- 아이패드 홈 화면에 추가하면 앱처럼 아이콘으로 실행 가능 (PWA manifest)

## 아키텍처

- **Next.js 16 (App Router, TypeScript)** — 단일 서비스로 프론트엔드 + API 라우트 제공
- **googleapis** — Google Calendar API v3, Google Tasks API v1 연동 (OAuth2, refresh token 자동 갱신)
- **node:sqlite** (Node.js 내장, 별도 네이티브 빌드 불필요) — Google 토큰, 사용자 설정, 외부 API
  응답 캐시를 로컬 SQLite 파일에 저장
- **Finnhub / NewsAPI.org / Kakao Local·Mobility API** — 외부 데이터 소스
- 서명된 쿠키 기반 세션(자체 구현) — 별도 인증 서버 없이 허용된 Google 계정 1명(또는 소수)만
  접근하도록 게이팅

## 사전 준비: API 키 발급

### 1) Google OAuth (필수)

1. [Google Cloud Console](https://console.cloud.google.com/) 에서 새 프로젝트 생성
2. **API 및 서비스 > 라이브러리** 에서 다음 API 활성화
   - Google Calendar API
   - Google Tasks API
3. **API 및 서비스 > OAuth 동의 화면** 설정 (User type: 외부/테스트 모드로도 충분, 테스트
   사용자에 본인 Google 계정 추가)
4. **API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID**
   - 애플리케이션 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI: `http://<서버 IP 또는 도메인>:3000/api/auth/google/callback`
     (로컬 개발 시 `http://localhost:3000/api/auth/google/callback`)
5. 발급된 클라이언트 ID/보안 비밀번호를 `.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 입력

### 2) Finnhub (주식 시세)

[finnhub.io](https://finnhub.io) 무료 가입 후 API 키를 `FINNHUB_API_KEY`에 입력합니다.
무료 티어는 미국 주요 거래소 티커(AAPL, MSFT 등) 위주로 지원하며, 국내(KOSPI/KOSDAQ) 종목은
지원이 제한적일 수 있습니다.

### 3) NewsAPI.org (뉴스)

[newsapi.org](https://newsapi.org) 무료 가입 후 API 키를 `NEWSAPI_KEY`에 입력합니다.

### 4) Kakao Developers (이동 경로)

1. [Kakao Developers](https://developers.kakao.com) 에서 애플리케이션 생성
2. **제품 설정**에서 "카카오맵(Local)" 활성화
3. **카카오모빌리티 > 길찾기(Directions)** API 사용 신청 (자동차 경로 계산용)
4. 앱의 REST API 키를 `KAKAO_REST_API_KEY`에 입력
5. `HOME_ADDRESS`(또는 앱 설정 화면)에 집 주소/좌표 검색 가능한 키워드를 입력

> **알려진 제한사항**: Kakao의 공개 REST API는 자동차 길찾기만 제공하며, 대중교통(버스/지하철)
> 경로 API는 별도 상용 계약이 필요합니다. 앱은 자동차 기준 예상 시간을 보여주고, 대중교통 경로는
> "지도에서 보기" 링크로 카카오맵을 열어 직접 확인하도록 안내합니다. 필요하다면 ODsay 등
> 대중교통 전용 API를 `src/lib/directions.ts`에 추가로 연동할 수 있습니다.

### 5) 세션 시크릿

```bash
openssl rand -base64 32
```

위 명령 결과를 `SESSION_SECRET`에 입력합니다.

## 로컬 개발 실행

```bash
npm install
cp .env.example .env   # 값 채워넣기
npm run dev
```

`http://localhost:3000` 접속 → Google 로그인 → `/settings`에서 집 주소, 관심 종목, 뉴스 옵션 설정.

## Docker로 상시 구동 (집 서버/PC)

```bash
cp .env.example .env   # 값 채워넣기 (GOOGLE_REDIRECT_URI는 서버의 실제 IP로 지정)
docker compose up -d --build
```

- 컨테이너는 3000번 포트로 서비스되며, Google 토큰/설정은 `briefing-data` Docker 볼륨의
  SQLite 파일에 저장되어 재시작해도 유지됩니다.
- 홈 네트워크(Wi-Fi) 안에서 `http://<서버-IP>:3000` 으로 접속하거나, 외부에서도 접근하려면
  Tailscale 등 VPN으로 서버를 홈 네트워크에 연결한 뒤 아이패드에서도 같은 VPN으로 접속하는
  방식을 권장합니다. (포트를 공인 인터넷에 직접 노출하는 것은 권장하지 않습니다.)

## 아이패드에서 매일 확인하기

1. 아이패드 Safari에서 `http://<서버-IP>:3000` 접속 후 Google 로그인
2. 공유 버튼 → **홈 화면에 추가** 를 선택하면 앱 아이콘처럼 홈 화면에서 바로 실행 가능
3. 매일 아침 아이콘을 눌러 실행하면 오늘 일정/할 일/시세/뉴스/이동 경로가 갱신되어 표시됩니다
   (새로고침 버튼으로 언제든 최신 데이터로 다시 불러올 수 있습니다)

## 환경변수 요약

`.env.example` 참고. 필수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
`SESSION_SECRET`. 나머지(주식/뉴스/경로 API 키, 허용 이메일)는 비워두면 해당 기능만
비활성화된 채로 앱은 정상 동작합니다.

## 프로젝트 구조

```
src/
  app/
    login/           로그인 페이지
    briefing/         메인 대시보드 (일정/할 일/시세/뉴스)
    settings/          집 주소·관심 종목·뉴스 설정
    api/
      auth/            Google OAuth 로그인/콜백/로그아웃/상태
      calendar/        캘린더 이벤트 CRUD
      tasks/           할 일 CRUD
      briefing/        일간 브리핑 집계 API
      settings/        사용자 설정 조회/저장
  lib/                 Google API, 외부 데이터 소스, 세션, DB 등 핵심 로직
  components/          일정/할 일 작성-수정 모달, 카드 UI
  proxy.ts             인증 게이팅 (로그인 안 된 요청 차단)
```
