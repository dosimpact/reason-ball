# LEARN-04 단계별 힌트 구현 설계 감사

2026-09-11. 읽기 전용 구현 감사이며 실행 검증이나 완료 판정이 아니다. 웹 프로젝트는 MCP 그래프에 인덱싱되지 않았다. 부모의 Verify 조사와 이 감사의 exact-path coverage 요청 모두 `project not found or not indexed`였으므로 아래 근거는 직접 소스 읽기다. 브라우저·테스트·원격 DB를 실행하거나 변경하지 않았다.

## 요구와 현재 증거

- 비즈니스 문서 11.4는 **의도 → 핵심 표현 → 사용자 상황이 반영된 완성 문장**과 **자립 완료/도움을 받은 완료의 구분 및 다음 학습 추천**을 모두 요구한다. 단순히 세 개의 동일한 힌트 탭으로 바꾸면 충족하지 못한다.
- `src/widgets/chat-workspace/model/mission-guidance.ts`의 `buildMissionGuidance`는 실행 단계 ID를 작성자 정의와 맞추고 단일 `hint`를 노출한다. `ui/mission-guidance-panel.tsx`는 단계 선택·열기·초안에 추가만 제공한다. `ui/chat-workspace.tsx`의 `/hint`도 패널만 연다.
- `src/shared/api/learning/contracts.ts`의 MissionStep/MissionObjective에는 문자열 `hint`만 있다. `supabase/schema.sql`의 `mission_steps.hints`는 JSON 배열이나 게시 함수는 단일 작성자 힌트를 배열 원소 하나로 저장한다. 현재 배열을 깊이별 계약으로 해석할 근거가 없다.
- `src/app/api/mission-runs/_lib/production.ts`는 고정된 `mission_version_id`로 단계와 평가를 복원한다. `mission_step_progress`에는 시도/근거/피드백은 있지만 힌트 사용 기록이 없다. `src/entities/mission-run/model/types.ts`와 평가 복원에는 도움 여부 필드가 없다.
- `tests/e2e/mission-guidance.spec.ts`는 mock 단계 선택·초안 보존·좁은 화면·ID 불일치를 확인한다. `tests/e2e/live/learning-help.spec.ts`와 `legacy-learning-help.spec.ts`는 실제 일반 문장 교정/쉽게 바꾸기/답변 추천을 확인하지만 11.4의 세 깊이와 완료 구분을 증명하지 않는다.

## 권장 구현 경계

### 서버가 고정 실행 문맥으로 깊이별 도움 생성

새 `src/entities/mission-run/model/mission-hint.ts`에 strict 요청/응답 스키마를 두고, 새 `src/app/api/mission-runs/[id]/hints/route.ts`에서 소유한 활성 실행과 활성 대화, 실행 버전에 속한 stepId를 확인한다. 입력은 run 경로 + stepId/depth/requestId만 허용한다. 사용자 ID, 성공 조건, 자유로운 대화 텍스트나 완료 여부를 브라우저에서 받지 않는다.

서버가 고정 미션·캐릭터 버전, 해당 단계의 학습자용 목표/작성자 힌트, 학습 수준, 실제 저장된 최근 완료 메시지를 읽어 해당 깊이 하나를 생성한다. 의도는 해야 할 말의 목적, 핵심 표현은 빈칸을 포함할 수 있는 짧은 영어 패턴, 완성 문장은 실제 대화의 이름/날짜/선호 등에 맞는 문장이어야 한다. 문맥 정보가 없는 경우 이름/예약번호를 사실처럼 발명하지 말고 필요한 부분을 표시한 예시라고 설명한다. 세 깊이를 응답에 모두 넣고 CSS로 숨기면 깊이별 제공/사용 의미가 흐려지므로 선택한 깊이만 반환한다.

기존 `src/app/api/ai/learning-assistance/route.ts`의 인증·Origin·사용자별 rate limit·AI 관측/오류 패턴과 `entities/learning-assistance/api/server-context.ts`의 소유 대화 확인 패턴을 재사용한다. 그 context loader는 messageId 필수인 일반 도움용이므로 첫 발화 전 미션 힌트에 그대로 사용하지 않는다. 공개 작성자 힌트와 AI 생성 도움을 구분해 표시한다.

### 최소의 신뢰 가능한 영속 모델

새 마이그레이션 하나에 다음을 묶는 안을 권장한다. 실제 SQL 작성/적용 전에 최신 Supabase 문서와 보안 가이드를 다시 확인한다.

1. 실행별 도움 요청 테이블 `mission_hint_requests`: UUID requestId, runId, stepId, depth(1..3), 문맥 기준 메시지 ID/순서, 생성 결과, 생성 시각. 실행 FK는 삭제 cascade, 조회 인덱스는 `(run_id, created_at, id)`. 성공한 요청은 저장 후 동일 requestId 재시도에 같은 결과를 반환한다. 동일 ID의 다른 실행/깊이 충돌은 409. 제공 결과/문맥은 클라이언트가 쓰거나 수정하지 못한다.
2. `mission_runs`에 추적 개시 기준(예: nullable `hint_tracking_started_at`)을 추가한다. 기존 실행은 NULL로 두고 이후 생성되는 실행에만 기본값을 적용한다. 기존 실행을 지금 시각으로 일괄 채워 독립 수행으로 판정하지 않는다.
3. 새 테이블은 RLS 활성화, 본인 실행 조회만 허용하고 anon/authenticated의 변경·TRUNCATE·RPC 실행 권한은 명시적으로 차단한다. 서버 전용 저장 함수는 실행 소유자/고정 step 버전/대화 활성 상태를 재검사하며 서비스 역할만 호출 가능하게 한다. 기존 `mission_step_progress`의 일반 UPDATE 권한에 새 추적 컬럼을 끼워 넣으면 사용자 조작 가능성을 별도 통제해야 하므로 피한다.

기존 JSON `mission_evaluations.feedback`에 서버 계산 `assistance` 스냅샷을 저장하면 평가 테이블 컬럼 추가는 불필요하다. `tracked/unknown`, 요청한 단계·최대 깊이·횟수, 평가 기준 시각을 포함한다. 생성 실패는 성공한 도움 요청으로 기록하지 않는다. 저장 후 응답 유실은 재시도로 복원하며, UI 표현은 실제 화면 열람을 증명하는 `열람 횟수`가 아닌 **힌트 요청 기록 기준**으로 한다.

평가가 본 대화 스냅샷과 도움 집계 기준을 명시적으로 고정한다. 이후 힌트 열기나 재평가가 과거 평가의 자립/도움 표시를 소급 변경하지 않아야 한다. 추적 전 기록이 있으면 `기록 없음`으로 표시하고, 추적 시작부터 확인되는 실행의 도움 요청 0개만 `자립 완료`로 부른다. 힌트가 있으면 `도움을 받아 완료`로 표시하되 점수·통과 기준·보상/XP를 깎지 않는다. 이는 관찰된 도움 요청의 구분이며 실제 능력이나 외부 도움 부재를 증명하지 않는다.

### UI 및 결과 연결

- `mission-guidance-panel.tsx`: 선택한 단계에 세 깊이를 순서대로 요청/보기, 요청중·실패·재시도, 영어 문장 초안 추가. 패널 열기나 단계 미리보기만으로 AI 호출하지 않는다. 이미 본 깊이는 GET 복원한다. 입력 초안을 덮어쓰거나 자동 전송/목표 완료하지 않는다.
- `chat-workspace.tsx`: 실행/단계/깊이별 상태와 안정적인 requestId; 이동/실행 변경 시 이전 응답 무시, HTTP 환경 UUID 유틸 사용. 완료 이후 복습 도움은 과거 평가 집계에서 제외한다.
- `src/entities/mission-run/model/types.ts`, `_lib/production.ts`, `src/app/api/ai/evaluate/route.ts`: DTO와 엄격한 구형 복원, AI가 도움 여부를 판정하지 않고 서버가 확정한다.
- `features/mission-reward/ui/mission-result-panel.tsx`: 평가에 고정된 수행 유형 및 도움 깊이 표시. `features/mission-reward/ui/next-mission.tsx`와 model selector에는 완료 유형을 전달하여 도움받은 목표의 독립 재연습 안내를 우선 제공하면서 적격 다음 미션 링크도 유지한다. 재연습은 기존 재도전 경로로 별도 attempt를 생성해야 한다.

## 실 환경 완료 증거

`tests/e2e/live/mission-hint-depth.spec.ts`를 새로 두고 외부 URL, 실 Supabase, 실제 OAuth AI, worker 1로 실행한다. 최대 한 브라우저 내 순차 컨텍스트만 사용한다.

1. 실제 게시 미션의 소유 실행과 대화에 사용자 상황(예: 이름과 숙박 일수)을 저장한다. 세 깊이 각각 실제 요청 결과/형태/문맥 일치와 UI·DB 일치를 확인한다. 기존 초안·메시지·목표 상태·보상 불변도 비교한다.
2. 응답 유실 후 동일 ID 재시도·새로고침에서 저장된 결과 하나를 복원하고 추가 AI 성공 기록/도움 행이 생기지 않는지 확인한다. 실패 화면만 테스트할 때는 오류 주입임을 명시한다.
3. 실제 평가/완료 뒤 도움받은 완료와 깊이/다음 독립 재연습 안내를 확인한다. 재도전한 별도 실행에서 힌트 없이 실제 완료하여 자립 완료를 확인한다. 두 시도 모두 정상 통과/보상을 유지하고 동일 이미지가 중복 해금되지 않는지 확인한다.
4. 이전 버전 실행 중 작성자가 새 미션 버전을 게시해도 원래 단계/상황이 유지되는지 확인한다. 타인 run/다른 버전 step/위조 depth·문맥은 거절하고 Supabase JWT 직접 변경도 거절한다.
5. 과거 평가 feedback에 assistance가 없는 소유 레거시 fixture는 `기록 없음`이어야 한다. 평가 후 힌트 요청 및 새 평가가 이전 평가 집계를 바꾸지 않는지 확인한다.

서버 맥락/스냅샷·보안과 UI/실 E2E를 서로 분리해 소유 범위를 정하면 병렬 구현 가능하다. 현 상태 LEARN-04는 계속 PARTIAL이다. 이 문서는 구현이나 실제 E2E 통과를 대신하지 않는다.


## 후속 구현·검증

이 문서의 PARTIAL은 구현 전 감사 시점의 판정이다. 후속 구현과 실제 외부 E2E 결과는 `2026-09-11-live-e2e-progress.md`의 “3단계 힌트와 도움 사용 기록 실연동”에 기록했다. 레거시 unknown은 DB migration fixture/Node SSR와 원격 기존 NULL 보존으로 확인했으며, 실제 사용자 레거시 데이터를 변경한 브라우저 검증으로 주장하지 않는다.
