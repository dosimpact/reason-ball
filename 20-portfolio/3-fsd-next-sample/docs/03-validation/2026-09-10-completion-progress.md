# Persona English 완성 작업 진행 기록

> 작업일: 2026-09-10
> 전체 목표: 비즈니스·개발 설계서의 미완료 기능 구현 후 실제 Playwright E2E 검증
> 전체 판정: 진행 중. 기존 테스트 및 이번 추가 테스트 통과는 전체 요구사항 완료를 의미하지 않는다.

## 현재 검증 범위 변경 — 사용자 결정

2026-09-10 사용자가 실제 Supabase E2E를 이번 작업에서 실행하지 않아도 된다고 명시했다. 서버 service role key 연결은 추후 사용자와 진행한다. 실제 Supabase E2E 상태는 `DEFERRED_BY_USER`이며 현재 작업 완료를 막는 gate에서 제외한다. Docker read-only 문제 해결·정리·재시작을 요청하거나 stack 기동을 반복할 필요가 없다.

이 결정은 나머지 기획 구현이나 서버 권한/저장 계약을 없애는 것이 아니다. 실제 로컬 Playwright 브라우저 검증을 계속하며 미실행 Supabase 연동을 PASS로 기록하지 않는다. 아래 과거 기록의 Supabase BLOCKED/미완료 표기는 당시의 증거로 보존하되 현재 완료 범위는 이 결정을 따른다. 운영 배포 준비 완료 여부와 현재 작업 완료 여부를 구분한다.

## 이번에 수정한 사용자 흐름

| 요구사항 | 발견한 문제 | 변경 및 증거 |
|---|---|---|
| LEARN-09/10, NFR-04 | 평가가 끝나면 보상 저장 오류 UI가 사라짐 | 평가와 완료 저장을 분리하고, 결과를 유지한 채 저장 재시도 제공 |
| REWARD-02 | 보상 저장 실패 후 새로고침하면 평가를 복원하지 못함 | 대화에 missionRunId 저장, 서버 run의 평가·보상 결과 복원. 재시도 요청의 평가·보상 ID가 동일한지 검증 |
| LEARN-09/10 | 불합격 결과에서 연습을 계속하는 동작 없음 | 같은 run에서 대화를 추가한 뒤 재평가 가능 |
| MISSION-10 | 완료 결과에 재도전 진입 없음, 상세의 attempt=new가 무시됨 | 새 대화 진입 및 대화 ID를 포함한 URL로 전환. 새 시도에서 최고점 표시, reload 시 같은 대화 유지 |
| NFR-01, LEARN-09/10 | 360px 화면에서 평가 패널이 숨겨져 완료 불가능 | 모바일 학습 노트에서도 같은 평가·완료·결과 패널 제공 |

계산/변환은 `restoreEvaluationResult`, `conversationUrl`로 분리하고, API 호출과 저장·화면 이동은 기존 실행 경계에 두었다. 도메인 함수는 소유 slice에 배치했다.

## 실제 실행 증거

- 변경 전: `CI=1 pnpm test:e2e` → 27/27 PASS (1.7분).
- 변경 후: `pnpm test:e2e` → 30/30 PASS (1.9분), 재시도 없이 통과.
- 환경: `http://127.0.0.1:3210`, Next.js webpack 개발 서버, `APP_RUNTIME_MODE=mock`, `AI_PROVIDER=mock`, `NEXT_PUBLIC_APP_RUNTIME_MODE=mock`.
- 브라우저: Chromium 데스크톱, Pixel 7 프로젝트, 추가 360×800 viewport 완료 테스트.
- 추가 스펙: `apps/web/tests/e2e/mission-recovery.spec.ts`의 3개 시나리오.
- 보상 저장 실패만 `page.route()`로 503을 주입한다. 정상 평가·보상 요청은 실제 앱 Route Handler를 호출한다.
- 브라우저 MCP 미제공으로 설치된 Playwright Chromium을 직접 실행해 수정 전 모바일 접근 불가와 수정 후 완료 화면을 확인했다.
- HTML 결과: `apps/web/playwright-report/index.html` (다음 테스트 실행 시 갱신됨).
- `pnpm typecheck` → PASS.
- `pnpm build` → PASS, production 번들·타입 검사·페이지 생성 성공.
- `pnpm lint` → PASS, 기존 동적 이미지 관련 warning 3건.

## 실연동 환경 조사

`pnpm supabase:status`에서 프로젝트 DB 컨테이너가 없음을 확인했다. 일반 `pnpm supabase:start`는 Docker credential helper 자식 프로세스에서 대기했다. 공개 ECR `/v2/`는 정상 인증 요구 응답(HTTP 401)을 반환했다.

대기 중인 첫 기동을 중단하고, 사용자 설정을 수정하지 않는 임시 `DOCKER_CONFIG`와 기존 Docker socket을 사용해 다시 기동했다. 이때 공개 ECR, GHCR, Docker Hub 모두 Docker daemon의 다음 오류로 실패했다.

```text
error creating temporary lease: read-only file system: unknown
```

두 번째 기동은 exit 1로 종료됐다. Supabase의 실제 Auth/Postgres/Storage 검증은 아직 불가능하다. 기존 다른 서비스 컨테이너에 영향을 주는 Docker 재시작·초기화·prune는 실행하지 않았다.

기존 기록과 달리 로컬 `codex-oauth-proxy` 컨테이너는 현재 healthy이며 `127.0.0.1:18741`에 바인딩되어 있다. 이는 앱의 AI 호출 성공 증거가 아니며 capability/auth 계약 확인은 남아 있다. 프로젝트에는 `.env.example`만 있고 실제 환경 파일은 없다.

## 다음 구현·검증 대상

이 목록은 기존 검증서의 전체 요구사항 매트릭스를 대체하지 않는다.

1. production chat/history/share/vote/artifact 화면을 HTTP/Supabase 저장소에 연결. 현재 채팅은 `mockChatRepository` 직접 참조가 남아 있다.
2. `/api/ai/chat`의 고정 버전 서버 조회는 후속 작업에서 구현했다(아래 참조). 실제 Supabase를 통한 소유자 성공·비소유자 거부·archive 후 snapshot 유지 검증은 남아 있다.
3. production run GET에서 완료 보상·미확정 평가의 rewardId를 복원. 이번 결과 복원 E2E는 mock 경계 증거다.
4. 턴별 목표 상태, 단계형 힌트, 교정 표시, 미션별 평가 근거 보강. 현재 mock 평가에 발화 순서만으로 목표를 완료하는 fallback이 있고, 임의 미션에도 호텔 패턴을 적용한다.
5. 프로필 관심 상황·교정 선호, 실제 학습 통계, 저장 미션, 국제화 경계 등 기존 PARTIAL/MISSING 항목 구현·E2E.
6. Docker 저장소 복구 후 실제 Supabase RLS/Storage·두 사용자 권한 검증. mock/PGlite로 대체 완료 처리하지 않는다.
7. OAuth Proxy capability와 실제 AI stream/image/speech 확인, moderation·사용량/관찰 가능성 등 남은 release gate 검증.

완료할 때는 원래 기획서의 각 ID와 실제 증거를 다시 대조한다. 현재 30개 테스트가 전체 기획을 모두 검증한다고 해석하지 않는다.

## 후속 작업: 서버 채팅 컨텍스트 경계

- 실연동 서버 모드는 `conversationId`를 요구하고 클라이언트의 character/mission/scenario 필드를 거부한다. `AI_PROVIDER=mock`만으로 인증 경계를 우회할 수 없다.
- request session의 인증 사용자와 active conversation 소유권을 확인한 뒤에만 privileged client로 게시 버전을 조회한다. 조회 ID는 대화의 고정 version ID를 사용한다.
- 기존 대화는 명시적으로 고정된 게시 버전이 있을 때 archived 캐릭터·미션을 읽을 수 있다. 새 대화 생성은 계속 published 상태만 허용한다.
- prompt에는 서버 조회 결과 중 version/instructions/steps만 전달하고, 보상 자산 정보를 전달하지 않는다. 역할·평가 지침은 플랫폼 안전 규칙보다 우선하지 않는다.
- 채팅에는 출처 검증과 인증 사용자별 rate bucket을 추가했다. 기존 process-local 한도는 유지되므로 분산 quota 검증을 완료한 것은 아니다.
- UI 요청 변환은 `widgets/chat-workspace/model/chat-request.ts`의 순수함수로 분리했다. 실연동 요청에는 대화 ID와 메시지·모델만 전달한다.

### 보안 브라우저 검증

`pnpm test:security` → 3/3 PASS (12초, production build 포함).

`playwright.security.config.ts`는 3211 포트에서 `next build`/`next start`를 사용하며 서버는 `APP_RUNTIME_MODE=development`, AI 공급자는 mock으로 실행한다. Supabase URL은 연결하지 않는 로컬 주소로 두고 로그인 세션 없이 테스트한다.

1. 브라우저에서 캐릭터/미션/scenario 주입 및 conversationId 누락 요청 → 400.
2. 브라우저에서 conversationId만 제공한 비로그인 요청 → 401.
3. 다른 출처의 요청 → 403.

이 테스트는 실제 Supabase의 소유자 성공, 다른 사용자 RLS, Storage, archived snapshot 성공을 증명하지 않는다. HTTP chat 저장소 연결과 서버 메시지 영속성 구현도 여전히 남아 있다.

출처 검사 추가 후 기존 장기 실행 개발 서버에서는 내부 `localhost`와 브라우저 `127.0.0.1` 차이로 정상 요청이 403을 반환했다. `playwright.config.ts`에 `NEXT_PUBLIC_APP_URL=baseURL`을 명시하고 이전 검사·개발 서버를 종료한 뒤 새 서버로 전체 회귀 검사를 다시 실행했다.

최종 재검증: `CI=1 pnpm test:e2e` 30/30 PASS (1.9분, retry 사용 없음), `pnpm typecheck` PASS, `pnpm lint` 오류 0·기존 warning 3, 일반 환경 `pnpm build` PASS. 별도 보안 테스트 3개와 합해 33개가 통과했으나, 실연동 저장소와 원래 기획의 남은 항목은 완료 처리하지 않는다. 이번 테스트 서버는 실행 종료 후 모두 정리됐다.

## 후속 작업: HTTP 조회 경계와 Next.js·FSD 구조 통합

### 조회 경계의 현재 구현

- 공유 화면은 실연동 모드에서 `/api/share/:token`을 조회하며 로컬 공유 데이터를 사용하지 않는다. 조회 실패에는 재시도, 404에는 없는 링크 안내를 표시한다.
- 기록 화면은 서버 조회 오류를 빈 기록으로 표시하지 않는다. 서버 conversation ID를 이어하기 URL에 유지하고, 탐색 목록에서 사라진 캐릭터의 과거 기록도 보존한다.
- 위 구현은 성공적인 실제 Supabase 조회·채팅 저장을 검증했다는 의미가 아니다. 보안 테스트는 없는 세션·없는 공유·네트워크 실패 경계를 검증한다.

### 구조 변경

- `apps/web/app/`을 `apps/web/src/app/`으로 이동했다. provider는 `app/_providers/`에서 조합하며 별도 `src/_app/`을 제거했다.
- `src/_pages/`를 제거했다. 홈·기록·프로필과 단순 화면 조합은 해당 `page.tsx`에 통합했다. 채팅은 route params를 읽고 `ChatWorkspace`를 직접 렌더링한다.
- 캐릭터·미션 상세의 클라이언트 UI는 각 라우트의 `_components/`로 옮겼다. 서버 params 처리와 클라이언트 상태 경계는 유지했다.
- API 관련 37개 파일의 이동 전후 SHA-256이 모두 동일하다. 이번 구조 변경으로 API 구현이나 URL 계약을 바꾸지 않았다.
- `components.json`의 CSS 경로와 ESLint의 상위 레이어 차단 대상을 새 경로로 수정했다. 메모리 내 ESLint 검사에서 widgets/features/entities/shared의 `@/app` import 거부와 app의 feature import 허용을 확인했다. 상대 경로 우회까지 포괄하는 전체 아키텍처 검증은 아니다.
- 프로젝트 `AGENTS.md`, README, 개발 설계서 §5와 ADR-002를 새 구조에 맞췄다. 의미 없는 Page 래퍼를 추가하지 않는 기준과 SLAP·순수성의 별도 리뷰 기준을 명시했다.
- 제거한 것은 중복 래퍼·재수출 파일과 빈 디렉터리다. 실제 화면·provider·API·favicon은 새 위치에 보존했다.

### 실행 증거

- `CI=1 pnpm test:e2e` → 31/31 PASS, 1.7분, retry 없이 통과. Chromium 데스크톱·Pixel 7·360px 미션 완료 포함.
- `pnpm typecheck` → PASS. 첫 실행은 Next 개발 서버의 타입 재생성과 동시에 실행되어 생성 파일 오류가 났고, 재생성 후 재실행에서 통과했다.
- `pnpm lint` → PASS, 오류 0·기존 img warning 3.
- `pnpm audit --prod --audit-level high` → exit 0, 알려진 취약점 없음. gitleaks는 설치되지 않아 SKIP.
- `pnpm test:db` → PGlite 계약 검사 PASS. 실제 Supabase Auth/Postgres/Storage 통합 검증을 대신하지 않는다.
- 최초 production build는 이전 `app/` 경로를 참조하는 `.next/dev/types` 때문에 실패했다. 타입 검사 설정을 완화하지 않았으며 새 Next 개발 서버가 `src/app/` 기준으로 생성 타입을 갱신했다.
- `pnpm test:security` → 6/6 PASS, 18.1초. 새 `src/app`으로 production build/start 후 실연동 서버 인증·출처 거부, 공유 조회 재시도·가짜 로컬 공유 무시, 기록 조회 오류 표시를 검증했다. 실제 Supabase 성공 경로는 포함하지 않는다.
- 보안 테스트 종료 후 일반 환경의 `pnpm build` → PASS. 컴파일·TypeScript·페이지 생성이 통과하고 기존 화면/API URL이 유지됐다. 테스트용 public 환경값이 들어간 산출물은 일반 빌드로 교체했다.
- 정적 검사 로그: `reports/static-analysis/2026-09-10-1242/`. 브라우저 HTML 결과: `apps/web/playwright-report/index.html`, `apps/web/playwright-security-report/index.html`.
- 테스트 종료 후 3210/3211 포트의 테스트 서버가 남아 있지 않음을 확인했다.

전체 목표는 계속 진행 중이다. 채팅 HTTP 생성·메시지 저장 연결, 실제 Supabase 권한·Storage 검증과 기존 기획서의 나머지 미완료 항목은 위 회귀 테스트 통과만으로 완료 처리하지 않는다.

## 후속 작업: 서버 일반 채팅 턴의 영속성

### 구현한 경계

- 신규 migration `20260910000000_chat_generation_persistence.sql`: 사용자 메시지와 pending assistant 행을 원자적으로 만들고 서버 전용 `chat_generations`에서 생성 작업을 추적한다.
- 대화 행 잠금으로 같은 대화의 중복 실행을 거부한다. 동일 메시지 키에 다른 내용을 보내면 충돌로 거부하고, 완료 응답을 다시 생성하지 않는다.
- 90초 lease가 만료되면 같은 사용자·assistant ID로 재시도할 수 있다. 새로운 request ID가 이전 작업의 늦은 완료 저장을 차단한다. 삭제된 대화나 다른 소유자의 완료도 거부한다.
- `entities/chat/api/server-generation.ts`는 검증 → 작업 확보 → 저장 기록 조회를 조합한다. 서버 전용 공개 진입점은 `entities/chat/server.ts`로 분리해 브라우저 index에 노출하지 않는다.
- `/api/ai/chat`의 실연동 일반 사용자 턴은 DB 저장 기록을 모델 입력으로 사용하고, 고정된 assistant ID와 typed parts·완료/오류/취소 상태를 저장한다. 스트림 성공 마커는 async 저장 완료 후에만 전달한다.

### 검증과 한계

- `pnpm test:db` → PASS. 6개 migration+seed 및 새 생성 계약 검증. 소유권 거부, 중복 진행 거부, 내용 충돌, lease 만료 후 동일 ID 재확보, 이전 작업 완료 거부, 실패 후 재시도, 완료 멱등성, 삭제 후 완료 거부, 브라우저 역할의 RPC/lease 접근 권한을 확인했다.
- 이 DB 검사는 PGlite 내 계약 검사다. 별도 DB 연결 간 실제 동시 경합이나 Supabase Auth/PostgREST 성공 호출을 검증한 것은 아니다. 실제 Supabase에는 새 migration을 적용하지 않았다.
- `CI=1 pnpm test:e2e` → 31/31 PASS, 1.8분. 기존 mock 브라우저 흐름의 회귀 증거다.
- `pnpm test:security` → 6/6 PASS, 17.9초. 인증·출처 차단과 HTTP 조회 오류 경계의 회귀 증거다. 저장 성공 경로의 E2E 증거가 아니다.
- `pnpm build` → PASS. 보안 테스트 이후 일반 환경 빌드를 재생성했다.
- `pnpm test:contracts` → 5/5 PASS. 저장 대기 중 finish 차단, 저장 실패 시 안전한 error 표시, 정상/빈 스트림, 취소 전달, 실제 AI SDK streamText의 고정 assistant ID·completed outcome 전달을 검증했다. 단위 테스트 스킬의 정상·경계·오류 사례 기준을 사용하되 기존 Playwright 실행기로 브라우저 없이 실행했다.
- 최종 `pnpm typecheck` → PASS, `pnpm lint` → 오류 0·기존 img warning 3.

아직 HTTP UI의 대화 생성/조회 연결을 구현하지 않았으므로 실제 사용자의 end-to-end 저장 완료로 판정하지 않는다. 현재 persisted 요청은 마지막 메시지가 user인 경우만 처리하며, 도구 승인 continuation·편집·재생성은 후속 구현 대상이다. 완료된 요청의 재시도는 409 `CHAT_RESPONSE_SAVED`를 반환하므로 HTTP UI에서 기존 메시지 조회·자동 복원까지 연결해야 한다. 이 제약을 임시 완료 기준으로 삼지 않는다.

## 후속 작업: HTTP 채팅 생성·조회·응답 복원 UI 연결

### 현재 연결한 코드

- 실연동 `ResolvedChatWorkspace`는 세션 준비 후 HTTP로 대화를 생성/조회하고 서버 UUID를 URL에 유지한다. 요청 중 화면이 바뀌면 이전 결과로 현재 대화를 덮어쓰지 않는다. 명시한 ID의 404를 새 대화 생성으로 대체하지 않는다.
- 생성 API에 선택적 UUID를 추가했다. 같은 UUID·소유자·정규화된 생성 입력이면 기존 대화를 반환하고, 다른 입력의 재사용은 거부한다. 생성 이후 메시지 조회만 실패한 경우에도 동일 생성 ID로 다시 읽는다. 이 서버 replay의 실제 PostgREST 경합 검증은 아직 없다.
- 헤더와 채팅의 익명 세션 생성은 `ensureBrowserSession`으로 in-flight 요청을 합친다. 세션 조회 실패를 로그아웃으로 오인해 새 익명 계정을 생성하지 않는다.
- HTTP 메시지 조회는 모든 cursor 페이지를 읽고, user의 clientMessageId와 DB ID를 구분해 보존한다. 오류·pending assistant를 완료된 답변처럼 복원하지 않는다.
- `planChatRetry` 순수함수는 해당 사용자 턴의 저장된 답변 복원, 같은 사용자 메시지 재전송, 다른 창의 새 턴과 충돌을 구분한다. 이전 답변만 저장된 경우 새 미저장 사용자 메시지를 버리지 않는다.
- 제목 변경, 공유 링크 생성, 단일 대화 삭제, 피드백 전송을 HTTP endpoint에 연결했다. 채팅 완료·명시적 새 대화·제목 저장·삭제 후에는 학습 snapshot 캐시를 갱신한다.
- GET conversation은 연결된 missionRunId를 복원하며, 미션 시작 시 명시된 conversation ID가 있으면 다른 대화의 active run을 재사용하지 않는다.
- 실연동 모드에서는 메시지·대화 정보를 mockChatRepository에 쓰지 않는다. Artifact 변경, 전체 삭제, 메시지 초기화의 미연결 동작은 저장 성공으로 표시하지 않고 안내한다. 이 안내는 최종 구현을 대신하지 않는다.

### 검증 범위

- `pnpm test:contracts` → 20/20 PASS. HTTP 저장소 7개, 인증 준비 3개, 재시도 판단 5개, 기존 스트림 계약 5개.
- HTTP 저장소 계약 테스트는 주입한 fetch 응답을 사용한 Node 검사다. 실제 서버·브라우저·Supabase 성공 경로를 통과한 검사가 아니다. 브라우저 happy path의 앱 API 전체를 page.route로 대체하지 않았다.
- `pnpm test:security` → 6/6 PASS, 20.2초. 실연동 서버 모드의 인증·출처·조회 오류 경계를 재검증했다.
- `pnpm typecheck` PASS, `pnpm lint` 오류 0·기존 img warning 3.
- 최종 코드 기준 `CI=1 pnpm test:e2e` → 31/31 PASS, 1.7분, retry 없이 통과. 앞선 작업 중 실행과 별도로 최종 재검증했다.
- `pnpm test:db` → PGlite 계약 PASS. `pnpm build` → 일반 환경 컴파일·TypeScript·페이지 생성 PASS. 테스트용 public 설정이 들어간 보안 빌드는 일반 빌드로 교체했다.
- 실행 종료 후 3210/3211의 테스트 서버가 남아 있지 않음을 확인했다.

### 아직 완료하지 않은 부분

실제 Supabase에서 대화 생성 → AI 응답 → reload → 소유권 분리 E2E가 필요하다. 도구 승인 continuation, 메시지 편집·재생성 분기, 파일 Storage 연결, Artifact 저장, 전체 삭제/초기화, 피드백 조회 복원, draft·모델 선택 영속성, archived 캐릭터의 고정 버전 UI 복원은 남아 있다. 기존 원래 기획서의 다른 PARTIAL/MISSING 항목도 유지한다. 전체 목표는 진행 중이다.

## 후속 작업: src/app 이동에 따른 Proxy 진입점 수정

- 현재 파일 확인에서 `apps/web/proxy.ts`가 이전 위치에 남은 것을 발견했다. 설치된 Next.js 16.3.4의 `src-folder.md`와 `proxy.md` 규약에 따라 `apps/web/src/proxy.ts`로 이동했다. 세션 갱신 로직과 matcher는 보존했다.
- `tests/security/proxy-build.spec.ts`를 추가했다. production 빌드의 `functions-config-manifest.json`에서 Node Proxy 등록을 확인하고, 화면·인증 API·대화 API 포함 및 Next 정적 자산·이미지 제외를 검사한다. 이는 빌드 등록 검사이며 브라우저 테스트나 실제 Supabase 토큰 갱신 성공으로 계산하지 않는다. Node Proxy는 edge middleware manifest의 빈 목록만으로 미등록이라고 판단하지 않는다.
- 개발 지침과 설계서에 Proxy의 위치 규칙을 추가했다. README에는 `apps/web/.env.local` 설정 위치와 명시적 mock 개발 명령을 안내했다. 실연동 설정 누락 시 인증 경계를 mock으로 우회하지 않는다.
- `pnpm test:security` → 7/7 PASS, 17.5초. 기존 브라우저 기반 인증·조회 오류 검사 6개 + 빌드 등록 검사 1개다.
- `CI=1 pnpm test:e2e` → 31/31 PASS, 1.7분, retry 없이 통과. Chromium 데스크톱·Pixel 7·360px 화면을 포함한 mock 흐름 회귀 증거다.
- `pnpm typecheck` PASS. `pnpm lint` 오류 0·기존 img warning 3. `pnpm audit --prod --audit-level high` PASS, 알려진 취약점 없음. gitleaks는 미설치로 SKIP. 로그는 `reports/static-analysis/2026-09-10-proxy/`에 보존했다.
- 보안 검사 후 일반 `pnpm build` PASS, 출력에 `ƒ Proxy (Middleware)`를 확인했다. 3210/3211의 테스트 서버가 남지 않았음을 확인했다.
- 이번 수정은 Next.js 구조 변경의 누락을 해결한 것이며, 위의 Artifact HTTP 저장 등 미완료 요구사항과 실제 Supabase 성공 E2E는 여전히 남아 있다. 전체 목표는 완료 처리하지 않는다.

## 후속 작업: Artifact HTTP 편집기 연결

### 구현한 연결

- `entities/chat/api/http-artifact-repository.ts`: 대화별 목록·저장 버전 조회, 생성, 제목 수정, 새 버전 저장, 저장 후 재조회. `artifactFromHttp`는 버전 정렬·모델 변환을 입력 변경 없이 수행하며 잘못 연결된 버전을 거부한다.
- `RemoteArtifactWorkspace`는 실제 HTTP 모드에서 기존 공통 편집기를 사용한다. 조회 실패를 빈 목록으로 바꾸지 않고 재시도를 제공한다. 채팅의 Artifact 열기와 `/artifact` 명령이 이 화면으로 연결된다. mock UI는 기존 저장소를 유지한다.
- 원격 자동 저장은 변경된 내용을 draft 버전으로 추가한다. 새 버전 저장·과거 버전 복원·생성 이미지 저장도 기존 API에 연결했다. 서버 저장과 재조회 후에만 저장 완료 상태로 전환한다.
- 원격 요청 중 중복 조작을 막고 실패한 초안을 유지한다. 실패 표시와 저장 재시도, 저장 전 닫기 확인, beforeunload 경고를 제공한다. 경고를 무시하고 닫은 미저장 초안의 복원을 보장하지 않는다.
- 자동 저장 재시도 시 이미 같은 내용이 서버에 저장되어 있으면 추가 버전을 만들지 않는다. 이 비교는 서버 동시성·멱등성 계약을 대신하지 않는다.

### 검증

- 단위 테스트 스킬의 정상·경계·실패 기준을 기존 Playwright Node 계약 검사에 적용했다. `pnpm test:contracts` → 27/27 PASS, 신규 Artifact 검사 7개 포함. 주입한 fetch 응답에 대한 검사이며 실제 Supabase 성공 증거가 아니다.
- 최초 테스트 코드의 nullable 타입 오류 2개를 수정한 뒤 `pnpm typecheck` PASS. `pnpm lint` 오류 0·기존 img warning 3.
- `CI=1 pnpm test:e2e` → 31/31 PASS, 1.8분, retry 없이 통과. 기존 mock의 네 종류 Artifact 편집·버전 동작과 전체 사용자 흐름 회귀를 검증했다. HTTP Artifact 성공·실패 UI의 실제 브라우저 증거는 아직 없다.
- `pnpm test:security` → 7/7 PASS, 19.0초. 기존 인증 경계 6개와 Proxy 빌드 검사 1개다.
- 보안 검사 이후 일반 `pnpm build` PASS, Proxy 포함. 실행 종료 후 3210/3211 서버가 남지 않았음을 확인했다.

### 남은 서버 계약과 검증

제목 PATCH와 버전 POST를 하나의 원자적 저장으로 묶고 expected-version 충돌 검사 및 생성 요청 멱등성을 구현해야 한다. 현재 다중 창 편집은 충돌을 차단하지 않으며, 생성 응답 유실 후 재생성은 중복 Artifact를 만들 수 있다. 이미지 URL은 version JSON에 보존하지만 대용량 이미지 Storage·서명 URL 복원과 대량 버전 페이지 조회는 별도 보강이 필요하다. 실제 Supabase에서 생성 → 편집 → 저장 실패 → 재시도 → reload → 소유권 분리 E2E를 검증하기 전까지 REF-24~30은 PARTIAL이다. 전체 완성 목표는 계속 진행 중이다.

## 후속 작업: Artifact 원자적 revision 저장·멱등성·충돌 방지

- 신규 `20260910010000_artifact_revision_commit.sql`에 서버 전용 `artifact_revision_requests`와 `commit_artifact_revision`을 추가했다. 대화 → Artifact 순서로 잠그고 owner·active 상태를 확인한다. 제목 변경과 버전 추가가 같은 트랜잭션에서 실행되며 버전 검증 실패 시 제목도 롤백한다.
- POST `/api/artifacts`는 필수 UUID `requestId`를 Artifact·첫 버전 식별자로 사용한다. POST `/api/artifacts/:id/versions`는 `requestId`와 `expectedVersionId`를 필수로 받고 선택적 title과 content를 한 번에 저장한다. 기존 관리 PATCH와 새 편집 revision 경로는 구분한다.
- 같은 requestId·같은 입력은 기존 버전을 반환한다. 다른 입력이나 다른 기준 버전의 키 재사용, 오래된 기준 버전의 새 저장은 409로 거부한다. archived Artifact와 active가 아닌 대화에도 저장하지 않는다.
- HTTP 저장소는 응답 유실 시 생성·저장 요청 키를 메모리에 유지해 같은 입력의 재시도에 재사용한다. 완료 후 키를 해제한다. 편집기의 원래 기준 버전을 전달하고 GET 결과로 기준 버전을 자동 교체하지 않는다. 저장 후 다른 버전이 추가된 경우에도 충돌을 알려 초안을 유지한다.
- `pnpm test:db` → 7개 migration+seed 및 PGlite 계약 PASS. 롤백, 재시도, 키 재사용 거부, stale 버전, owner 거부, archived/deleted 상태, 브라우저 역할의 RPC·replay 테이블 접근 거부를 확인했다. 실제 Supabase migration 적용과 별도 연결 간 경합 검증은 아직 수행하지 않았다.
- `pnpm test:contracts` → 30/30 PASS. Artifact 계약 10개에 생성·저장 응답 유실 시 동일 키, stale 기준 버전 거부를 포함했다. 주입 fetch 기반 Node 검사이며 실제 서버 성공 경로가 아니다.
- 최종 `pnpm typecheck` PASS. `pnpm lint` 오류 0·기존 img warning 3.
- `CI=1 pnpm test:e2e` → 31/31 PASS, 1.8분, retry 없이 통과. 기존 mock 사용자 흐름 회귀 검사다.
- `pnpm test:security` → 8/8 PASS, 19.6초. 새 Artifact 인증·필수 키·cross-site 거부 브라우저 검사 1개를 추가했다. 기존 6개 브라우저 검사와 Proxy 빌드 등록 검사 1개를 포함한다.
- 보안 검사 후 일반 `pnpm build` PASS, Proxy 포함. 3210/3211 테스트 서버가 남아 있지 않음을 확인했다.

UI의 HTTP 저장 성공·충돌 복구를 실제 Supabase 브라우저에서 검증하는 일, 이미지 Storage·서명 URL 복원, 대량 목록/버전 페이지 조회는 남아 있다. 이전 절의 원자성·revision 충돌·생성 키 부재는 이번 코드로 보강했지만, 실제 동시 접속 성공과 나머지 REF 요구사항까지 완료된 것으로 판단하지 않는다. 전체 목표는 진행 중이다.

## 후속 작업: Artifact 비공개 이미지 Storage

### 환경 재확인

- 전역 `supabase` 명령은 PATH에 없었다. 프로젝트의 `pnpm supabase:status`는 DB 컨테이너가 없음을 확인했다.
- 기존 임시 Docker 설정을 사용하는 `pnpm supabase:start`도 재검증했다. ECR/GHCR/Docker Hub 시도 모두 Docker daemon의 `error creating temporary lease: read-only file system`으로 종료 코드 1을 반환했다. 실제 Supabase 성공 E2E는 아직 실행할 수 없다.
- 다른 Docker 서비스는 재시작·삭제하지 않았다. Docker Desktop 재시작 가능 여부는 사용자에게 비동기로 문의했다. 코드 구현은 계속 가능하므로 전체 목표를 blocked로 전환하지 않았다.

### 구현

- `20260910020000_artifact_image_storage.sql`: 비공개 `artifact-images` 버킷. 기존 브라우저 Storage 정책에 이 버킷을 추가하지 않아 직접 읽기·업로드·덮어쓰기·삭제를 허용하지 않는다.
- 소유자·image Artifact·active 대화를 확인하는 업로드 API를 추가했다. 10 MB 이하 JPEG/PNG/WebP/AVIF와 파일 서명을 검사하며 내용 SHA-256 기반 경로로 upsert 없이 저장한다. 재업로드의 duplicate/409/already-exists 응답은 같은 객체의 재사용으로 처리한다.
- DB revision은 owner/Artifact 경로와 객체 존재를 검증한다. image kind의 새 revision에서 JSON imageUrl과 수정 가능한 chat-attachments 참조는 거부한다. 이전 데이터 전체를 변환하는 migration은 수행하지 않았다.
- 저장소는 새 data URL을 업로드한 뒤 bucket/path만 revision에 저장한다. 업로드 후 revision 응답이 유실되면 같은 경로와 requestId로 재시도한다. 기존 Storage 이미지 복원도 재업로드하지 않는다.
- 이미지 src는 Artifact·버전 소유권 확인 API이며, 조회 시 300초 signed URL로 no-store redirect한다. 만료되는 URL을 버전 JSON에 저장하지 않는다.
- 이미지가 없던 버전 복원 시 현재 이미지가 남던 기본 인자 문제도 수정했다. 브라우저 회귀 시나리오에 이미지 없음/있음 버전의 왕복 복원을 추가했다. 테스트 삽입 위치를 바로잡는 과정의 중단 실행은 PASS로 집계하지 않는다.

### 현재 검사 증거

- `pnpm test:db` → 8개 migration+seed와 PGlite 계약 PASS. private bucket, owner/Artifact 경로, 객체 존재, 외부 URL 참조 거부, 브라우저 역할의 Storage 읽기·쓰기·수정·삭제 차단을 검사했다. 실제 Storage API 업로드 성공 검사는 아니다.
- `pnpm test:contracts` → 36/36 PASS. 이미지 업로드 후 응답 유실 재시도, 경로 참조 복원, 외부 URL 거부, raster signature, Storage 중복 오류 분류를 포함한다. fetch 주입 기반 Node 검사다.
- `pnpm test:security` → 9/9 PASS, 19.9초. 신규 이미지 upload/read의 401·cross-site 403과 redirect 비노출을 검사한다. 이 중 1개는 Proxy 빌드 등록 검사다.
- 최종 `pnpm typecheck` PASS. `pnpm lint` 오류 0·기존 img warning 3. `pnpm audit --prod --audit-level high` PASS, 알려진 취약점 없음. gitleaks는 미설치로 SKIP. 로그: `reports/static-analysis/2026-09-10-artifact-images/`.
- 최종 `CI=1 pnpm test:e2e` → 31/31 PASS, 3.2분, retry 없이 통과. 이미지 없는 버전 복원 → 생성 이미지 버전 복원 시나리오를 포함한다. 시작 대기 중에는 중단된 이전 실행의 잔여 테스트 서버 PID를 확인해 그 프로세스만 종료했고, 현재 테스트 핸들은 재시작하지 않고 계속 관찰했다.
- 최종 일반 `pnpm build` PASS, 신규 이미지 API 2개와 Proxy 등록을 확인했다. 3210/3211 테스트 서버는 남아 있지 않다.

실제 Supabase Storage 업로드·재조회·만료 후 재발급·다른 사용자 거부 E2E, 미사용 업로드 객체 정리와 용량 quota, 대량 목록/버전 페이지 조회는 남아 있다. 전체 목표는 계속 진행 중이다.

## 후속 작업: Artifact 페이지 조회 검증 마무리

- 목록 API는 ID cursor와 look-ahead로 페이지를 반환한다. HTTP 저장소는 모든 페이지를 수집하고 상세 요청을 최대 4개씩 실행한 뒤 최근 수정 순으로 표시한다. 목록 전체의 단일 DB snapshot을 보장하지 않으므로 조회 중 추가된 항목은 재조회가 필요할 수 있다.
- 버전 조회는 첫 응답의 currentVersionId를 snapshotVersionId로 고정한다. 이후 페이지도 같은 Artifact의 해당 버전까지만 조회하며 매 요청 소유권을 확인한다. 반복 cursor, 중복 버전, 변경된 snapshot, 중간 요청 실패를 조용히 부분 성공으로 바꾸지 않는다.
- 1,005개 버전의 11페이지 복원과 실패 경계를 포함한 `pnpm test:contracts`를 다시 실행했다: 44/44 PASS, 732 ms. 주입 fetch 기반 계약 검사이며 실제 Supabase 페이지 응답의 성공 증거는 아니다.
- 기존 실행 핸들 1524는 더 이상 존재하지 않았다. 검사를 재시작하지 않고 HTML 보고서 내 report.json을 읽어 종료 결과를 확인했다. `playwright-security-report`: 10/10 expected, unexpected/flaky/skipped 0, 20.2초. 이 중 Proxy 등록 검사 1개를 제외한 9개는 브라우저 보안 경계 검사다.
- 같은 방식으로 `playwright-report`의 실제 종료 결과를 확인했다: 31/31 expected, unexpected/flaky/skipped 0, 107.6초. mock 사용자 흐름의 Chromium 브라우저 회귀 결과이며 실제 Supabase 성공 E2E와 구분한다. 이번 검증 마무리 턴에서는 브라우저 검사를 새로 실행하지 않았다.
- 보안 테스트용 빌드를 교체하는 일반 `pnpm build`를 새로 실행해 종료 코드 0과 Proxy 등록을 확인했다. 3210/3211 포트에 남은 테스트 서버는 없다.
- `pnpm supabase:status` 재확인 결과 종료 코드 1, `supabase_db_character-english-ai` 컨테이너 없음. 이번에는 Docker 재시작·삭제나 이미지 pull을 수행하지 않았다. 과거 read-only 오류의 해소 여부 자체는 이 status 검사로 입증되지 않는다.

전체 완료 판정은 보류한다. 실제 Supabase 인증·저장·Storage·교차 소유권 성공/거부 E2E가 남아 있고, REF-07/19의 HTTP `/clear`·`/purge`, REF-16의 실제 메시지 분기 편집 등 미완료 기능도 남아 있다. 다음 구현은 이 핵심 채팅 기능으로 돌아간다. 과거 mock 기준 VERIFIED 표기를 실제 연동 완료로 확대하지 않는다.

## 후속 작업: HTTP 전체 대화 삭제 연결

- `20260910030000_purge_owned_conversations.sql`은 owner별 purge 요청 기록과 서버 전용 RPC를 추가한다. 정렬된 본인 대화 행을 잠근 뒤 기존 purge 함수를 같은 트랜잭션에서 호출한다. active/archived/deleted 대화가 대상이며 연결된 DB 행은 기존 FK 삭제 정책을 따른다. Storage 객체의 물리 삭제는 포함하지 않는다.
- DELETE `/api/conversations`는 정확한 `DELETE ALL` 확인 문구와 UUID requestId를 요구한다. owner를 body로 받지 않고 인증 세션에서 가져오며, 알 수 없는 필드와 cross-site mutation을 거부한다.
- HTTP `/purge` 확인창이 이 API를 호출한다. 처리 중 중복 삭제·메시지 전송을 차단하고 서버 성공 후에만 현재 화면을 종료한다. 실패 시 확인창 내부에 오류를 표시하고 기존 화면·요청 키를 보존한다. 요청 키는 현재 컴포넌트 메모리에 있으므로 reload 이후 동일 키 복구는 아직 보장하지 않는다.
- 응답 유실 재시도는 같은 키로 이전 결과를 받는다. DB 계약에서 purge 후 만든 새 대화가 이전 키 재시도로 삭제되지 않는 것, 새 키로는 삭제되는 것, 빈 목록 결과 0, 다른 소유자의 대화 보존, 브라우저 RPC 실행 권한 없음도 확인했다.
- `pnpm test:db`: 9개 migration+seed 및 PGlite 계약 PASS. 확장 테스트 fixture에 model_id가 빠진 중간 실패를 수정한 후 재실행했다. 실제 PostgREST 성공·독립 DB 연결 경합 검증은 아니다.
- `pnpm test:contracts`: 45/45 PASS, 800 ms. 확인 문구 없는 요청 차단과 오류 후 동일 요청 키 전송을 추가했다. 주입 fetch 기반 검사다.
- 최종 `pnpm typecheck` PASS, `pnpm lint` 오류 0·기존 img warning 3.
- `CI=1 pnpm test:e2e`: 30 passed + 1 flaky, 2.1분. 전체 31개 중 shell-theme 단축키 시나리오가 첫 실행에서 URL 변경 없이 실패하고 retry에서 통과했다. 개별/전체 삭제 확인과 기록 반영 시나리오는 통과했다. 이 실행을 retry 없는 전체 PASS로 표기하지 않는다.
- 실패 screenshot과 error-context를 확인했다. 테마 class만 확인한 직후 키를 누르며, 키 listener는 AppShell의 useEffect에서 등록된다. hydration 준비 시점 경합이 후보이지만 타임라인으로 확정하지 않았고 해당 코드는 이번에 수정하지 않았다. 실패 산출물은 `apps/web/test-results/shell-theme-App-shell-and--1ab81-s-a-unique-chat-by-keyboard-chromium/`에 있다.
- `pnpm test:security`: 11/11 PASS, 21.6초. 새 전체 삭제 endpoint의 확인 문구·요청 키·추가 owner 필드 거부, unauthenticated 401, cross-site 403을 실제 브라우저 요청으로 확인했다. Proxy 빌드 검사 1개를 포함한다.
- 보안 검사 이후 일반 `pnpm build` 종료 코드 0, Proxy 등록을 확인했다. 3210/3211 테스트 서버는 남아 있지 않다.

실제 사용자 데이터는 삭제하지 않았다. DB 검사는 임시 PGlite, 브라우저 삭제 성공 검사는 mock 데이터를 사용한다. 실제 Supabase 삭제 성공·Storage 정리, HTTP `/clear`, 메시지 분기 편집과 단축키 flaky 해결이 남아 있으므로 전체 목표는 진행 중이다.

## 후속 작업: 새로고침 단축키 검사의 준비 시점 명시

- AppShell에 실제 keydown listener 등록/해제와 함께 변경되는 `data-shortcuts-ready`를 추가했다. React state를 복제하지 않고 Effect의 DOM 동기화 경계에서 표시한다.
- 기존 검사는 reload 후 html.dark만 확인하고 즉시 키를 눌렀다. 수정한 검사는 JS chunk 로딩을 Promise로 보류해 dark=true와 shortcuts-ready=false가 함께 존재하는 상태를 실제 Chromium에서 확인한 뒤, JS를 해제하고 listener 준비를 기다린다. 이후 단 한 번의 키 입력으로 기존 URL 전환 요구사항을 검증한다.
- 이 변경은 테스트의 준비 조건을 바로잡는 것이다. hydration 이전 키 입력을 큐에 넣거나 재생하는 기능은 추가하지 않았다. 테마 표시가 listener 준비를 보장하지 않는 경합은 재현했지만, 과거 실패의 정확한 입력 시점은 과거 trace로 확정하지 않았다.
- `CI=1 pnpm test:e2e --project=chromium shell-theme.spec.ts --repeat-each=5 --retries=0`: 5/5 PASS, 21.9초.
- `CI=1 pnpm test:e2e --retries=0`: 31/31 PASS, 1.7분. desktop Chromium·Pixel 7 전체 회귀가 retry 없이 통과했다. 이번 suite도 mock 데이터/AI를 쓰므로 실제 Supabase 성공 검증을 대신하지 않는다.
- `pnpm typecheck` PASS, `pnpm lint` 오류 0·기존 img warning 3. 브라우저 스킬의 상태 기반 대기·실제 동작 검증 기준을 적용했으며 sleep이나 기대 결과 완화는 추가하지 않았다.
- 최종 `pnpm build` PASS, Proxy 등록 확인. 3210/3211 포트에 남은 테스트 서버 없음.

HTTP `/clear`, 실제 메시지 분기 편집, 실제 Supabase 인증·저장·Storage E2E 등 전체 요구사항은 여전히 남아 있다. 전체 목표 완료로 판정하지 않는다.

## 후속 작업: HTTP 메시지 초기화 연결

- `20260910040000_clear_conversation_messages.sql`과 DELETE `/api/conversations/:id/messages`를 추가했다. 활성 대화 소유자, UUID 요청 키, `CLEAR MESSAGES` 확인을 요구한다. 대화 행 잠금 아래 메시지를 삭제하고 last_message_at을 초기화하며, 기존 FK 정책으로 메시지 평가·첨부 metadata·생성 상태 등 종속 행을 제거한다.
- 대화 ID·제목·Artifact 내용/버전·미션 진행/결과는 유지한다. published Artifact의 source_message_id는 FK에 의해 null이 되도록 서버 트랜잭션에서만 불변성 예외를 사용하고 이전 설정을 복원한다. 삭제 뒤 게시 내용 변경이 다시 거부되는 것을 DB 검사로 확인했다. 미션 evidence ID의 삭제된 원문 조회는 보장하지 않는다.
- 유효한 running generation lease는 409로 초기화를 거부한다. 만료된 generation을 초기화한 뒤 늦게 도착한 finish는 stale로 거부해 삭제된 답변이 되살아나지 않는다.
- 같은 요청 키 재시도는 이전 삭제 수를 반환하고 이후 새 메시지를 삭제하지 않는다. HTTP 저장소는 성공 후 메시지를 재조회한다. UI는 재조회 성공까지 키와 기존 화면을 보존하고, 성공 후 메시지·vote·pending·편집/첨부 입력 상태를 갱신한다. 요청 키의 reload 복원은 아직 없다.
- mock과 HTTP 모두 `/clear` 확인창을 사용한다. 삭제 범위와 유지되는 데이터를 설명하며 취소는 메시지를 변경하지 않는다. 처리 중 중복 실행을 차단하고 오류는 확인창에 표시한다.
- `pnpm test:db`: 10개 migration+seed와 PGlite 계약 PASS. 소유자/archived/생성 중 거부, published 내용 보존과 source 참조 해제, 만료 생성의 늦은 finish 거부, 재시도 후 새 메시지 보존, 빈 초기화, RPC 권한을 포함한다. 실제 Supabase migration 적용·독립 연결 경합 검증은 아니다.
- `pnpm test:contracts`: 47/47 PASS, 831 ms. 초기화 후 readback 실패 시 동일 키 재시도와 이후 메시지 반영, mutation 거부 후 GET 미실행을 추가했다. 주입 fetch 기반 검사다.
- `pnpm typecheck` PASS, `pnpm lint` 오류 0·기존 img warning 3.
- `CI=1 pnpm test:e2e --retries=0`: 31/31 PASS, 1.8분. 초기화 취소→메시지 유지, 확인→초기화, reload→동일 대화 ID/제목 유지와 메시지 제거를 기존 management 시나리오에 추가했다. mock Chromium/Pixel 회귀이며 HTTP 초기화 성공 UI의 실제 Supabase 증거는 아니다.
- `pnpm test:security`: 12/12 PASS, 20.5초. 초기화 API의 unauthenticated 401, 확인/UUID/추가 owner 필드 validation 400, cross-site 403을 실제 브라우저 요청으로 확인했다. Proxy 빌드 검사 1개를 포함한다.
- `pnpm supabase:status` 재확인은 종료 코드 1, `supabase_db_character-english-ai` 컨테이너 없음. 이번 턴에서는 Docker 설정·다른 컨테이너를 변경하지 않았다.
- 보안 검사 이후 일반 `pnpm build` PASS, Proxy 등록 확인. 3210/3211 테스트 서버 없음.

실제 사용자 데이터는 삭제하지 않았다. HTTP 초기화의 실제 Supabase 성공과 소유권 E2E, Storage 파일 정리, 메시지 분기 편집·재생성 등은 남아 있다. 단위 테스트 스킬의 경계/실패 사례와 브라우저 스킬의 실제 사용자 동작 검증 기준을 적용했으며 전체 완성 목표는 진행 중이다.

## 후속 작업: 메시지 분기 교체 서버 계약

- 기존 PATCH는 사용자 메시지를 추가하기만 하고 원래 분기의 후속 메시지를 제거하지 않았다. `20260910050000_replace_message_branch.sql`로 수정 지점부터의 삭제와 새 사용자 메시지 저장을 한 트랜잭션으로 교체했다.
- owner·active 상태, 편집 당시 tail UUID, live generation 부재를 검증한다. 원래 사용자 메시지와 이후 답변·후속 사용자 메시지는 제거하고 이전 대화는 유지한다. Artifact 내용은 남기며 삭제된 source 참조는 기존 초기화 정책과 같은 범위에서 해제한다.
- 새 메시지의 DB ID/clientMessageId는 requestId다. 같은 키·같은 원본/tail/parts 재시도는 기존 결과를 반환하고 다른 입력의 키 재사용은 409다. 새 메시지가 이후 분기 교체로 삭제되면 receipt도 제거되므로 오래된 원본을 재생성하지 않는다.
- API는 requestId·expectedTailId·parts를 필수로 받고 인증된 owner만 RPC에 전달한다. RPC 뒤 재조회 시 이미 메시지가 없어졌다면 409로 반환한다. HTTP 저장소에 replaceMessageBranch 메서드를 추가했다.
- `pnpm test:db`: 11개 migration+seed 및 PGlite 계약 PASS. live generation·owner·stale tail 거부, 삭제 후 PK 충돌에 대한 전체 롤백, 앞 대화 보존·뒤 분기 제거, 키 재시도/재사용 거부, 편집 메시지로 begin→finish→replay 연결과 권한을 검사했다. 실제 독립 DB 연결 경합·Supabase 성공 증거는 아니다.
- `pnpm test:contracts`: 48/48 PASS, 816 ms. branch PATCH의 경로·필수 입력, 충돌 뒤 원래 tail/키 유지 검사를 추가했다. 주입 fetch 기반 검사다.
- `pnpm typecheck` PASS, `pnpm lint` 오류 0·기존 img warning 3.
- `pnpm test:security`: 13/13 PASS, 23.2초. branch 요청의 필수 키 validation, 추가 owner 필드 거부, unauthenticated 401, cross-site 403을 브라우저 요청으로 검증했다. Proxy 빌드 검사 1개를 포함한다.
- 이번 턴에서는 mock 전체 E2E를 재실행하지 않았다. UI 코드는 변경하지 않았으며 직전 턴의 31/31 결과를 이번 서버 편집 성공의 증거로 사용하지 않는다.
- 보안 검사 뒤 일반 `pnpm build` PASS, Proxy 등록 확인. 3210/3211 테스트 서버 없음.

아직 UI가 이 분기 메서드를 호출하지 않는다. 편집 시작 시 DB 식별자와 tail을 보존하고, 서버 교체 성공 후 동일 사용자 키로 AI 생성에 연결하는 작업, 별도 답변 재생성, 실제 Supabase 성공 E2E가 남아 있다. 전체 목표는 진행 중이다.

## 후속 작업: HTTP 메시지 편집 UI 연결

- 편집 시작 시 HTTP 메시지를 조회하고 화면과 저장된 메시지 ID/역할 목록, 선택한 사용자 원문이 일치하는지 확인한다. DB source UUID와 당시 tail UUID를 보존한다. pending 응답 또는 다른 화면 상태를 자동으로 최신 기준으로 바꿔 덮어쓰지 않는다.
- 편집 제출은 PATCH 분기 교체→서버 메시지 재조회→해당 사용자 턴의 후속 생성/기존 답변 복원 순서다. 교체 메시지의 DB/client ID가 요청 키와 같은지 확인하고, 같은 키·저장된 parts를 AI SDK에 전달한다. 이미 완료된 답변이 있으면 생성하지 않고 복원한다.
- 같은 정규화 입력의 재시도는 원래 요청 키를 유지한다. 입력을 바꾸면 새 키를 사용하지만 원래 source/tail은 고정하므로, 이전 저장이 이미 반영됐다면 충돌/없음으로 거부되고 새 분기를 자동 덮어쓰지 않는다. 이 경우 현재 대화를 다시 불러와야 한다.
- 저장/재조회 실패는 편집 상태와 입력을 보존한다. 요청을 시도한 뒤 취소하면 원래 로컬 분기를 무조건 복원하지 않고 서버를 다시 조회한다. 저장된 미완료 사용자 메시지는 명시적인 답변 이어받기 버튼으로 재개할 수 있다. 요청 키와 편집 draft의 reload 복원은 아직 보장하지 않는다.
- 원격 편집 시작만으로 기존 음성 캐시를 무효화하지 않는다. 실제 분기 삭제는 서버 FK 정책을 따르고, UI vote도 유지되는 메시지의 값만 남긴다. 편집 중 slash로 시작하는 수정 내용은 관리 명령이 아니라 메시지로 처리한다.
- `remote-edit.ts`의 기준 캡처·허용된 text/file 필드 정규화·요청 키 선택·후속 생성 판단을 순수함수로 분리했다. `pnpm test:contracts`: 53/53 PASS, 1.0초. 신규 5개 검사에 stale/pending/없는 원본/변경된 원문, 표시 전용 필드 제거, 동일 키 재시도, 완료 답변 복원과 사라진 편집 턴 거부를 포함한다.
- `CI=1 pnpm test:e2e --retries=0`: 31/31 PASS, 1.8분. 기존 mock 편집/취소/분기와 전체 Chromium/Pixel 회귀 결과다. 새 HTTP 편집 성공 UI의 실제 Supabase E2E 증거는 아니다.
- 타입 검사와 린트는 오류 없이 통과했다(기존 img warning 3). SQL migration이나 서버 mutation 계약은 이번 턴에서 변경하지 않았다.
- `pnpm test:security`: 13/13 PASS, 20.2초. 기존 인증/CSRF/필수 입력/Proxy 경계 회귀이며 실제 Supabase 편집 성공의 증거는 아니다.
- 최종 lint 오류 0·기존 warning 3, 일반 `pnpm build` PASS(타입 검사와 Proxy 등록 포함). 3210/3211 잔여 서버 없음. 마지막 원격 vote 보존 보정은 빌드/린트로 확인했으며 해당 HTTP 성공 경로의 브라우저 검증은 여전히 미완료다.

별도 답변 재생성의 서버 연결, 실제 Supabase에서 편집→저장 실패→재시도→생성→reload→충돌/취소 복구 E2E, 원격 첨부/Storage와 기타 전체 요구사항은 남아 있다. 전체 목표는 진행 중이다.

## 후속 작업: 마지막 답변 재생성 연결과 검증

- `20260910060000_prepare_response_regeneration.sql`과 POST `/api/conversations/:id/messages/:messageId/regenerate`를 추가했다. 활성 대화 소유자의 마지막 완료 assistant만 재생성 준비 대상으로 허용하며, 유효한 생성 lease가 있으면 거부한다. 원래 사용자 메시지 ID·내용은 보존한다.
- 준비 요청은 별도 UUID 요청 키로 멱등 처리한다. 재시도는 이미 만들어진 후속 답변을 다시 삭제하지 않는다. 원래 사용자 clientMessageId가 없는 legacy 행에는 DB ID 기반 키를 부여한다. 새 AI 요청은 준비 요청 키가 아니라 원래 사용자 키와 서버에 저장된 parts를 사용한다.
- UI는 준비 POST→메시지 재조회→이미 완료된 답변 복원 또는 동일 사용자 턴 생성 순서로 연결했다. 처리 중 중복 실행과 과거 답변 버튼을 차단한다. 준비/재조회 실패 시 기존 화면과 요청 키를 유지한다. 키는 메모리에 있으므로 reload를 넘는 준비 요청 키 보존까지 구현했다고 주장하지 않는다.
- 삭제된 답변의 늦은 finish는 거부한다. 연결된 published Artifact 내용은 유지하고 source 메시지 참조만 해제한다. 실제 Storage 객체 정리와 다중 assistant/tool continuation 정책은 별도 검증이 필요하다.
- `pnpm test:db`: 12개 migration+seed 및 PGlite 계약 PASS. 사용자 ID/parts 보존, owner/archived/live generation/과거 답변/불완료 사용자 거부, 같은 키 재시도 후 새 답변 보존, legacy 키 생성, published Artifact 내용 보존, 늦은 finish와 RPC 권한을 검사했다. 실제 Supabase 및 독립 연결 경합 검사는 아니다.
- `pnpm test:contracts`: 54/54 PASS, 828 ms. 재생성 HTTP 경로·요청 키 및 실패 후 같은 키 재시도 계약을 포함한다.
- 기존 Playwright 실행 핸들을 이어 확인했다. `CI=1 pnpm test:e2e --retries=0`: 32/32 PASS, 1.8분. 새 시나리오는 실제 Chromium에서 재생성 버튼→AI 응답 완료→사용자 메시지 무중복→reload 후 메시지 수와 원문 보존을 검증한다. 이 suite는 mock 데이터/AI를 쓰므로 HTTP 재생성의 실제 Supabase 성공 증거가 아니다.
- `pnpm test:security`: 14/14 PASS, 24.1초. 재생성 API의 인증 401, 요청 키/추가 owner/잘못된 route validation 400, cross-site 403과 기존 경계를 검증했다. Proxy 등록 검사 1개를 포함한다.
- `pnpm typecheck`, `pnpm lint`, `pnpm audit --prod --audit-level=high` PASS. 린트 오류 0·기존 img warning 3, 알려진 의존성 취약점 없음. gitleaks는 설치되지 않아 SKIP이다. 로그와 판정은 `reports/static-analysis/2026-09-10-response-regeneration/`에 보존했다.
- 보안 검사 이후 일반 `pnpm build` PASS. 재생성 API와 Proxy 등록을 확인했다.
- `pnpm supabase:status`는 DB 컨테이너 없음으로 실패했다. 이번 확인만으로 과거 Docker read-only 오류가 계속된다고 단정하지 않으며, Docker 재시작이나 다른 서비스 변경은 수행하지 않았다.

브라우저 스킬의 실제 동작·상태 기반 대기와 정적 분석 스킬의 검사별 판정/로그 보존을 적용했다. 전체 목표는 진행 중이다. 실제 Supabase 인증·저장·Storage E2E, 원격 첨부·모델/초안 복원·평가 조회와 도구 승인 후속 실행 등 기획서의 나머지 release 요구사항은 미완료이며, 이번 32개 통과를 전체 제품 완성으로 대체하지 않는다.

## 후속 작업: HTTP 응답 평가 복원

- 원격 대화 변환이 항상 `votes: {}`를 반환하던 누락을 수정했다. 소유권을 확인한 메시지 GET은 해당 페이지의 완료 assistant ID와 인증 user_id로 평가를 조회한다. 최대 200개 메시지에 대해 한 번 조회하며 다른 공유 사용자의 평가를 UI에 본인 평가로 표시하지 않는다.
- 메시지별 `vote`는 rating/reason 또는 null이다. `conversationFromHttp`는 모든 메시지 페이지에서 완료 assistant의 평가를 DB 메시지 ID에 연결한다. `voteFromHttp`는 입력을 변경하지 않는 순수 변환이며 잘못된 rating/reason을 거부한다. 평가 조회 실패를 빈 목록으로 숨기지 않는다.
- HTTP 평가 저장은 서버가 돌려준 메시지 ID와 rating/reason을 검증한 뒤 UI에 반영한다. 정규화된 사유를 사용하고, 누락/불일치 응답과 저장 실패는 기존 평가를 유지한 채 오류로 알린다. 저장 중 평가 버튼·사유 선택을 잠그며 함수 내부 ref로 같은 시점의 중복 호출도 방지한다. mock 저장은 기존 경로를 유지한다.
- `pnpm test:contracts`: 57/57 PASS, 1.0초. 여러 페이지의 평가/사유 복원, 사용자·미완료 메시지 제외, 입력 불변성, 잘못된 응답/누락/메시지 불일치와 403/503 실패를 추가 검사했다. 기존 브라우저 없는 Playwright 계약 실행기를 사용했으며 별도 Vitest 설치는 하지 않았다.
- `pnpm test:db`: 12개 migration+seed 및 PGlite 계약 PASS. 공유 열람자와 owner가 같은 답변에 서로 다른 평가를 남긴 뒤 owner 필터로 본인 평가만 조회하는 검사를 추가했다. DB 정책 자체는 변경하지 않았고 실제 PostgREST 조회 검증은 아니다.
- `CI=1 pnpm test:e2e --retries=0`: 32/32 PASS, 1.9분. 기존 좋아요/싫어요·사유·reload와 전체 Chromium/Pixel 회귀를 확인했다. mock 모드이므로 새 HTTP 평가 복원의 실제 Supabase 성공 E2E로 표기하지 않는다.
- 최종 `pnpm typecheck`, `pnpm lint` PASS. 오류 0, 기존 img warning 3.

계약 테스트 스킬의 정상·경계·실패 검증과 브라우저 스킬의 실제 사용자 흐름 회귀 기준을 적용했다. 실제 Supabase HTTP 평가 저장→reload와 네트워크 실패 복구 E2E는 남아 있으며 전체 목표는 진행 중이다.

- 후속 `pnpm test:security`: 15/15 PASS, 21.5초. 비인증 메시지/평가 조회·저장 401, 잘못된 ID/rating/추가 user_id 필드 400, cross-site 403과 Proxy 등록을 검사했다. 서버 GET의 실제 소유자 성공·타인 데이터 차단은 Supabase 통합 환경에서 추가 확인해야 한다.
- 보안 검사 뒤 일반 `pnpm build` PASS, Proxy 등록 확인. 3210/3211 포트에 남은 테스트 서버 없음. 이번 턴에서 실제 사용자 데이터나 Docker 서비스를 변경하지 않았다.

## 후속 작업: HTTP 대화별 모델 선택 저장

- `setModel`이 mock 저장만 호출하던 누락을 수정했다. 원격 모드는 활성 소유 대화 PATCH로 modelId를 저장하고, 응답의 대화 ID/모델 ID가 요청과 일치할 때만 선택을 변경한다. 실패 시 기존 선택을 유지한다. 저장 중 composer 전송과 모델 변경을 차단한다.
- 대화 PATCH는 modelId의 형식·길이와 서버 허용 목록을 확인한다. 실제 UPDATE에도 owner_id/active 상태 조건을 적용해 조회 후 삭제·보관된 대화를 모델 변경으로 갱신하지 않는다. title/visibility update도 deleted 상태를 최종 UPDATE 조건에서 제외한다. 스키마 migration은 추가하지 않았다.
- `model-policy.ts`에 순수 허용 목록 계산을 분리하고, 환경 읽기/HTTP 오류 변환은 경계 함수에서 수행한다. 대화 생성·모델 변경·AI 공급자 선택이 같은 기본값/허용 목록 정책을 사용한다. 명시적 빈 목록이나 기본 모델을 제외한 목록을 기본값으로 우회하지 않는다.
- 신규 대화 생성 요청에서 클라이언트의 고정 모델을 제거했다. 서버 기본값은 AI_CHAT_MODEL→OPENAI_MODEL→프로젝트 기본 모델 순서다. 기존 생성 요청 재전송은 처음 생성 계약에 따라 복원하며 재전송 시 현재 설정으로 기존 모델을 덮어쓰지 않는다.
- 잘못된 `/model` 명령은 입력을 남기고 오류를 표시한다. 정상 명령은 저장 성공 후 입력을 비우고, 실패하면 입력을 유지한다. 저장된 커스텀 모델은 select의 현재 값으로 표시한다. 전체 동적 카탈로그·검색·capability 안내는 아직 미구현이다.
- `pnpm test:contracts --reporter=line`: 62/62 PASS, 1.5초. 모델 저장→재조회, 누락/다른 대화/다른 모델 응답 거부, 400 실패와 순수 허용 목록의 기본값·중복·공백·명시적 빈 목록을 검사했다. 주입 fetch와 순수 함수 검사이며 실제 Supabase 성공 증거는 아니다.
- 타입 검사는 PASS. 린트 오류 0·기존 img warning 3.

단위 테스트 스킬의 정상·경계·실패 사례와 Playwright 스킬의 실제 브라우저 검증 기준을 적용했다. composer 원격 초안 보존은 이번 변경에 포함하지 않았으며 별도 구현이 필요하다. 전체 목표는 진행 중이다.

- `CI=1 pnpm test:e2e --retries=0`: 33/33 PASS, 2.0분. 새 시나리오는 잘못된 `/model`의 오류/입력 보존, 정상 모델 선택과 reload, 실제 AI 응답의 `X-AI-Model: gpt-5-mini`, 사용자 메시지 1개를 검증했다. mock 데이터/AI 기반 Chromium·Pixel 전체 회귀이며 실제 Supabase 모델 저장 성공으로 표기하지 않는다.
- `pnpm test:security`: 16/16 PASS, 22.2초. modelId PATCH의 인증 401, 빈 값/길이/형식/추가 owner 필드 400, cross-site 403과 기존 경계를 확인했다. 인증된 소유자/타인/보관 대화의 실제 PATCH 성공·거부는 Supabase 통합 환경에서 추가 검증한다.
- 보안 검사 이후 일반 `pnpm build` PASS, Proxy 등록 확인. 최종 lint 오류 0·기존 warning 3. 3210/3211 잔여 테스트 서버 없음. 실제 사용자 데이터와 Docker 서비스를 변경하지 않았다.

## 후속 작업: 원격 composer의 로컬 초안 보존

- 원격 입력도 사용자 ID·대화 ID별 버전 1 localStorage 키로 보존하도록 연결했다. 서버 세션 준비와 소유 대화 조회 후에만 초안을 복원한다. 원격 신규 대화의 응답 재전송도 같은 대화 ID의 초안을 읽는다. 컴포넌트 key에 owner ID를 포함해 계정별 입력 상태를 구분한다.
- `draft-storage.ts`는 저장소를 주입받는 I/O adapter와 순수 키 생성/JSON 해석으로 분리했다. 공백·줄바꿈을 유지하고 빈 문자열은 해당 키를 삭제한다. 사용자·대화 누락, 손상된 데이터, 잘못된 버전/타입, 32,000자 초과와 저장소 차단/quota는 오류로 처리한다. UI 경계는 입력을 유지하며 경고를 표시한다.
- 저장하는 것은 미전송 일반 텍스트뿐이다. 첨부 파일·편집 분기/요청 키는 포함하지 않는다. 기존 전송 흐름대로 전송 버튼을 누르면 초안을 지우고 이후 오류는 메시지 재시도로 처리한다. 서버 수신 전 종료된 요청의 reload 복원 outbox는 아직 없다. 편집 시작 시 일반 초안을 비워 편집 내용을 신규 메시지로 잘못 복원하지 않는다.
- 개별 삭제는 해당 대화 키, 전체 삭제는 owner 키를 정리한다. 서버 삭제 뒤 로컬 정리 실패는 안내하고 서버 mutation을 재실행하지 않는다. 로컬 키 분리는 암호화나 OS/브라우저 사용자 간 보안 경계가 아니다. 기기 간 동기화는 제공하지 않는다.
- 원격 로그아웃은 HTTP 성공을 확인한다. 실패하면 기존 UI 세션을 유지하고 오류를 표시한다. 성공하면 이 브라우저의 초안 namespace만 정리한 후 전체 페이지 이동으로 이전 계정 메모리 상태를 폐기한다. 정리 실패는 사이트 데이터 삭제 안내를 표시한다. 원격 로그인 성공도 전체 페이지 이동하며 mock 인증 흐름은 유지했다. 실제 계정 변경·다른 탭 동기화는 추가 검증이 필요하다.
- 계약 검사 66개가 통과했다. 새 검사 4개는 사용자/대화 키 분리, 공백 보존, empty/remove/owner/all 정리, 손상/버전/크기/식별자 오류, 읽기·쓰기·삭제 실패 전파를 포함한다. 이후 린트가 발견한 restoreDraft 선언 순서 오류와 Next 내부 이동 경고를 수정했다.
- 최종 `pnpm typecheck`, `pnpm lint` PASS. 오류 0·기존 img warning 3. 전체 이동은 계정 메모리 폐기를 위한 의도된 동작이며 같은 origin의 고정 profile URL만 사용한다.

단위 테스트와 Playwright 스킬의 실패·경계 및 실제 브라우저 검증 기준을 적용했다. 실제 Supabase 인증 composer의 입력→reload, quota 경고, 로그아웃 실패/성공 UI는 아직 미검증이며 전체 목표는 진행 중이다.

- `CI=1 pnpm test:e2e --retries=0`: 34/34 PASS, 2.0분. 새 검사는 제품의 초안 adapter 소스를 TypeScript 변환 후 실제 Chromium에 로드해 localStorage 저장→페이지 reload→사용자별 복원→초안 키만 삭제를 검증한다. 앱 인증을 우회한 Supabase 성공 검사로 주장하지 않는다. 기존 mock composer·인증과 전체 Chromium/Pixel 회귀도 통과했다.
- `pnpm test:security`: 16/16 PASS, 21.4초. 기존 인증/CSRF/Proxy 경계 회귀다. 로그아웃 성공과 인증 사용자 초안의 실연동 브라우저 증거는 아니다.
- 보안 검사 후 일반 `pnpm build` PASS, Proxy 등록 확인. 3210/3211 잔여 서버 없음. 실제 사용자 데이터나 Docker 서비스는 변경하지 않았다.

## 후속 작업: 일반 원격 전송의 outbox 복구

- 원격 일반 메시지 전송 전에 서버 대화를 조회하고 안정된 사용자 메시지 키·정규화 parts·모델·시작 시각·기준 updatedAt/tail을 사용자/대화별 outbox에 저장한다. 브라우저 기록 실패 시 네트워크 전송을 시작하지 않고 입력을 유지한다. 편집·재생성의 별도 mutation 요청 키는 이번 outbox 범위가 아니다.
- 로컬 기록은 서버에 같은 사용자 키/내용이 확인될 때만 자동 정리한다. 정상 전송 뒤 확인 조회가 실패하면 기록을 남긴다. 다음 전송 전에도 이전 기록을 서버와 대조하고 확인된 기록만 교체한다.
- reload는 서버에 사용자 메시지가 있으면 저장된 대화/기존 pending 흐름을 복원한다. 서버에 없고 기준 revision/tail이 같으면 동일 키·parts·모델의 사용자 메시지를 복원해 기존 재시도 흐름으로 이어간다. 다른 내용의 같은 키, 대화 ID 불일치, 변경된 metadata/tail은 자동 재전송을 거부한다. 표시된 로컬 내용을 확인하고 기록만 버리는 별도 확인 버튼을 제공하며 서버 메시지는 삭제하지 않는다.
- Web Locks를 사용해 같은 origin·사용자·대화의 outbox read/compare/write/ack를 직렬화한다. 기록/잠금 기능을 쓸 수 없으면 실패를 알리며 저장 성공으로 간주하지 않는다. 이 클라이언트 잠금은 DB 독립 연결 경쟁이나 기기 간 동기화를 보장하지 않는다.
- outbox 기록 직후 초안 초기화 전에 종료되는 경우를 고려해 제출 내용과 같은 초안을 먼저 제거하고 서버 확인된 outbox를 정리한다. 내용이 다른 다음 초안은 유지한다. 메시지 초기화·삭제·전체 삭제·로그아웃은 범위에 맞는 outbox도 정리하며 서버 삭제 후 로컬 정리 오류는 별도 안내한다.
- 계약 검사 74개 PASS. 신규 8개는 미수신 복원, 이미 저장된 턴, metadata/tail/ID/내용 충돌, 표시 전용 필드 정규화, 잘못된 메시지, 동일 기록 재시도/키별 정리, 손상·quota, 사용자별/로그아웃 정리 및 종료 시점의 초안 중복 방지를 포함한다. 순수 판단과 주입 Storage 검사이며 실제 Supabase나 실제 다중 탭 Web Locks 경합 검사는 아니다.
- `CI=1 pnpm test:e2e --retries=0`: 34/34 PASS, 1.9분. 기존 mock 채팅/재시도/새로고침과 Chromium/Pixel 전체 회귀다. 새 HTTP outbox UI의 실제 Supabase 성공·충돌 복구 증거로 표기하지 않는다.
- 타입 검사와 린트 PASS, 오류 0·기존 img warning 3. 이후 라우트 전환 때 이전 복구 안내가 남지 않도록 상태 초기화를 보완했다.

단위 테스트 스킬의 정상·경계·실패 사례와 브라우저 스킬의 회귀 검증 기준을 적용했다. 실제 Supabase 네트워크 단절→reload→동일 키 복구, 다중 탭 저장/로그아웃 경합, 첨부 Storage와 나머지 기획 release 요구사항은 여전히 남아 있으며 전체 목표는 진행 중이다.

- `pnpm test:security`: 16/16 PASS, 22.4초. 기존 인증/CSRF/Proxy 회귀이며 outbox 실연동 성공 검증은 아니다.
- 보안 검사 후 최종 lint 오류 0·기존 warning 3, 일반 `pnpm build` PASS(타입 검사·Proxy 등록 포함). 3210/3211 잔여 서버 없음. 실제 사용자 데이터나 Docker 서비스는 변경하지 않았다.

## 후속 확인: Supabase 실행 환경 재점검

- `pnpm supabase:status`: `supabase_db_character-english-ai` 컨테이너가 없다.
- 기존 임시 Docker 설정과 명시적 로컬 Docker socket으로 `pnpm supabase:start`를 실행하고 동일 프로세스를 종료까지 추적했다. 종료 코드 1. ECR/GHCR/Docker Hub 이미지 가져오기 모두 Docker의 `error creating temporary lease: read-only file system`으로 실패했다. 단순 관찰 timeout으로 프로세스를 재시작하지 않았다.
- 호스트 `df -h` 결과: Data 볼륨 228Gi 중 191Gi 사용, 표시 가용 공간 5.1Gi, Capacity 98%. 이 결과만으로 Docker read-only 전환의 정확한 원인을 확정하지 않는다.
- `docker system df`: 이미지 17.89GB(회수 가능 표시 6.497GB), 컨테이너 15.15GB(15.14GB), 볼륨 18.81GB(17GB), 빌드 캐시 21.33GB(21.33GB). 회수 가능 표시는 사용자 데이터 삭제 권한이나 안전성의 증거가 아니다. 특히 비활성 볼륨/컨테이너에는 보존할 데이터가 있을 수 있다.
- 다른 프로젝트의 OAuth proxy, private-docs, youtube-dl, nginx 서비스가 실행 중이며 mongo 컨테이너는 재시작 상태다. Docker Desktop 재시작은 이 서비스들에도 영향을 줄 수 있다.
- 캐시·이미지·컨테이너·볼륨을 삭제하거나 Docker Desktop을 재시작하지 않았다. 캐시 정리/재시작은 사용자 확인이 필요한 다음 환경 복구 단계다. 이번 턴에서는 앱 코드나 테스트 결과를 변경하지 않았다.

실제 Supabase E2E는 환경 복구 전까지 진행할 수 없다. 다른 미구현 기능도 남아 있으므로 전체 목표 완료나 전체 작업 불능으로 판정하지 않는다.

## 후속 작업: 서버 모델 목록과 반응형 검색 검증

- GET `/api/ai/models`는 실제 모델 선택과 같은 서버 allowlist 정책에서 ID 목록·기본 ID·requestId만 반환한다. 공급자 URL/키는 노출하지 않으며 응답은 no-store다. 클라이언트는 하드코딩된 두 모델 대신 이 목록을 조회하고, 조회 실패 시 선택을 막고 재조회 버튼을 제공한다.
- 검색은 대소문자를 구분하지 않는다. 검색 결과가 없어도 현재 선택은 유지하며 빈 결과를 안내한다. `/model` 명령도 같은 목록을 사용한다. 모델별 vision/tools/reasoning capability 안내는 아직 미구현이다.
- 이전 실행의 실패는 재조회 버튼이 고정 높이 헤더를 넘어서 메시지 영역에 가려지는 레이아웃 문제였다. 컨트롤을 독립된 줄로 옮긴 상태에서 재검증했다. 기존 세션 91448은 더 이상 존재하지 않고 `.last-run.json`에 실패가 기록된 것을 확인한 후 새 실행을 시작했다.
- `CI=1 pnpm test:e2e --retries=0`: 36/36 PASS, 2.0분. 모델 목록 실패→실제 endpoint 재조회→검색→선택→reload, 360px에서 검색·선택·입력창 노출·가로 overflow 방지 검사를 포함한다. 모바일 캡처를 직접 확인했다. 상단 대화 제목은 좁은 폭에서 많이 생략되므로 추가 가독성 개선 여지가 있다.
- `pnpm test:contracts`: 76/76 PASS, 1.6초. 목록 중복 제거·빈 목록 유지·잘못된 응답/HTTP 오류 거부를 포함한다. 브라우저 없는 계약 검사다.
- `pnpm test:security`: 17/17 PASS, 26.8초. 공개 모델 endpoint의 정확한 응답 필드와 no-store, 기존 인증/CSRF/Proxy 경계를 검증했다. 실제 Supabase 모델 저장·복원 성공 검사가 아니다.
- `pnpm lint`, `pnpm typecheck`: PASS. lint 오류 0·기존 img 경고 3. `pnpm audit --prod --audit-level high` 출력은 알려진 취약점 없음이며 gitleaks는 설치되어 있지 않다.

Playwright 스킬의 실제 조작·실패 화면 확인과 정적 분석 스킬의 검사 범위 구분을 적용했다. 브라우저/그래프 MCP 도구가 제공되지 않아 기존 Playwright CLI와 직접 파일 확인을 사용했다. Docker 캐시 삭제나 재시작은 수행하지 않았다. 실제 Supabase E2E와 나머지 기획 release 요구사항은 남아 있어 전체 목표를 완료로 표시하지 않는다.

- 보안 검사 후 일반 `pnpm build` PASS. `/api/ai/models`와 Proxy 등록 확인. 3210/3211 잔여 listener 없음. 정적 검사 원본 로그는 `reports/static-analysis/2026-09-10-1549/`에 보존한다.

## 후속 작업: 모델 capability 안내와 입력 호환성

- 공개 모델 목록에 vision/documents/tools/reasoning의 지원·미지원·미확인 flag와 출처를 추가했다. `AI_CHAT_MODEL_CAPABILITIES`는 서버 전용 JSON 설정이며 모델 이름으로 기능을 추측하지 않는다. malformed JSON/flag/알 수 없는 필드는 설정 오류로 처리하고 응답에는 비밀값이나 원문 설정을 넣지 않는다. 허용 목록 밖의 ID는 노출·활성화하지 않는다.
- `buildChatModelEntries`, `parseChatModelEntries`, `unsupportedChatInput`은 I/O 없는 순수 정책이다. 환경 읽기는 config, HTTP는 repository/Route Handler, 표시·검색은 `ChatModelSelector`로 분리했다. SLAP 지침에 따라 모델 선택 UI를 업무 흐름에서 분리했으며 FSD 의존 방향을 유지했다.
- UI는 기능과 출처를 표시한다. mock 공급자의 파일 입력 수용/도구 fixture와 추론 출력 미지원을 실제 모델 능력과 구별한다. 미지원·미확인 파일 전송은 입력/첨부를 지우지 않고 차단한다. 기존 file/tool 대화 이력과 호환되지 않는 모델로 변경하면 기존 선택을 유지한다.
- 서버는 들어온 메시지와 DB에서 반환된 생성 history를 모두 확인하며 파일·도구는 해당 flag가 true일 때만 사용한다. DB 이력을 확인한 뒤 거부하면 기존 오류 종료 경로로 생성 lease를 마무리한다. tools 지원이 확인되지 않으면 도구/호출 지침을 전달하지 않는다. mock 모델도 실제 전달된 tool 목록에 있는 weather만 호출하도록 수정했다.
- 신규 순수 정책 정상·경계·실패 검사 5개를 포함해 `pnpm test:contracts`: 81/81 PASS, 1.3초. 실제 Supabase나 공급자 capability probe는 아니다.
- 첫 전체 E2E는 37 PASS/1 FAIL이었다. 첨부 오류 alert와 Next.js route announcer가 함께 선택되는 테스트 strict-mode 오류였다. 오류 화면/로그를 확인하고 문구로 alert를 특정했으며 제품 차단 조건을 완화하지 않았다. 전체 회귀를 다시 실행한다.
- 타입·린트·의존성 audit PASS. 린트 오류 0·기존 img 경고 3. gitleaks 미설치로 SKIP. 원본 로그: `reports/static-analysis/2026-09-10-1558/`.

단위 테스트/Playwright/정적 분석 스킬을 적용했고, 그래프·브라우저 MCP 부재로 소스 확인과 기존 CLI를 사용했다. Docker 정리/재시작은 하지 않았다. 실제 Supabase 모델 저장/이력 복구, 실제 공급자별 기능 probe, 첨부 Storage 및 나머지 release gate는 아직 남아 있다.

- 재실행 `CI=1 pnpm test:e2e --retries=0`: 38/38 PASS, 2.1분. 기능 안내, 미지원/미확인 첨부 차단, 입력 보존→reload→지원 모델로 전송, 기존 첨부 이력과 충돌하는 선택 보존을 실제 Chromium에서 확인했다. 브라우저 fetch로 composer를 우회한 이미지/PDF 요청 4건의 400 차단과 도구 없는 텍스트 stream도 확인했다. 360px 캡처에서 기능 안내와 입력창을 확인했다. 이미지 내용 인식이나 실제 Storage 저장을 검증한 것으로 표기하지 않는다.
- `pnpm test:security`: 17/17 PASS, 22.5초. 정확한 공개 capability 응답 필드·no-store와 기존 인증/CSRF/Proxy 회귀를 검증했다. 인증된 Supabase 성공 경로는 아니다.
- 보안 검사 후 일반 `pnpm build` PASS(타입 검사·Proxy 등록 포함). 3210/3211 잔여 listener 없음. 전체 목표는 진행 중이며 이번 변경은 REF-08 capability 안내와 REF-14 vision 제한의 일부 증거를 보강한 것이다.

## 후속 작업: 원격 채팅 첨부 저장·복원 경로

- `20260910070000_chat_file_storage.sql`은 비공개 `chat-message-files` 버킷, `chat_file_uploads` registry, 서버 전용 등록 RPC와 사용자 메시지 file 참조 검증 trigger를 추가한다. 기존 Artifact/legacy 버킷과 정책은 변경하지 않는다. 아직 실제 Supabase에 적용하지 않았다.
- 업로드는 로그인·활성 소유 대화 확인 후 PNG/JPEG/PDF의 크기(2MiB)와 signature를 검사한다. 내용 hash 기반 owner/conversation 경로에 upsert 없이 저장하며, 재시도는 같은 파일 ID를 반환하고 처음 등록된 이름을 유지한다. 대화 잠금 안에서 소유자·상태·객체 존재를 다시 확인한다. 등록 실패 때 객체를 삭제하지 않아 다른 성공 요청의 파일을 지우지 않는다.
- 신규 원격 전송/편집은 업로드 성공 후 `chat-file://conversationUUID/attachmentUUID`를 사용한다. outbox와 DB에는 base64/서명 URL을 저장하지 않는다. 업로드 실패는 입력과 첨부를 유지한다. DB는 다른 대화/소유자, MIME 위장, 미등록 참조, 외부 URL/base64, 파일 4개 초과를 거부한다.
- 파일 GET은 소유자·삭제되지 않은 대화·registry와 크기/hash를 확인한다. PNG/JPEG는 bytes, PDF는 다운로드로 반환하고 no-store/nosniff/sandbox를 적용한다. 공유 화면은 비공개 안내만 보여 주고 파일 GET/링크를 생성하지 않는다.
- AI 입력은 저장된 history의 내부 참조만 서버에서 해석한다. 임의 URL을 fetch하지 않고 Storage bytes를 요청 한정 data URL로 바꾼다. 원래 DB/UI 메시지는 내부 참조를 유지한다. 모델 입력은 반복 출현을 포함해 파일 bytes 합계 16MiB로 제한하며, 같은 파일 다운로드는 요청 내 재사용한다. actual provider 처리와 이 제한 오류의 UI 복구는 실연동 확인이 필요하다.
- `pnpm test:contracts`: 87/87 PASS(최종 1.7초). 신규 6개는 참조/URL 안전성, MIME·크기, 대소문자 UUID 경로 정규화, 업로드 전후 parts 보존, 실패/잘못된 응답/개수 제한 및 동일 payload 재시도를 포함한다.
- `pnpm test:db`: 13개 migration+seed를 PGlite에 적용한 전체 DB 계약 PASS. 새 검사는 등록 재시도·metadata 충돌·존재/소유/활성 상태, 사용자 parts 참조 범위/MIME, 브라우저 registry/Storage 읽기·쓰기/등록 RPC 차단을 확인했다. 실제 Storage 서비스/PostgREST나 독립 연결 경합 증거는 아니다.
- `CI=1 pnpm test:e2e --retries=0`: 39/39 PASS, 2.1분. 신규 브라우저 검사는 fixture file 응답으로 내부 참조 이미지의 decode/reload/link와 공유 화면의 요청 차단을 확인했다. 인증된 업로드 성공을 모의 통과시킨 검사로 주장하지 않는다.
- `pnpm test:security`: 18/18 PASS, 24.9초. 새 업로드/파일 GET의 401·잘못된 ID의 400·cross-site 업로드의 403 및 기존 인증/Proxy 회귀를 확인했다.

SLAP·순수 정책 분리와 단위 테스트/Playwright/정적 분석 스킬 기준을 적용했다. 그래프·브라우저 MCP가 없어 소스/기존 CLI를 사용했다. 실제 Supabase 업로드→등록→AI 이미지/PDF 처리→reload/편집/재시도는 아직 미검증이다. 취소·삭제·purge 후 Storage 고아 객체 GC, 악성 파일 검사, 분산 용량 quota, 붙여넣기·FileReader 오류 복구 등도 남아 있다. Docker 삭제·재시작은 하지 않았으며 전체 목표는 진행 중이다.

- 최종 DB 재검사 PASS: 잘못된 UUID 형태, 다른 author와 5개 파일 입력 거부를 추가 확인했다. 일반 `pnpm build` PASS, 두 첨부 Route Handler와 Proxy 등록 확인. 최종 타입 검사·린트 PASS(오류 0·기존 img 경고 3), 의존성 audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그는 `reports/static-analysis/2026-09-10-1620/`에 보존했다. 3210/3211 잔여 listener 없음.

## 후속 작업: 첨부 붙여넣기와 FileReader 복구

- REF-14: picker·붙여넣기의 MIME/크기/모델 기능 검사를 순수 정책으로 통일했다. PNG/JPEG/PDF 한 파일을 읽으며 다중 붙여넣기는 기존 입력·첨부를 보존하고 안내한다. 텍스트 paste는 기본 동작을 막지 않는다.
- 파일 읽기 성공·실패·취소는 별도 브라우저 함수에서 한 번만 종료한다. 읽기 취소 버튼, 교체/제거/모델 변경/unmount 시 이전 작업 무효화, 읽기 중 전송 차단과 같은 파일 재선택을 구현했다. 실패·늦은 완료가 기존 입력이나 새 첨부를 지우거나 덮어쓰지 않는다.
- `pnpm test:contracts`: 92/92 PASS(1.2초). 새 5개는 메타데이터 경계, 정상 읽기·핸들러 해제, 오류/잘못된 결과/동기 예외, 취소·늦은 콜백, 사전 취소와 native abort를 검사한다. 프로젝트 지침에 따라 기존 browserless Playwright 실행기를 사용했다.
- 새 실제 Chromium E2E 2개: DOM 파일 paste→decode/preview→잘못된 MIME/다중 파일 보존→제거, FileReader 실패→같은 파일 재시도→취소/교체 후 늦은 완료 무시. 실제 OS clipboard 권한 또는 원격 Storage 검사가 아니다. 실패/지연은 FileReader를 제어해 재현했다.
- 첫 focused 실행 1 PASS/1 FAIL: 모델 카탈로그 준비 전 paste가 미확인 기능 정책에 차단됐다. 화면의 `이미지: 지원` 확인을 준비 조건으로 추가했다. 첫 전체 실행은 39 PASS/2 FAIL: 기존 채팅 종합 검사에도 동일 준비 조건을 추가했다. 미션 버전 검사에서 초안 표시가 나타나지 않은 별도 실패는 화면/소스를 확인했으나 원인을 확정하지 못했다. 다음 실행에서는 해당 코드 변경 없이 통과했으므로 간헐 실패 추적 과제로 유지한다.
- 최종 `CI=1 pnpm test:e2e --retries=0`: 41/41 PASS(2.1분), 실제 Chromium 및 Pixel 7 구성, mock 데이터/AI 모드. HTML 결과는 `apps/web/playwright-report/`다. 실연동 Auth/Storage E2E로 확대 해석하지 않는다.
- 타입 검사 PASS. 린트 0 errors/기존 img 경고 3. `pnpm audit --prod --audit-level=high` 알려진 취약점 없음. gitleaks 실행 파일 없음으로 SKIP. 로그: `reports/static-analysis/2026-09-10-1635/`.
- 일반 `pnpm build` PASS: TypeScript·정적 페이지 생성·첨부 Route Handler 및 Proxy 등록 확인.

단위 테스트·Playwright·정적 분석 스킬을 적용해 정책/I/O 경계를 각각 검증하고 개발 설계서에 복구 계약을 추가했다. 그래프/브라우저 MCP는 제공되지 않아 소스 확인과 CLI를 사용했다. 보안/DB 검사는 이번 첨부 입력 변경에서 다시 실행하지 않았다. 실제 Supabase와 provider 입력, Storage GC 및 나머지 REF gate는 여전히 미완료이며 전체 목표는 진행 중이다. Docker 정리·재시작이나 데이터 삭제는 하지 않았다.

## 후속 작업: 미션 초안 생성 실패 시 편집 내용 보존

- 이전 미션 버전 간헐 실패는 변경 전 `CI=1 pnpm test:e2e content-versioning.spec.ts --repeat-each=3 --retries=0 --trace=on`으로 확인했다. 캐릭터/미션 각 3회, 6/6 PASS(52.3초). 원래 간헐 실패는 재현되지 않았으며 해결됐다고 판단하지 않는다.
- 별도의 NFR-04 위반을 확인했다. 미션 초안 생성 HTTP 실패가 고정 레스토랑 예시를 적용해 작성자의 제목·목표·표현을 덮어썼다. 새 브라우저 테스트의 첫 시도는 잘못된 이전 버튼 이름으로 실패했으며 실제 이름으로 수정했다. 다음 실행은 HTTP 503 뒤 오류 안내 없이 레스토랑 제목과 fallback 표시로 바뀌어 실패했다. 실패 화면을 확인한 후 구현을 수정했다.
- 클라이언트의 고정 초안 fallback을 제거했다. `missionDraftSchema`로 전체 응답 검증을 끝낸 후 상태를 변경하므로 잘못된 200 응답도 일부 제목/위치를 먼저 반영하지 않는다. HTTP/JSON/스키마 오류는 작성 내용을 유지하고 기존 생성 버튼으로 재시도하도록 안내한다. 공용 스키마는 직접 client-safe 계약 모듈에서 가져온다.
- 신규 `mission-draft-recovery.spec.ts`: 정상 초안→작성자 제목/목표/표현 수정→503→불완전한 200 응답→재시도 성공을 실제 Chromium에서 확인했다. 각 실패 뒤 입력/초안을 보존하며 세 재시도 요청 body가 동일함을 확인한다. 실패 두 번은 route fixture이며 최종 성공은 실제 로컬 Next API의 mock 공급자를 사용한다. focused 1/1 PASS(9.3초).
- 최종 `CI=1 pnpm test:e2e --retries=0`: 42/42 PASS(2.2분), Chromium 및 Pixel 7 구성. HTML: `apps/web/playwright-report/`. 실제 Supabase/Auth/Storage 또는 live AI 공급자 검증은 아니다.
- `apb-playwright-e2e`와 `apb-static-analysis` 기준을 적용했다. 타입 검사 PASS, 린트 오류 0/기존 img 경고 3, production 의존성 audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1642/`. 그래프/브라우저 MCP가 없어 직접 소스와 기존 CLI를 사용했다. 보안/DB/계약 검사는 이번 UI 변경에서 다시 실행하지 않았다.

보상 이미지 생성의 별도 fallback, 생성 중 사용자 편집과 늦은 응답의 경합, 원래 간헐 실패의 원인, 실제 연동 및 나머지 기획 요구사항은 남아 있다. 전체 목표는 진행 중이며 Docker 정리/재시작이나 데이터 삭제는 하지 않았다.

- 최종 일반 `pnpm build` PASS: TypeScript, 정적 페이지 생성, App Router와 Proxy 등록 확인.

## 후속 작업: 보상 이미지 생성 실패와 디코딩 복구

- NFR-04/MISSION-04: 보상 생성 실패 시 기존 이미지 URL을 비우고 fallback 성공 표시를 만들던 동작을 제거했다. 실패는 기존 이미지·보상 이름·기본 장면 선택을 보존하고 오류와 재시도를 안내한다. 첫 생성 실패 때 AI 응답 표시를 만들지 않는다.
- 새 `readRewardImage`는 UI 상태 반영 전 응답 URL 형태와 실제 브라우저 디코딩/크기를 확인한다. PNG/JPEG/WebP 및 mock 출력 호환 SVG base64 data URL만 허용하며 외부 URL·HTML·깨진 이미지를 반영하지 않는다. 브라우저 I/O를 UI 조합과 분리했다. 서버 파일 보안 검사나 실제 공급자 검증을 대체하지 않는다.
- 신규 `reward-image-recovery.spec.ts`: 최초 503→생성 성공→503/외부 URL/깨진 PNG 응답→재생성 성공. 기존 background image와 보상 이름 보존, 잘못된 성공 표시 부재, 같은 요청 body의 재시도를 검사한다. 오류는 route fixture이고 성공은 로컬 Next API의 mock 이미지 공급자다. focused 1/1 PASS(12.3초).
- `CI=1 pnpm test:e2e --retries=0`: 43/43 PASS(2.2분), 실제 Chromium 및 Pixel 7 구성. HTML: `apps/web/playwright-report/`. 실제 Supabase/Auth/Storage/이미지 공급자 성공 E2E는 아니다.
- `apb-playwright-e2e`와 `apb-static-analysis` 스킬을 적용해 실패·복구를 브라우저에서 확인하고 정적 검사 로그를 보존했다. 타입 검사 PASS, 린트 오류 0/기존 img 경고 3, production 의존성 audit 알려진 취약점 없음. gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1648/`. 그래프/브라우저 MCP가 없어 소스와 기존 CLI를 사용했다.

생성 중 편집과 늦은 응답의 경합, 캐릭터 생성의 별도 실패 경로, 실제 공급자/Storage 저장 복구, 원래 미션 초안 간헐 실패와 나머지 요구사항은 남아 있다. 이번 변경에서 DB/보안/계약 검사는 다시 실행하지 않았다. 전체 목표는 진행 중이다.

- 일반 `pnpm build` PASS: TypeScript·정적 페이지 생성 및 App Router/Proxy 등록 확인.

## 후속 작업: 생성 중 편집·취소와 늦은 응답 차단

- 미션 초안/보상 생성을 하나의 현재 AbortController로 관리한다. 입력 변경·폼 내부 생성 이외 버튼 동작·명시적 취소·unmount 시 현재 생성을 무효화한다. 생성 중 안내와 `AI 생성 취소`를 제공하고 저장 버튼/함수를 차단한다. 새 생성은 기존 요청을 취소한다.
- fetch 취소 신호와 별도로, 파싱/디코딩 후 현재 요청인지 확인한다. 이전 요청의 성공·catch·finally는 새 편집 내용이나 새 생성의 로딩·오류 상태를 바꾸지 않는다. 취소는 현재 입력·이미지를 유지한다. 공급자 연산/과금의 취소까지 보장하지 않는다.
- 신규 `mission-generation-race.spec.ts` 2개: 브라우저 fetch 래퍼가 실제 로컬 API 응답을 받은 뒤 의도적으로 abort를 무시하고 지연 전달한다. 초안 편집, 명시적 취소 후 새 생성/추가 편집, 보상 편집·단계 이동, 생성 중 저장 차단과 재생성을 검증했다. focused 2/2 PASS(11.9초). 실제 공급자 취소·페이지 이탈 후 복원 검사는 아니다.
- 전체 `CI=1 pnpm test:e2e --retries=0`: **44 PASS/1 FAIL(2.4분)**. 새 두 테스트와 기존 오류 복구는 통과했지만 `content-versioning.spec.ts:138`의 `mission-draft-source` 표시 대기가 다시 실패했다. 직전 Fast Refresh 전체 reload 경고가 있었고 실패 화면은 오류/취소 안내 없는 초기 폼이었다. 원인은 아직 확정하지 않았다. 현재 실패 screenshot/video/error-context는 `apps/web/test-results/content-versioning-Creator-87681-ished-and-archived-versions-chromium/`에 있으며 HTML은 `apps/web/playwright-report/`다. 전체 통과로 보고하지 않는다.
- 다음 실패의 요청·브라우저 상태를 얻도록 Playwright trace를 `on-first-retry`에서 `retain-on-failure`로 변경했다. 이번 실패는 변경 전 실행이므로 trace가 없으며, 이후 실행부터 적용한다. 실패 확인을 약화하거나 재시도를 늘리지 않았다.
- `apb-playwright-e2e` 및 `apb-static-analysis` 적용. 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 병렬 타입 검사는 Next dev 시작 중 사라진 `.next/dev/types` 파일에 대한 TS6053으로 실패했다. 초기 focused 검사 앞 타입 검사는 통과했으며, 전체 실행 종료 뒤 별도 순차 검사를 수행한다. 최초 로그: `reports/static-analysis/2026-09-10-1653/`.

그래프/브라우저 MCP가 없어 소스와 기존 Chromium CLI를 사용했다. 실제 연동·캐릭터 생성 복구·나머지 기획 요구사항과 위 간헐 실패는 미완료다. 전체 목표는 진행 중이며 이번 변경에서 DB/보안/계약 검사는 다시 실행하지 않았다.

- E2E 종료 후 `pnpm typecheck && pnpm build` 순차 실행 PASS. 초기 생성 파일 경합 실패는 로그에 유지하며, 최종 타입·빌드는 통과했다. E2E의 1개 실패는 여전히 미해결이다.

## 후속 재검증 및 Supabase E2E 유예 반영

- 구현 변경 없이 `CI=1 pnpm test:e2e content-versioning.spec.ts --repeat-each=3 --retries=0`: 6/6 PASS(55.8초).
- 이어서 `CI=1 pnpm test:e2e --retries=0`: 45/45 PASS(3.1분). Chromium/Pixel 7, 로컬 Next 서버와 mock 데이터/AI 공급자. 이번 실행에는 실패가 없어 retain-on-failure trace가 남지 않았다. 이전 미션 초안 표시 실패의 원인은 미확정이며 재통과를 원인 해결로 기록하지 않는다.
- 사용자가 실제 Supabase E2E를 이번 완료 검증에서 제외하도록 결정했다. 문서 상단과 프로젝트 AGENTS.md에 `DEFERRED_BY_USER` 범위를 반영했다. Docker 정리·재시작 또는 stack 기동을 계속 요구하지 않는다. 서버 자격 증명은 추후 연결한다.
- 이번 턴은 검증 및 지침 문서만 변경했다. 빌드/타입/DB/보안 검사를 다시 실행하지 않았다. 나머지 기획 구현과 로컬 E2E 검증은 계속 진행한다. 전체 목표 완료 또는 운영 배포 준비 완료 판정은 아니다.

## 후속 작업: 캐릭터 이미지 명시적 선택·재생성·실패 복구

- CHAR-02/NFR-04: 신규 생성 및 성공한 재생성 뒤 첫 이미지를 자동 선택하지 않는다. 후보를 직접 선택해야 대표 이미지 미리보기와 저장이 가능하다. 기존 버전 편집은 현재 이미지 선택을 유지한다. 저장 함수에서도 선택을 확인한다.
- 생성 세 응답 모두 HTTP 및 이미지 디코딩을 통과해야 후보 세트를 한 번에 교체한다. 일부 실패·잘못된/깨진 응답은 기존 후보·선택·입력을 유지한다. 처음 실패했을 때 예시 이모지를 AI 성공 후보로 제공하지 않는다. 후보 재생성 버튼을 추가하고 생성 중 선택/저장을 막는다.
- 이미지 디코더를 `features/mission-create/api/read-reward-image.ts`에서 `shared/lib/read-generated-image.ts`의 `readGeneratedImage`로 이동했다. 캐릭터와 미션 보상이 공유하고 feature 간 직접 import는 만들지 않는다. 개발 설계서에 선택·복구 계약을 추가했다.
- 기존 캐릭터 생성/버전 E2E에 후보 클릭을 추가했다. 새 `character-image-recovery.spec.ts`는 최초 부분 실패, 성공 후 무선택, 선택한 이미지와 입력의 부분 실패/디코딩 실패 보존, 재생성 후 재선택 요구, 저장/reload를 실제 Chromium에서 확인한다.
- 첫 focused 실행 1 PASS/1 FAIL: 새 테스트의 반복 이미지 요청이 서버의 분당 12회 제한에 걸렸다. trace에서 429 확인. 일부 응답만 fixture로 줄인 다음 focused 2/2 PASS(19.5초)였으나 전체에서는 다른 테스트 호출까지 합쳐 캐릭터 버전 이미지 세 요청이 200/200/429였다. 제한은 변경하지 않았다. 최종 신규 복구 테스트는 전체 이미지 응답을 색상이 서로 다른 유효 SVG/오류 fixture로 격리한다. 실제 로컬 AI API 성공 경로는 기존 character-builder/content-versioning 검사에서 유지한다.
- 첫 전체 실행 44 PASS/2 FAIL(3.3분): 위 429와 별개로 미션 재도전 검사가 `mission-evaluation-panel`을 찾지 못했다. 실패 화면은 대화 준비 중 상태였으며 원인은 미확정이다. 화면/trace를 확인했고 단순 재통과를 해결로 취급하지 않는다.
- 최종 `CI=1 pnpm test:e2e --retries=0`: **46/46 PASS(3.4분)**. Chromium/Pixel 7, mock 데이터·공급자. HTML: `apps/web/playwright-report/`. 신규 복구 테스트는 fixture UI 검사이며 실제 공급자/Storage 성공 검사가 아니다. 실제 Supabase E2E는 사용자 결정에 따라 계속 유예한다.
- `apb-playwright-e2e`와 `apb-static-analysis` 스킬로 실패 응답·화면·trace를 확인하고 회귀/정적 검사를 수행했다. 그래프/브라우저 MCP가 없어 소스 및 기존 CLI를 사용했다. 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1705/`. DB/보안/계약 검사는 이번 변경에서 다시 실행하지 않았다.

캐릭터 생성 중 사용자 편집/이탈과 늦은 응답의 경합, 미확정 간헐 실패 및 나머지 기획 요구사항은 남아 있다. 전체 목표는 진행 중이다.

- 최종 `pnpm typecheck && pnpm build` 순차 실행 PASS. TypeScript·정적 페이지 생성·App Router/Proxy 등록 확인.

## 후속 작업: 캐릭터 생성 취소와 늦은 이미지 응답 검증

- 현재 파일의 캐릭터 생성 취소 구현을 확인했다. 세 이미지 요청에 동일 AbortController를 전달하며 편집·단계 이동·명시적 취소·unmount 때 무효화한다. 현재 작업만 후보·오류·로딩을 변경한다. 기존 입력·후보·선택은 보존하고 생성 중 저장은 UI와 함수 양쪽에서 차단한다. 개발 설계서에 이 계약을 반영했다.
- `character-generation-race.spec.ts`는 abort를 의도적으로 무시하는 이미지 fetch fixture로 세 요청 취소, 새 후보 선택 뒤 이전 응답 무시, 명시적 취소 후 재생성, 클라이언트 경로 이탈 시 정리를 실제 Chromium에서 검증한다. 이번 턴에 이미지 디코딩 완료 카운터를 추가하여 JSON 수신 직후 너무 일찍 상태를 확인하지 않도록 강화했다. 공급자 연산/과금 취소 검사는 아니다.
- 전체 `CI=1 pnpm test:e2e --retries=0`: **47/47 PASS(3.2분)**. 로컬 Next 서버, mock 데이터·AI, Chromium/Pixel 7. 전체 실행이 해당 테스트를 통과한 뒤 디코딩 대기를 추가했으므로, 최종 테스트는 `CI=1 pnpm test:e2e character-generation-race.spec.ts --retries=0`로 다시 실행하여 **1/1 PASS(9.3초)** 확인했다. 최신 HTML `apps/web/playwright-report/`는 이 focused 실행 보고서다.
- `apb-playwright-e2e`, `apb-static-analysis` 사용. 그래프 및 브라우저 MCP가 없어 직접 소스와 기존 CLI를 사용했다. 린트 exit 0, 오류 0/기존 img 경고 3; production audit exit 0, 알려진 취약점 없음; gitleaks 미설치 SKIP. 로그는 `reports/static-analysis/2026-09-10-character-cancellation/`에 기록했다.
- 실제 Supabase E2E는 `DEFERRED_BY_USER`. Docker 재시작이나 서비스 조작은 하지 않았다. DB/서버 보안/계약 검사는 이번 턴에 다시 실행하지 않았다. 과거 간헐적 미션 로딩 실패가 이번 실행에서 재현되지 않았지만 원인 해결을 입증한 것은 아니다. 남은 전체 기획 요구사항 구현·검증은 계속 진행한다.
- E2E 서버 종료 뒤 `pnpm typecheck && pnpm build` exit 0. 타입 검사와 production build, App Router 및 Proxy 등록을 확인했다. 실행 결과 발췌는 같은 로그 디렉터리의 `typecheck-build.log`에 있다.

## 후속 작업: 미션 학습 목표와 선수 조건의 혼동 수정

- MISSION-09/LEARN-01 점검 중 Supabase 조회가 `learning_goals`의 학습 목표 문장을 선수 미션 ID로 반환하는 결함을 발견했다. 게시 payload도 선수 조건이 있으면 학습 목표 필드에 그 ID들을 넣고 있었다. `compileMissionLearningFields`로 목표 문장과 ID를 분리하고, `readMissionPrerequisites`로 명시된 조건만 읽는다. 두 함수는 입력을 변경하지 않는 Supabase 어댑터 변환이며 DB I/O와 분리했다.
- DB 스키마를 대조해 설정의 실제 위치가 `mission_version_instructions.evaluator_config`임을 확인했다. 사용자 세션 RLS로 보이는 미션의 현재 버전 ID만 서버 권한으로 조회한다. 응답에는 검증된 조건 배열만 넣으며 지침·전체 평가 설정이나 서버 키를 공개하지 않는다. 설정 조회 실패/잘못된 조건/필수 지침 행 누락은 오류이고, 정상 설정에 조건 필드가 없으면 선수 조건 없음이다. 기존 게시 버전 데이터는 수정하지 않았다.
- 신규 계약 검사 3개: 목표/조건 분리 및 입력 불변, 조건 없는 기존 설정, 잘못된 명시적 조건 거절. focused 3/3 PASS(447ms), 전체 `pnpm test:contracts` **95/95 PASS(1.3초)**. 이 검사는 순수 변환이며 실제 Supabase 조회 검증은 아니다.
- 신규 `mission-prerequisites.spec.ts` 2개: 실제 디코더로 만든 로컬 fixture를 사용해 제한 없는 상세 화면의 시작, 선수 조건 미충족 잠금/reload, 완료 상태 fixture 반영 후 잠금 해제와 미션 대화 진입을 Chromium에서 확인했다. 실제 완료 평가나 서버의 조건 집행을 검증하는 테스트는 아니다.
- 최초 focused 브라우저 실행은 1 PASS/1 FAIL(20.6초). 시작 후 `attempt=new`가 대화 ID로 정상 치환되는 동작을 테스트가 놓쳤다. 실패 screenshot/error-context 및 router.replace 소스를 확인하여 클릭 전 링크 계약과 클릭 후 최종 대화 URL을 각각 검사하도록 수정했다.
- 최종 `CI=1 pnpm test:e2e --retries=0`: **49/49 PASS(3.4분)**. Chromium/Pixel 7, 로컬 mock 데이터·공급자. 최신 HTML은 `apps/web/playwright-report/`다. 실행 중 비공개 설정 조회 경계를 추가 수정했으므로 이 mock 브라우저 결과를 최종 서버 실연동 성공으로 해석하지 않는다.
- `apb-unit-test-write`의 정상/경계/실패 사례 지침을 기존 Playwright 계약 실행기에 적용하고, `apb-playwright-e2e`와 `apb-static-analysis`를 사용했다. 그래프·브라우저 MCP는 없어 직접 소스 및 CLI를 사용했다. 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1728/`.

남은 사항: 서버 시작 API는 선수 조건을 집행하지 않으며, 학습자 레벨 요구 사항 모델링도 미완료다. 직접 URL/API 우회, 게시 버전 고정과 기존 실행 재개를 이어서 구현·검증해야 한다. 따라서 MISSION-09와 전체 목표를 완료로 판정하지 않는다. 실제 Supabase E2E는 사용자 결정으로 유예하며 Docker 조작·자격 증명 요청을 하지 않았다. DB/보안 E2E는 이번 턴에 재실행하지 않았다.

- 최종 서버 조회 수정 후 `pnpm lint` exit 0(기존 경고 3), E2E 종료 후 `pnpm typecheck && pnpm build` exit 0. 원본 출력은 `lint-final.log`, `typecheck-build.log`에 보존했다.

## 후속 작업: 선수 조건 DB 집행과 시작 실패 복구

- `20260910080000_mission_prerequisite_guard.sql` 추가. 대화·미션 실행의 insert 및 owner/mission/version 변경에 같은 trigger를 적용한다. 해당 고정 버전의 비공개 설정을 읽고, 모든 선수 미션에 대해 같은 owner의 확정된 passed 실행을 요구한다. UUID/slug를 지원하며 학습 목표 문장은 조건으로 해석하지 않는다. 조건 누락/형식 오류와 조건 미충족을 구분한다. 일반 조회나 동일 컨텍스트의 진행 갱신에는 소급 잠금을 걸지 않는다.
- 브라우저의 직접 DB 삽입도 검사하도록 RLS와 별도로 DB 경계에 둔다. 지침 테이블 권한을 공개하지 않고 trigger 함수 직접 실행 권한을 회수했다. API의 대화 생성/미션 실행 생성은 `P2001`을 409 `MISSION_PREREQUISITES_REQUIRED`로 변환한다. 실제 DB에는 아직 적용하지 않았으며 배포 선행 migration으로 AGENTS.md와 설계서에 기록했다.
- `tests/db/mission-prerequisites.mjs`를 기존 `pnpm test:db`에 연결했다. 최초 실행은 허용 경로 fixture가 같은 conversation에 두 run을 삽입해 기존 unique 제약으로 실패했다. 성공 경로에 별도 대화를 사용하도록 테스트를 수정했다. 최종 14 migrations+seed 및 전체 PGlite 계약 검사 PASS. 선수 조건 없는 생성, 미충족 대화/run 거부, 확정 완료 허용, 평가 중 거부, 여러 조건 중 일부 미충족 거부, 다른 owner 기록 거부, owner 변경 거부, UUID/slug, 잘못된 조건, 지침 누락, authenticated 직접 삽입 및 지침 접근 거부, 기존 진행 갱신을 확인했다. 실제 Supabase E2E나 다중 연결 검증은 아니다.
- 채팅은 미션 실행 준비 전 전송과 답변 재생성을 함수 경계에서 차단하고 초안을 유지한다. 시작/조회 오류와 재시도를 모바일·데스크톱 공통 composer 위에 표시한다. 시작 재시도는 기존 mutation 입력을 재사용한다.
- 신규 `mission-start-recovery.spec.ts` 2개는 409 거절 fixture로 직접 채팅 진입, 오류 안내, 키보드 전송·재생성 차단, 초안 보존, 같은 입력 재시도, 정상 시작 후 전송을 1280px/360px Chromium에서 확인했다. focused **2/2 PASS(15.9초)**. DB enforcement와 UI 오류 처리를 분리 검증한 것이며 실연동 HTTP 전체 흐름을 검증한 것은 아니다.
- `apb-unit-test-write`의 정상·경계·실패 사례 지침을 기존 PGlite 검사에 적용했고, `apb-playwright-e2e`, `apb-static-analysis`를 사용했다. 그래프·브라우저 MCP가 없어 소스와 CLI를 사용했다. 최종 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1739/`.

레벨 요구 사항과 전체 게시/재개·원자적 시작 계약 및 나머지 기획 구현은 남아 있다. mock 서버의 사용자 작성 미션 조건 집행은 DB trigger 검증과 동일하지 않다. 기존 실행을 소급 무효화하지 않으며 실제 Supabase E2E는 계속 `DEFERRED_BY_USER`다. 이번 변경만으로 MISSION-09 또는 전체 목표를 완료로 판정하지 않는다.

- 최종 `CI=1 pnpm test:e2e --retries=0`: **51/51 PASS(3.4분)**, exit 0. 로컬 Next 서버, mock 데이터/AI, Chromium 및 Pixel 7. HTML: `apps/web/playwright-report/`. 서버 보안 E2E와 Node 계약 전체 검사는 이번 턴에 다시 실행하지 않았다.
- 최종 `pnpm typecheck && pnpm build` exit 0. E2E 종료 후 순차 검사했으며 로그는 `reports/static-analysis/2026-09-10-1739/typecheck-build.log`에 보존했다.

## 후속 작업: 대화별 미션 실행 분리와 종료 결과 재개

- LEARN-01/MISSION-10 점검에서 mock 채팅의 비-UUID 대화 ID가 시작 요청에서 빠지고, mock 서버가 캐릭터/대화 구분 없이 미션 ID만으로 활성 실행을 재사용하는 결함을 확인했다. UI는 대화 ID를 항상 전달한다. mock 모드에서만 로컬 문자열 ID를 허용하며 운영 입력은 UUID 제약을 유지한다.
- `entities/mission-run/model/resume-policy.ts`의 순수 `planMissionRunStart`가 같은 대화의 기존 실행 반환, 새 대화의 새 실행, 같은 대화의 다른 미션/캐릭터 충돌을 구분한다. 이전 호출 호환을 위한 대화 ID 없는 요청은 같은 미션·캐릭터의 활성 실행만 재사용한다. 호출자는 반드시 owner/session 범위의 목록을 제공한다.
- 운영 시작 조회에서도 대화 ID를 명시한 경우 상태 필터를 제거하여 completed/failed 결과를 다시 삽입하지 않고 복원한다. 미션·캐릭터·owner 필터는 유지한다. 현재 리소스·캐릭터 배정 검사가 재개보다 먼저이므로 게시 변경/보관 뒤 재개 전체와 동시 시작 원자성은 아직 미완료다.
- 신규 정책 계약 4개: 모든 실행 상태의 정확한 대화 복원, 다른 대화의 독립 실행, 미션/캐릭터 충돌, ID 없는 기존 요청의 캐릭터별 활성 실행. focused **4/4 PASS(352ms)**, 전체 `pnpm test:contracts` **99/99 PASS(1.4초)**.
- 신규 `mission-run-isolation.spec.ts`: 첫 실행이 진행 중일 때 미션 상세에서 새 대화를 시작하면 다른 실행 ID/시도 2와 빈 메시지를 갖고, 이전 대화 URL 및 reload에서는 원래 메시지와 실행 ID를 복원하며 실행이 추가되지 않는 것을 Chromium에서 확인한다. 기존 보상 실패 복구·재도전 검사와 함께 focused **4/4 PASS(38.5초)**. mock 데이터·서버이며 실제 Supabase 검사는 아니다.
- `apb-unit-test-write`, `apb-playwright-e2e`, `apb-static-analysis` 적용. 순수 정책은 기존 Playwright Node 계약 실행기로 검사했다. 그래프·브라우저 MCP가 없어 소스 및 CLI 사용. 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1747/`.

전체 기획 완료가 아니며 학습자 레벨·서버 시작 원자성·게시 변경 후 재개 등 남은 항목을 계속 진행한다. 실제 Supabase E2E는 사용자 요청으로 유예한다. DB 및 서버 보안 E2E는 이번 턴에 재실행하지 않았다.

- 최종 `CI=1 pnpm test:e2e --retries=0`: **52/52 PASS(3.5분)**, exit 0. 로컬 Next 서버, mock 데이터·AI, Chromium/Pixel 7. 보고서는 `apps/web/playwright-report/`다.
- 최종 `pnpm typecheck && pnpm build` exit 0. E2E 서버 종료 후 순차 검사했으며 로그는 `reports/static-analysis/2026-09-10-1747/typecheck-build.log`에 보존했다.

## 후속 작업: 소유 실행의 고정 버전 재개 경계

- 운영 미션 POST는 명시적 conversationId가 있으면 최신 게시물/캐릭터 배정 조회보다 먼저 소유 활성 대화와 기존 실행을 확인한다. owner·대화·미션·캐릭터·두 고정 버전이 모두 맞아야 기존 결과를 반환한다. 요청의 slug 확인도 소유 실행에 연결된 리소스 ID만 관리자 조회한다. 새 실행에는 기존 생성 조건을 유지한다.
- 목록/단건 조회와 시작·진행·완료 응답은 소유 실행 확인 뒤 관리자 클라이언트로 고정 단계와 결과를 조립한다. 보관 게시물의 공개 RLS로 단계가 빈 배열이 되는 경로를 수정했다. 기존 RLS/권한은 변경하지 않았다.
- `resume-owned-run.ts`는 저장소 포트를 조합하는 I/O 경계다. 순수함수로 표기하지 않는다. `owned-run-resume.spec.ts` 5개로 완료 상태/이전 버전 복원, 소유 리소스 slug 조회 순서, 다른 소유자/비활성/누락 대화 거부, 모든 고정 필드 충돌, 신규 생성 분기와 저장소 오류 전파를 검사했다. 전체 Node 계약 **104/104 PASS(1.4초)**. 저장소 포트 대역을 사용하므로 실제 Supabase 연동 증거가 아니다.
- `codebase-memory`의 그래프 도구를 사용할 수 없어 대상 소스 및 RLS를 직접 읽었다. `apb-unit-test-write`의 정상·경계·실패 사례 지침을 기존 Node Playwright 계약 실행기에 적용했다. `apb-playwright-e2e`의 기존 브라우저 suite 및 `apb-static-analysis` 검사를 사용했다.
- 린트 오류 0/기존 img 경고 3, production dependency audit 알려진 취약점 없음. gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1759/`.

미션 시작의 원자성, 대화 ID 없는 보관 리소스 재개, 보관 후 전체 화면 연결은 아직 검증/구현 과제다. 이번 변경만으로 전체 기획 완료나 운영 배포 준비를 선언하지 않는다. 실제 Supabase E2E는 `DEFERRED_BY_USER`이며 DB/서버 보안 suite는 이번 턴에 재실행하지 않았다.

- 최종 `CI=1 pnpm test:e2e --retries=0`: **52/52 PASS(3.6분)**, exit 0. 실제 로컬 Chromium/Pixel 7, mock 데이터·AI. 보고서: `apps/web/playwright-report/`. 기존 브라우저 회귀 검사이며 새 운영 재개 분기는 위 Node 포트 계약으로만 검사했다.
- E2E 종료 후 `pnpm typecheck && pnpm build` exit 0. 로그: `reports/static-analysis/2026-09-10-1759/typecheck-build.log`. 전체 목표는 계속 진행 상태다.

## 후속 작업: 미션 시작의 원자적 저장

- 기존 POST는 대화·실행·단계 진행을 별도 HTTP 쓰기로 처리하여 후속 쓰기 실패 시 부분 상태가 남을 수 있었다. `20260910090000_start_mission_run.sql`과 서버 adapter를 추가하고, API의 개별 쓰기들을 한 RPC 호출로 교체했다. 인증 사용자만 owner로 전달하고 반환된 실행도 소유 조회 후 응답으로 조립한다.
- RPC는 동일 owner/미션의 transaction advisory lock을 취득하여 이 경로의 시도 번호 계산을 직렬화한다. 명시적 대화는 소유 활성 컨텍스트를 잠가 검사하며 기존 실행이 있으면 고정 버전과 owner 일치 확인 후 점수/진행을 변경하지 않고 반환한다. 신규 실행에는 게시 상태·가시성·현재 버전·published_at·캐릭터 배정을 다시 확인한다. null owner인 시스템 리소스의 private 가시성도 허용하지 않는다.
- 대화가 없으면 생성하고, 실행과 모든 단계 진행을 같은 트랜잭션에 삽입한다. 첫 단계는 실제 최소 step_order다. 기존 선수 조건 trigger도 계속 적용한다. 함수 실행 권한은 service_role에만 부여하며 브라우저 직접 호출은 금지한다. migration은 아직 실서비스 DB에 적용하지 않았다.
- `tests/db/mission-start.mjs`를 기존 `pnpm test:db`에 연결했다. 15 migrations와 seed를 로드한 PGlite 검사 PASS. 마지막 단계 쓰기 실패의 전체 롤백, 기존 대화 보존과 재시도, 동일 대화 실행 재사용, 새 대화의 시도 번호 증가, 단계 초기화, 다른 owner/누락/비활성/컨텍스트 충돌, 버전 변경, 보관 뒤 실패 결과 재개, private 시스템 리소스 거부, 빈 단계/선수 조건/미배정/초안/누락 입력 거부와 server-only 권한을 확인했다.
- 테스트 스킬의 정상·경계·실패 지침을 기존 PGlite 검사에 적용했다. 그래프 도구가 없어 `codebase-memory`의 소스 fallback을 사용했다. `apb-playwright-e2e`, `apb-static-analysis`의 로컬 회귀 검사를 적용한다. PostgreSQL의 transaction advisory lock 동작은 공식 문서로 확인했다: https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS

한계: PGlite는 단일 연결이므로 실제 다중 연결 경합은 검증하지 않았다. 로컬 postgres/initdb/psql 명령도 없으며 Docker를 변경하지 않았다. 이 RPC를 거치지 않는 기존 직접 DB 쓰기에 advisory lock을 강제하지 않는다. 호출 이전에 만들어진 대화는 실패해도 남겨 재시도에 사용한다. 대화 ID 없는 호환 호출은 종료 후 재시도의 영구 멱등 키가 없다. 실제 Supabase E2E는 `DEFERRED_BY_USER`, 전체 기획 완료는 아직 아니다.

- 최종 `CI=1 pnpm test:e2e --retries=0`: **52/52 PASS(3.5분)**, exit 0. 실제 로컬 Chromium/Pixel 7, mock 데이터·AI이며 신규 운영 RPC를 브라우저에서 호출한 검사는 아니다. HTML: `apps/web/playwright-report/`.
- 전체 Node 계약 **104/104 PASS(2.5초)**. 최종 migration 트랜잭션 포함 `pnpm test:db` PASS. E2E 종료 후 `pnpm typecheck && pnpm build` PASS.
- 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 원본 로그: `reports/static-analysis/2026-09-10-1809/`. 별도 서버 보안 E2E는 이번 턴에 재실행하지 않았다.

## 후속 작업: 발견 목록과 분리한 저장 대화 화면

- 기존 화면은 캐릭터/미션의 현재 조회 결과를 먼저 요구했다. 캐릭터가 없으면 기록을 열 수 없고, 미션이 없으면 자유 대화로 내려갈 수 있었다. 명시적 conversation URL은 `SavedChatWorkspace`에서 저장 컨텍스트를 먼저 확인하고, 신규 URL은 별도 경로에서 현재 리소스를 조회하도록 분리했다. 누락된 미션/명시적 대화를 다른 대화로 대체하지 않는다.
- 서버 `/api/conversations/:id/context` 추가. UUID 검사와 세션 확인, 요청 사용자의 활성 대화 조회 후 관리자 클라이언트로 해당 대화에 고정된 캐릭터/미션 버전을 읽는다. 리소스 ID·published_at을 검증하고, 허용 별칭도 그 소유 대화의 리소스에서만 조회한다. 비공개 프롬프트·평가 설정 원문·private 자산 경로를 응답하지 않는다. 과거 이미지 매핑이 없는 아바타/보상 이미지 URL은 제외한다.
- mock 새 대화에는 Character/Mission DTO를 복사한 learningContext를 저장한다. 과거 스냅샷 없는 mock 대화는 현재 리소스로 복원할 수 있는 경우만 호환한다. saved-context 순수 정책은 대화·캐릭터·미션과 별칭의 일치를 검사하며 입력을 바꾸지 않는다. mission 쿼리를 생략해도 저장된 미션을 유지한다. 저장 대화에서 새 대화를 요청하면 신규 조회 경로로 이동한다.
- 신규 Node 계약 3개 포함 전체 **107/107 PASS(1.3초)**. 신규 브라우저 2개는 실제 생성한 학습 대화를 저장한 다음 mock 발견 저장소에서 해당 캐릭터/미션을 제거하고, 기록 링크→메시지·학습 패널 복원→mission 쿼리 없는 reload→후속 전송→동일 실행 ID 유지→잘못된 미션 URL 거부를 확인한다. 누락 대화/미션은 입력창이나 대체 대화를 만들지 않는다.
- 최초 focused 검사는 Next route announcer까지 role=alert로 선택해 신규 2개가 strict locator 실패했다. 실패 스크린샷과 오류 컨텍스트를 확인하고 실제 오류 문구로 locator를 한정했다. 기존 대화 분리 검사와 함께 focused **3/3 PASS(27.8초)**. 이 검사는 mock 목록 부재를 재현한 것이며 실제 Supabase archive 전체 연동 검사가 아니다.
- `codebase-memory`의 그래프 도구와 브라우저 MCP는 없어 소스 및 설치된 Playwright CLI를 사용했다. `apb-unit-test-write`, `apb-playwright-e2e`, `apb-static-analysis` 지침으로 정상/실패 계약, 브라우저 흐름, 정적 검사를 분리했다. 로그 경로는 `reports/static-analysis/2026-09-10-1821/`이다.

현재 서버의 이름·제목·난이도 등 기본 행 메타데이터는 별도 과거 스냅샷이 없어 최신 행에서 읽는다. 이미지 역사 복원, 실제 소유자 인증 후 서버 성공 경로, 나머지 기획 요구사항은 완료로 판정하지 않는다. 실제 Supabase E2E는 계속 `DEFERRED_BY_USER`다.

- 최종 `CI=1 pnpm test:e2e --retries=0`: **54/54 PASS(3.6분)**, exit 0. Chromium/Pixel 7, 로컬 Next mock 데이터·AI. HTML: `apps/web/playwright-report/`.
- `CI=1 pnpm test:security`: **19/19 PASS(26.7초)**, exit 0. 새 컨텍스트 API의 비로그인 401/no-store 및 잘못된 ID 400 검사를 포함한다. Supabase 주소를 연결 불가 로컬 주소로 설정한 인증 경계 검사이며 실제 Supabase E2E는 아니다. HTML: `apps/web/playwright-security-report/`, 원본 로그 `reports/static-analysis/2026-09-10-1821/security-e2e.log`.
- 보안 서버 종료 후 일반 환경에서 `pnpm typecheck && pnpm build` PASS. 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks SKIP. DB suite는 이번 턴에 재실행하지 않았다.

## 후속 작업: 게시 버전의 공개 표시 정보 보존

- 16번째 migration `20260910100000_version_display_metadata.sql`을 추가했다. 캐릭터 name/tagline/description/tags와 미션 title/summary/scenario_category/difficulty/estimated_minutes를 최초 게시 시 DB trigger로 캡처한다. 임의 클라이언트 JSON 대신 기본 행을 읽으며, 기존 게시 불변 trigger를 유지한다. 실서비스 DB에는 적용하지 않았다.
- Supabase adapter가 선택된 버전의 스냅샷을 순수 복원 함수로 검증하고 DTO에 적용한다. 미션 실행 제목도 고정 버전을 조회한다. 기존 게시 버전의 NULL에는 현재 정보만 사용하고 `metadataSource: current-resource`를 표시한다. 저장 대화는 이 한계를 안내하고 기존 실행을 유지한다. 과거 값을 추측한 backfill은 하지 않는다.
- Node 계약 **111/111 PASS(1.7초)**: 신규 4개는 두 복원 함수의 정상/누락/잘못된 버전·필드/입력 불변성을 검사한다. 기존 계약 실행기를 유지했으며 별도 테스트 프레임워크를 추가하지 않았다.
- PGlite DB suite PASS: 기존 migration+seed 다음 새 migration을 적용하여 과거 NULL 보존을 검증했다. 실제 생성/새 버전 RPC의 공개 값 캡처와 이전 값 보존, 게시 후 변경 거부, 초안의 위조 JSON 제거, 게시 UPDATE 및 직접 게시 INSERT의 DB 생성 값을 확인했다. 단일 PGlite 연결이며 실제 Supabase E2E가 아니다.
- focused 브라우저 **3/3 PASS(30.2초)**: 기록을 통한 저장 대화 복원/잘못된 URL 거부와 신규 legacy 안내 검사를 포함한다. 신규 검사는 mock 저장 컨텍스트에 provenance를 설정해 안내 문구·동일 대화 ID·미션 패널·활성 입력창을 확인한다. 서버 인증 후 실제 DB 성공 경로의 증거로 확대하지 않는다.
- `codebase-memory`의 그래프 도구와 브라우저 MCP가 없어 소스 확인 및 설치된 Playwright CLI를 사용했다. `apb-unit-test-write`의 정상/경계/실패 분류, `apb-playwright-e2e`의 focused→전체 회귀, `apb-static-analysis`의 분리된 정적 검사를 적용했다. 로그: `reports/static-analysis/2026-09-10-1837/`. 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP.

이미지 역사 매핑·보상 XP 버전 정책은 이번 변경 범위가 아니다. 실제 Supabase E2E는 `DEFERRED_BY_USER`이며 Docker 및 서버 자격 증명을 변경하지 않았다. 전체 목표는 아직 진행 중이다.

### 다음 요구사항의 소스 확인

- 최종 `CI=1 pnpm test:e2e --retries=0`: **55/55 PASS(3.7분)**, exit 0. 로컬 Next/mock 데이터·AI, 데스크톱 Chromium과 Pixel 7. HTML: `apps/web/playwright-report/`, 원본 로그: `reports/static-analysis/2026-09-10-1837/browser-e2e.log`.
- E2E 서버 종료 후 `pnpm typecheck`와 일반 환경 `pnpm build` 모두 exit 0. 로그는 같은 디렉터리의 `typecheck.log`, `build.log`다. 별도 서버 보안 suite는 이번 턴에 재실행하지 않았다.

- REF-13: `entities/chat/ui/message-content.tsx`의 `RichText`는 fenced code와 단순 pipe table을 처리하고 나머지는 일반 문단으로 출력한다. 일반 Markdown/수식을 안전하게 렌더링한다는 완료 증거가 아니므로 구현 및 실제 브라우저 회귀가 필요하다.
- REF-28: `features/chat-artifact/ui/artifact-workspace.tsx`의 `runCode`는 `evaluateArithmetic`을 호출한다. 이 제한 계산기를 일반 Code Artifact의 격리 실행 완료로 취급하지 않는다. 실행 언어/격리 경계와 output/error/recovery 사용자 흐름의 구현·검증이 남았다.

## 후속 작업: REF-13 Markdown·수식 렌더링

- 이전의 정규식 기반 `RichText`를 `entities/chat/ui/rich-text.tsx`로 분리하고 react-markdown 10.1.0, remark-gfm 4.0.1, remark-math 6.0.0, rehype-sanitize 6.0.0, rehype-katex 7.0.1, KaTeX 0.18.7을 연결했다. package manifest/lockfile에 기록했다. 제목·강조·목록·인용·취소선·링크·표·코드·인라인/블록 수식을 표시하며 표 전후 문장이 사라지던 경로를 없앴다.
- 원문 HTML은 비활성으로 유지한다. 파싱된 트리를 정제한 후 제한된 KaTeX를 실행하며 trust는 false, maxExpand는 100, maxSize는 10이다. 위험한 scheme, protocol-relative URL, 제어문자 및 역슬래시를 순수 정책에서 거부한다. Markdown 이미지와 수식의 외부 자산 요청은 허용하지 않는다. 기존 typed file 첨부 경계와 저장/복사 원문을 변경하지 않았다.
- `markdown-policy.spec.ts` 신규 2개를 포함한 Node 계약 **113/113 PASS(1.9초)**. 브라우저 없는 계약 테스트이며 URL 정책의 정상/경계/거부 사례를 확인한다.
- 신규 `rich-content.spec.ts` focused **4/4 PASS(22.7초)**. 정상 서식·MathML·표 주변 문장·원문 복사·reload, raw HTML/위험 링크/추적 이미지·수식 요청 차단, 360px 페이지 overflow 방지와 코드 영역 스크롤/focus, 실제 ReadableStream 중간 fence와 잘못된 수식 이후 정상 표시를 확인했다. 서버 AI 응답은 테스트 fixture로 대체했으며 실제 공급자/Supabase 검증이 아니다.
- 모바일 스크린샷을 직접 확인했다. 표·코드·수식이 메시지 폭 안에 표시되고 긴 코드는 별도 가로 스크롤 영역에 있다. `apps/web/test-results/`의 해당 rich-content 테스트에 스크린샷을 생성한다.
- `codebase-memory` 그래프 도구와 browser MCP가 없어 소스 및 설치된 Playwright CLI를 사용했다. `apb-unit-test-write`의 정상/실패 정책 검사, `apb-playwright-e2e`의 브라우저·스크린샷·회귀 검사, `apb-static-analysis`의 정적 검사를 적용했다. 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1847/`.

실제 Supabase E2E는 계속 `DEFERRED_BY_USER`다. 이번 변경은 REF-28의 Code Artifact 실행이나 남은 기획 전체 완료를 의미하지 않는다. 참고한 공식 문서는 개발 설계서 REF-13 절에 연결했다.

- 첫 전체 E2E는 **58 PASS / 1 FAIL(4.7분)**. 기존 mission-chat의 결과 패널 assertion이 5초 안에 나타나지 않았다. 오류 컨텍스트는 평가 중 상태, 네트워크 trace는 완료 요청 미종료였고, 직후 실패 스크린샷에는 통과 결과가 표시됐다. 이를 렌더러 실패나 근본적인 지연 해소로 단정하지 않는다.
- 미션 검사에 클릭 전 완료 응답 대기 등록→POST 응답 200 확인→응답 종료→기존 결과/보상/프로필 assertion 순서를 추가했다. 성공 기대값을 삭제하거나 timeout을 무제한 늘리지 않았다. 이후 미션+리치 콘텐츠 focused **5/5 PASS(37.6초)**. 첫 실패 로그는 `browser-e2e-first-failure.log`, trace/스크린샷은 `mission-chat-first-failure/`에 보존했다.
- 최종 `CI=1 pnpm test:e2e --retries=0`: **59/59 PASS(4.6분)**, exit 0. 데스크톱 Chromium과 Pixel 7, 로컬 Next mock 환경이다. 최종 원본 로그: `reports/static-analysis/2026-09-10-1847/browser-e2e.log`, HTML: `apps/web/playwright-report/`. 최초 실패를 최종 통과로 덮어 기록하지 않았다.
- E2E 서버 종료 후 `pnpm typecheck && pnpm build` 모두 exit 0. `typecheck.log`, `build.log`에 보존했다. DB 및 별도 서버 보안 suite는 이번 UI 변경 턴에 재실행하지 않았다. 전체 기획 목표는 진행 중이며 다음 구현 대상은 REF-28의 실제 격리 코드 실행이다.

## 후속 작업: REF-28 실제 JavaScript VM 실행

- 산술 전용 `evaluateArithmetic`을 제거하고 실행당 새 Worker/QuickJS VM을 사용하는 실행 경계와 CodeRunner UI를 연결했다. 함수·컬렉션·console·VM 내부 Promise job/반환값을 처리하고 예외 전 출력도 유지한다. 브라우저/Node eval로 사용자 소스를 평가하지 않으며 console 외에 호스트 API를 주입하지 않는다.
- 순수 정책은 소스 50,000자와 출력 12,000자/100줄을 제한한다. I/O 경계는 VM 힙 16MiB, 스택 512KiB, 실행 2초 interrupt를 적용한다. Worker 준비 15초/ready 이후 3초 timeout과 사용자 중단을 별도로 처리한다. VM 힙 제한을 전체 브라우저 메모리 상한으로 주장하지 않는다.
- 실행·중단·코드/출력 복사·준비 실패/코드 오류 재시도 UI를 추가했다. 편집·전환·닫기는 실행을 종료하고 늦은 결과를 무시한다. 저장된 코드만 reload하며 출력은 저장하거나 자동 재실행하지 않는다. 저장 busy 상태가 중단을 막지 않도록 실행 패널을 disabled fieldset 밖에 배치했다. 입력/출력은 원문 텍스트이며 HTML을 실행하지 않는다.
- 신규 Node 계약 4개 포함 전체 **117/117 PASS(4.1초)**. 코드 실행/Promise/console, 전역 상태 분리, 브라우저·네트워크·Storage·Node API 부재, console 함수 constructor 경유 시에도 host fetch 부재, 예외 전 출력, 문법 오류, 무한 루프 시간 제한, 초과 메모리 할당 거부, 출력 제한, 거부/미완료 반환 Promise를 확인했다. 이는 VM 검사이며 브라우저 Worker 테스트와 구분한다.
- 최초 개발 브라우저 focused 3개는 PASS(23.9초)였으나, production 검사를 추가하자 singlefile 변형의 VM 로더 초기화가 실패해 4개 모두 FAIL이었다. 실패 화면·trace를 확인했고, 상세 오류 및 생성 JS 문법 검사에서 octal escape가 포함된 template 문법 오류를 확인했다. 개발 통과를 배포 실행 통과로 간주하지 않았다.
- QuickJS core 0.32.0과 별도 WASM 파일 변형 `@jitl/quickjs-wasmfile-release-sync` 0.32.0으로 교체했다. 기존 singlefile 패키지는 의존성에서 제거했다. Next 번들러나 앱 보안 경계를 완화하지 않았다. 초기화 오류 메시지는 길이를 제한해 표시한다.
- `PLAYWRIGHT_PRODUCTION=1 CI=1 pnpm test:e2e code-execution.spec.ts --retries=0`: 최종 **4/4 PASS(17.8초)**, exit 0. 실제 production build→Next start→Chromium/360px에서 함수 실행, 코드/출력 복사, 저장·reload/자동 실행 부재, 호스트 접근 차단·외부 요청 부재, 예외·출력/시간 제한·복구, 중단·편집/닫기 종료, Worker 시작 실패→입력 보존→복구를 확인했다. 코드 실행 엔진은 실제 QuickJS이며 앱 데이터는 mock이다.
- 모바일 production 스크린샷을 직접 확인했다. 실행 패널과 편집 영역의 겹침을 막도록 fieldset overflow를 제한하고 패널 배경을 지정했다. 최종 스크린샷은 `apps/web/test-results-production/`의 code-execution 모바일 검사, HTML은 `apps/web/playwright-production-report/`에 있다. 최초 실패 trace/화면은 `reports/static-analysis/2026-09-10-1907/production-first-failure/`, 로그는 `production-first-failure.log`와 `production-diagnostic.log`에 보존했다.
- `codebase-memory` 그래프 도구가 없어 대상 소스를 직접 확인했다. `apb-unit-test-write`의 정상/경계/실패 계약, `apb-playwright-e2e`의 실제 브라우저·실패 분석·배포 모드 검증, `apb-static-analysis`의 정적 검사를 적용했다. 최초 린트의 예약 변수명 module과 미사용 Copy import를 수정했다. 최종 린트 오류 0/기존 img 경고 3, production audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 로그: `reports/static-analysis/2026-09-10-1907/`.

실제 Supabase E2E는 `DEFERRED_BY_USER`이며, 이번에는 DB/서버 보안 suite를 재실행하지 않았다. 실행 환경에는 DOM·외부 I/O·타이머·npm 모듈을 제공하지 않는다. 엔진 취약점 부재나 OS 수준 자원 격리는 이 검사로 보증하지 않는다. 전체 기획 완료는 아직 아니다.

### 다음 확인된 구현 과제: REF-22

`widgets/chat-workspace`는 `addToolApprovalResponse` 및 자동 후속 전송을 연결했지만, 원격 `entities/chat/api/server-generation.ts`의 `validateUserTurn`은 마지막 메시지가 user인 경우만 받아 `USER_TURN_REQUIRED`를 반환한다. `/api/ai/chat`의 인증된 경로가 이를 호출한다. 따라서 assistant 승인 응답을 소유 대화에 저장하고 이어 실행하는 서버 계약이 필요하다. mock 날씨 승인 E2E 통과를 원격 승인 연속 실행의 증거로 취급하지 않는다.

후속 소스 확인: 기존 `begin_chat_generation`은 완료된 user turn을 replay로 처리하고 재시도 시 assistant parts를 비우므로 승인 후속 요청에 그대로 재사용할 수 없다. 새 계약은 DB의 저장된 pending approval을 기준으로 소유자·대화·assistant/tool/approval ID를 검증하고, 클라이언트가 보낸 전체 assistant 본문 대신 승인/거절 결정만 병합해야 한다. 중복 결정·반대 결정·오래된 turn·동시 생성·늦은 finish를 구분하고 기존 request lease fencing을 보존해야 한다. `gatePersistedStream`의 저장 완료 전 finish 차단도 유지한다. 이 문단은 확인된 설계 제약이며 아직 구현/검증 완료가 아니다.

## 후속 검증: 신규 대화 URL 전환 중 입력 유실

- 기존 전체 E2E 실행 핸들을 재확인한 결과 **61 PASS / 2 FAIL(5.8분)**이었다. rich-content의 보안/360px 검사는 콘텐츠 응답 이전 전송 버튼 대기에서 실패했다. trace의 fill action 중 URL이 `attempt=new`에서 `conversation=...`로 변경됐고, 실패 화면에는 비어 있는 입력창과 비활성 전송 버튼이 있었다.
- 소스에서 NewChatWorkspace→SavedChatWorkspace 전환이 편집기를 재생성하는 것을 확인했다. `ResolvedChatWorkspace`는 새 시도의 canonical URL 전환 완료 전 및 원격 대화 ID 불일치 동안 준비 상태를 표시한다. 잠시 나타났다 사라지는 편집기에 첫 입력이 들어가는 경로를 막으며 원래 리치 콘텐츠 테스트 조건은 변경하지 않았다.
- 신규 회귀 검사는 MutationObserver로 `attempt=new` 상태의 편집기 노출을 감시하고, URL 대기 없이 가장 먼저 가능한 입력→입력 유지→reload 복원→전송을 검사한다. 수정 후 리치 콘텐츠+저장 컨텍스트 집중 **8/8 PASS(45.8초)**. 수정 한 줄만 잠시 되돌린 대조 실행은 `__prematureComposer: true`로 **1 FAIL**, 이후 수정 재적용. 입력 유실 자체가 매번 발생한다고 주장하지 않고 위험한 임시 편집기 노출을 결정적으로 검출했다.
- 최초 전체 실패 로그 `browser-e2e-first-failure.log`와 `rich-first-failure/`, 수정 전 대조 로그 `navigation-before-fix.log`와 동명 디렉터리, 집중 로그 `navigation-focused.log`를 `reports/static-analysis/2026-09-10-1907/`에 보존했다. 실제 browser MCP/그래프 도구가 없어 설치된 Playwright CLI·trace·스크린샷·직접 소스를 사용했다.
- `apb-playwright-e2e`의 실패 증거 확인/회귀 검사 및 `apb-static-analysis` 지침을 적용했다. 변경 후 린트 오류 0/기존 img 경고 3, production 의존성 audit 알려진 취약점 없음, gitleaks 미설치 SKIP. 최종 전체 E2E와 타입 검사/일반 빌드는 별도 결과로 기록한다.

최종 `CI=1 pnpm test:e2e --retries=0`: **64/64 PASS(4.8분)**, exit 0. 로컬 Next mock 환경, 데스크톱 Chromium 및 Pixel 7이다. 원본 로그는 `reports/static-analysis/2026-09-10-1907/browser-e2e.log`, HTML 보고서는 `apps/web/playwright-report/`다. E2E 서버 종료 후 `pnpm typecheck && pnpm build`도 모두 exit 0으로 완료했다. production 테스트용 public 환경이 아닌 일반 빌드로 산출물을 다시 생성했다.

| 검사 | 결과 | 오류/경고 | 원본 로그 (위 디렉터리 기준) |
|---|---|---|---|
| Lint | PASS | 오류 0 / 기존 img 경고 3 | `lint.log` |
| Typecheck | PASS | 오류 0 | `typecheck.log` |
| Production dependency audit | PASS | 알려진 취약점 없음 | `security.log` |
| Gitleaks | SKIP | 도구 미설치 | 실행하지 않음 |
| 일반 Next build | PASS | exit 0 | `build.log` |

이번 턴에 DB/서버 보안 suite는 재실행하지 않았다. 실제 Supabase E2E는 `DEFERRED_BY_USER`다. REF-22 등 남은 기획 요구사항 때문에 전체 목표는 여전히 진행 중이다.

## 후속 작업: REF-22 원격 승인 후속 요청과 복구

- 기존 `USER_TURN_REQUIRED` 거절 경로를 보완했다. 서버는 assistant 승인 결정만 추출해 전용 DB RPC로 전달하고, 저장된 user 이력과 승인 checkpoint를 사용해 같은 assistant ID로 AI SDK를 이어 실행한다. 클라이언트 전체 assistant 본문/입력을 저장하거나 AI 컨텍스트로 신뢰하지 않는다.
- 신규 migration `20260910110000_chat_tool_continuation.sql`: 소유자/active/최신 turn/모델, 모든 pending 승인, 중복/반대 결정, lease, 오래된 finish를 검사한다. 실패·취소 시 체크포인트 보존, 만료 작업의 동일 결정 재시도, 완료 replay, 다음 승인 단계의 이전 결과 보존을 추가했다. 일반 user 재시도로 승인 상태를 지우는 경로를 차단하고 내부 RPC 직접 호출 권한을 회수했다.
- HTTP 메시지 복원과 retry UI를 연결했다. 최신 failed/pending 승인 상태는 명시적 이어받기로 재개하고, 첫 요청이 서버에 도달하지 않았다면 저장된 pending 호출에 일치하는 로컬 결정만 재전송한다. 임의 partial answer 복원이나 user turn 중복 삽입을 하지 않는다.
- 신규 Node 계약 **6/6 PASS(679ms)**, 전체 **123/123 PASS(3.9초)**. 고유/경계/실패 입력, 저장본 우선/미도착 결정 병합, 일반 partial 응답 제외, 실제 SDK의 같은 assistant 연속 응답을 확인했다. Allow는 도구 실행 1회, Deny는 0회였다. 최초 typecheck의 테스트 변수 추론 오류를 명시적 UIMessage 타입으로 수정했으며 production build에서도 컴파일됐다.
- `pnpm test:db` **PASS**, exit 0. 기존 migration 및 신규 migration 포함 17개를 로컬 PGlite에서 적용했다. 다중 승인/거부·부정 입력·다른 소유자/모델/assistant·부분 결정 거부·rollback·실행 중 충돌·오래된 finish·실패/취소 복원·만료 회수·반대 결정 거부·완료 replay·다음 승인 단계·후속 user 이후 거부·권한을 검사했다. 단일 연결에서 실행했으며 실동시성/실제 Supabase E2E라고 주장하지 않는다.
- `CI=1 pnpm test:security` **23/23 PASS(29.7초)**, production Next build→start→Chromium. 신규 1개는 실제 서버의 미인증 승인 401/교차 출처 403, 신규 3개는 HTTP 응답 fixture 기반 허용/거부 체크포인트 reload→503→retry→결과/reload와 DB 미도착 결정의 재시도다. 클라이언트 fixture는 승인 저장 서버의 실연동 검증이 아니다. 기존 19개 인증/Proxy/오류 경계도 통과했다.
- `codebase-memory`/browser MCP가 없어 직접 소스와 설치된 Playwright CLI를 사용했다. `apb-unit-test-write`의 정상/실패 사례 기준, `apb-playwright-e2e`의 실제 브라우저 확인, `apb-static-analysis`의 린트/의존성 검사를 적용했다. 로그는 `reports/static-analysis/2026-09-10-2010/`, production HTML은 `apps/web/playwright-security-report/`다.

실제 Supabase E2E는 `DEFERRED_BY_USER`다. 외부 부작용 도구의 exactly-once는 이번 계약으로 보증하지 않는다. 현재 결정적 weather 도구 외에 쓰기 작업을 추가하려면 별도 실행 결과 원장이 필요하다. 전체 기획 목표는 계속 진행 중이다.

- 후속 검토에서 tool output 도착 후 후속 문장 생성 중 Stop을 누르면 `approval-responded` UI 상태가 이미 output 상태로 바뀌어 이어받기 버튼이 사라질 수 있음을 확인했다. 승인 결정이 포함된 원격 응답의 abort 완료 시 DB 저장 상태를 다시 읽도록 보완했다. 일반 사용자 생성의 중단 경로는 변경하지 않았다.
- 실제 브라우저의 제어 가능한 ReadableStream에서 tool output과 partial text를 먼저 표시하고 Stop→저장 checkpoint 복원→이어받기 버튼 재표시를 검증했다. production 보안/HTTP suite 최종 **24/24 PASS(27.4초)**, Node 전체 재검사 **123/123 PASS(3.8초)**. `apps/web/test-results-security/tool-approval-recovery-HTT-7d2f0-utput-but-before-completion/approval-checkpoint-after-stop.png`를 직접 확인했다. 중간 온도/미완성 문장은 제거되고 승인 대기 카드와 이어받기가 보였다.
- 중단 보완 전 전체 mock E2E는 **64/64 PASS(4.8분)**로 `browser-before-stop-fix.log`에 보존했다. 최종 변경 후 전체 E2E는 별도 실행 결과로 기록한다. 린트 재검사는 오류 0/기존 img 경고 3이다.

### REF-22 최종 검증

REF-22 최종 검증: 중단 보완을 포함한 `CI=1 pnpm test:e2e --retries=0` **64/64 PASS(4.8분)**, exit 0. E2E 서버 종료 후 `pnpm typecheck && pnpm build` 모두 exit 0. 보안 테스트용 public 환경이 아닌 일반 빌드로 산출물을 다시 생성했다. 원본 로그는 `reports/static-analysis/2026-09-10-2010/`, 전체 브라우저 HTML은 `apps/web/playwright-report/`다.

| 검사 | 결과 | 오류/경고 | 로그 |
|---|---|---|---|
| Lint | PASS | 오류 0 / 기존 img 경고 3 | `lint.log` |
| Typecheck | PASS | 오류 0 | `typecheck.log` |
| Production dependency audit | PASS | 알려진 취약점 없음 | `security.log` |
| Gitleaks | SKIP | 도구 미설치 | 실행하지 않음 |
| Node 계약 | PASS | 123개 | `contracts.log` |
| PGlite DB 계약 | PASS | 17개 migration 및 계약 실행 | `db.log` |
| Production 보안/HTTP 복구 브라우저 | PASS | 24개 | `security-e2e.log` |
| 전체 mock 브라우저 | PASS | 64개 | `browser-e2e.log` |
| 일반 Next build | PASS | exit 0 | `build.log` |

### 다음 확인된 과제: PROFILE-01 학습 설정의 실제 적용

`src/app/profile/page.tsx`의 설정은 로컬 키 `lingua-profile-preferences-v1`에만 저장하며, `learnerLevel`은 입문/초급/중급 값이다. 기획 PROFILE-01의 CEFR·관심 상황·교정 선호 계약과 차이가 있다. 음성 설정은 프로필 미리 듣기의 props로 전달되지만, `chat-workspace`의 메시지 AudioPlaybackButton에는 기본 음성/속도 props가 없고 해당 컴포넌트 기본값은 marin/1이다. 따라서 “모든 학습 표현에 적용”이라는 현재 안내를 뒷받침하는 소비자 연결이 필요하다. 이는 다음 구현 대상으로 확인했으며 아직 수정하지 않았다.
