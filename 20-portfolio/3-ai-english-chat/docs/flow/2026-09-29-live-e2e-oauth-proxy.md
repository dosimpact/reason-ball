# 실행 중 서비스의 실제 E2E 검증

- 날짜: 2026-09-29 시작, 2026-09-30 KST 기록 완료
- 배경: 사용자가 3000번 서비스와 2890번 OAuth 프록시 연결 상태에서 E2E 실행을 요청했다.
- 대상: 기존 개발 서버, Playwright Chromium, 원격 Supabase, 실제 OAuth AI. 기존 설정의 `http://dodonet.iptime.org:13000`으로 접속했다. localhost:3000과 전달 주소 모두 HTTP 200이며 동일한 페이지 제목·개발 번들 경로를 반환했다. 서버를 새로 기동하거나 재시작하지 않았다.
- 실행 설정: worker 1, retry 0. mock suite·PGlite·전체 계약 검사는 실행하지 않았다.

## 실행 결과

1. `pnpm test:e2e`: 등록 122개 중 **13 PASS / 3 FAIL / 1 INTERRUPTED / 105 NOT RUN**, 10.2분.
   - Artifact 실제 AI 재작성·교정·분석, 수정 충돌, Text/Code/Sheet 저장·복원, 모바일 저장, 격리 코드 실행, 복사, 잘못된 첨부 거부가 통과했다.
   - `attachment-composer.spec.ts:49`, `attachment-composer.spec.ts:116`, `attachment-edit.spec.ts:7`이 실제 assistant 완료 메시지 0개로 120초 timeout에 실패했다.
   - 동일한 채팅 완료 실패가 세 번 연속 확인되어 에이전트가 Playwright에 SIGINT를 보내 중단했다. 실행 중이던 `audio-failure.spec.ts`는 실패 판정이 아닌 INTERRUPTED다.
   - 최초 보고서: `apps/web/playwright-report-20260929-full/index.html`, trace·화면: `apps/web/test-results-20260929-full/`.
2. `pnpm test:e2e auth.spec.ts shell.spec.ts chat.spec.ts --grep 'AUTH|theme changes|mobile menu|new chat button|real AI send'`: **7 PASS / 2 FAIL**, 3.3분.
   - 게스트 세션 복원, 잘못된 로그인과 회원 전환, 로그아웃 후 권한 분리, 비밀번호 설정, foreign-origin 인증 요청 거부, 새 대화 생성·복원, 모바일 메뉴가 통과했다.
   - `chat.spec.ts:97`: 첫 일반 텍스트 전송 후 완료 assistant가 없어 120초 timeout. 후속 편집·재생성 검증에는 도달하지 못했다.
   - `shell.spec.ts:27`: 테마 변경 전 초기 미션 카드 heading을 찾지 못했다. 화면은 미션 빈 상태였다. 신규 회원 fixture가 미션 배정을 준비하지 않는 조건과 현재 배정 정책을 함께 검토해야 하며, 테마 색상 결함으로 단정하지 않는다.
   - 추가 보고서: `apps/web/playwright-report/index.html`, trace·화면: `apps/web/test-results/`.

## 스트림 진단

- 실패 trace의 `/api/ai/chat`은 HTTP 200으로 시작했으나 완료 답변이 저장되지 않았고 화면에는 답변을 가져오지 못했다는 안내가 나타났다.
- 동일 환경의 `@ai-sdk/openai` + `streamText`로 프록시에 한 문장 인사를 요청했다. `start → start-step → finish-step → finish`만 발생하고 `text-delta`는 발생하지 않았다.
- `http://127.0.0.1:2890/v1/responses`에 `stream: true`를 명시한 직접 요청은 HTTP 200, `application/json; charset=utf-8`을 반환했다. SSE 응답이 아닌 현상은 채팅 스트림 계약 불일치의 직접 근거다. 프록시 내부의 원인이나 수정은 이번 작업 범위에서 확정하지 않았다.
- 따라서 `/v1/models` HTTP 200과 비스트리밍 Artifact AI 성공만으로 실제 채팅 성공을 보증할 수 없다.
- `Accept: text/event-stream`까지 명시한 재확인도 HTTP 200 JSON이었다. JSON 자체는 `object: response`, `status: completed`, message 출력 1개(텍스트 6자), error 없음이었다. 즉 생성된 텍스트는 있지만 SDK가 기대하는 SSE 전송 형식이 아니었다.

## 정리·영향·후속 작업

- 두 실행 종료 후 `.e2e-owned-accounts.json`은 각각 빈 배열이었다. 기존 fixture가 임시 계정과 소유 데이터를 정리했다. 사용자 서버와 기존 데이터는 유지했다.
- 앱·프록시·테스트 코드는 변경하지 않았다. 이번 실행은 전체 suite PASS 또는 배포 준비 완료가 아니다.
- 영향받는 저량: `test-design.md` §4 최신 실행 및 §5 미완료 gate, `system-design.md` §3.2 Playwright 환경 설명.
- 후속: 프록시 Responses SSE 계약을 수정·검증한 뒤 일반 채팅과 첨부 실패 테스트를 재실행하고, 미션 배정 fixture를 확인한 다음 전체 122개를 재실행한다.
