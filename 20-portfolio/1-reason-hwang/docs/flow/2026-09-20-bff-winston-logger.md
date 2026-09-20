# BFF-LOG-001: 환경별 Winston 로거

- 날짜: 2026-09-20. 범위: tech-shared / 2-bff-apps.
- 요청: Winston 설치 및 Nest 로거 연결, local 콘솔/stage·prod 파일.
- 구현: winston + NestJS 10 호환 nest-winston 1.x. shared/logger.ts factory를 main bootstrap 및 백필 runner에 연결. 설정은 기존 config snapshot에서 검증. 파일 10 MiB × 5개씩 순환, application/error 분리. 기존 Logger 호출 변경 불필요.
- stock: [BFF 정책](../stock/tech-shared/2-bff-apps/directory-policy.md#bff-log-001-winston-로깅), 패키지 README 및 .env.example.
- 검증: pnpm test 17 PASS, pnpm lint PASS. 임시 디렉터리에서 실제 Nest application context와 Logger 호출: local 콘솔만/폴더 미생성, stage·prod File transport만/JSON 파일 생성/context 및 error 분리 PASS. NODE_ENV production 매핑, APP_ENV 우선순위, 잘못된 환경/레벨 실패 PASS. 임시 파일 제거.
- 첫 검증 harness가 Winston end 후 제거된 transports를 조회해 실패하여 transport 검사를 종료 전에 수행하도록 수정 후 재검증 통과. 애플리케이션 코드 변경 사항 없음.
- API/업무 동작 변경 없음. HTTP 요청 접근 로그 추가 아님. 기존 SSE 실행 기록과 스크립트 콘솔은 별도 유지.
