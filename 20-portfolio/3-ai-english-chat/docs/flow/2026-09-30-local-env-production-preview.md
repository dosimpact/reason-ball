# 2026-09-30 로컬 환경 그대로 production 미리보기

사용자 요청에 따라 `.env.local`을 수정하거나 공급자/키를 덮어쓰지 않고 production 빌드와 서버를 실행했다. 기존 개발3322와 분리하기 위해 build 경로 선택 변수만 사용했다.

- 빌드: `PLAYWRIGHT_LIVE_PRODUCTION=1 pnpm build` — PASS, `.next-live`.
- 실행: `PLAYWRIGHT_LIVE_PRODUCTION=1 pnpm --filter @ai-english-chat/web start --hostname 127.0.0.1 --port 3324`.
- 접속 주소: **http://localhost:3324**. `127.0.0.1:3324`는 일부 mutation이 `CROSS_SITE_REQUEST_BLOCKED`403이므로 localhost를 사용한다. localhost의 Origin 검사는 통과하며 환경파일 변경은 없다.
- HTTP: 홈·캐릭터·미션·프로필200, production Playground404.
- Playwright headed: localhost 홈의 실제 캐릭터 및 학습 요약 로딩, 메뉴 클릭으로 미션 이동, console error0 확인.
- 실제 AI 생성 호출 없음. 모든 기능의 전체 회귀 검증을 의미하지 않는다.
- 로컬 APP_RUNTIME_MODE는 development 그대로지만 `next start`의 NODE_ENV=production으로 Playground가 차단된다.

테스트 저량에 이번 smoke 범위만 반영한다. 제품 코드·비즈니스 설계 변경 없음. 서버는 사용자가 검토할 수 있도록 실행 상태를 유지했다.
