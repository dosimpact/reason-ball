# AI Usage Limit System - System Requirements

## 1. Executive Summary

| Item | Decision |
|---|---|
| Goal | AI Assistant의 토큰/비용 사용량을 platform/user 단위로 제한하고, 사용량 표시, 경고, 차단, 운영자 조정 기능을 제공한다. |
| Primary Users | AE, PO, Finance, Admin |
| Backend | FastAPI + LangGraph |
| Frontend | React. NestJS는 BFF/API gateway로 사용할지 별도 결정 필요 |
| Core Data Strategy | `usage_events`를 원본 이력(source of truth)으로 두고, `usage_capabilities`는 빠른 조회/차단용 집계 상태로 사용한다. |
| Core Modeling Decision | platform/user capability를 별도 테이블로 나누지 않고, 단일 `usage_capabilities` 테이블에서 `owner_type`으로 구분한다. |
| Hard Cap Policy | 요청 전 100% 이상이면 차단한다. 요청 후 초과한 경우 해당 요청은 완료하고 다음 턴부터 차단한다. |
| MVP Focus | user/platform hard cap, usage check/record API, progress bar, 신규 유저 자동 생성, output token 500 제한 |

## 2. Product Requirements

| ID | Area | Requirement | Acceptance Criteria | Priority |
|---|---|---|---|---|
| PR-001 | Platform Limit | 플랫폼 전체 일간/주간 사용량 한도를 관리한다. | platform daily/weekly limit을 저장하고 조회할 수 있다. | P0 |
| PR-002 | Platform Limit | 플랫폼 사용량 80% 도달 시 경고한다. | 동일 period에서 최초 1회 Slack alert가 발송된다. | P0 |
| PR-003 | Platform Limit | 플랫폼 사용량 100% 도달 시 전체 요청을 차단한다. | 모든 유저의 다음 요청이 `PLATFORM_HARD_CAP`으로 차단된다. | P0 |
| PR-004 | LLM Guardrail | 요청당 output token을 최대 500으로 제한한다. | 모든 LangGraph/LLM 호출에 `max_tokens` 또는 동등 파라미터가 500 이하로 설정된다. | P1 |
| PR-005 | User Tier | 유저를 `High Tier`, `Low Tier`로 구분한다. | tier별 weekly limit이 다르게 적용된다. | P1 |
| PR-006 | User Limit | 유저 사용량 80% 도달 시 soft warning을 보낸다. | UI toast와 Slack/email 중 하나가 발송된다. | P1 |
| PR-007 | User Limit | 유저 사용량 100% 도달 시 다음 턴부터 차단한다. | chat input이 disabled 되고 hard cap overlay가 표시된다. | P0 |
| PR-008 | Rate Limit | 유저별 rolling 10분 window에서 최대 10 queries로 제한한다. | 초과 시 `RATE_LIMITED`와 countdown이 반환된다. | P1 |
| PR-009 | Usage UI | chatbot UI에 사용량 progress bar를 표시한다. | 유저 weekly usage ratio와 remaining amount가 near real-time으로 표시된다. | P1 |
| PR-010 | Admin | PO/Finance가 사용자 limit/tier를 조정한다. | 코드 배포 없이 admin console에서 tier/limit/reset/whitelist를 수행한다. | P2 |
| PR-011 | Extension | hard cap overlay에서 instant credits extension을 제공한다. | CTA 클릭 시 고정 `+20 query` 또는 `x USD` buffer가 부여된다. | P2 |

## 3. Key Design Decisions

| ID | Decision | Rationale | Consequence |
|---|---|---|---|
| DD-001 | `usage_capabilities`는 단일 테이블로 둔다. | platform/user limit은 동일한 domain concept이다. | `owner_type`으로 `platform`, `user`를 구분한다. |
| DD-002 | `usage_events`를 source of truth로 둔다. | `user usage 합 = platform usage` 정합성을 검증할 수 있어야 한다. | current counter가 깨져도 event 기반 재계산이 가능하다. |
| DD-003 | `usage_capabilities.used_amount`는 materialized counter로 둔다. | 매 요청마다 event sum을 계산하면 느리다. | 동시성 제어와 reconciliation job이 필요하다. |
| DD-004 | 잔여량이 1%라도 요청 전 100% 미만이면 허용한다. | 호출 전 정확한 output token/USD를 알기 어렵고 UX가 더 안정적이다. | 요청 완료 후 100% 초과 시 다음 턴부터 차단한다. |
| DD-005 | platform hard cap은 user hard cap보다 우선한다. | 비용 보호가 최우선이다. | platform 100% 이후 모든 user 요청을 차단한다. |
| DD-006 | 신규 유저는 요청 시 자동 생성한다. | 현재 회원가입 flow가 없다. | 기본 tier는 `low`로 둔다. |
| DD-007 | batch reset 외에 lazy reset을 둔다. | batch 지연이 서비스 차단으로 이어지면 안 된다. | API check 시 period 만료 여부를 확인한다. |

## 4. Domain Model

| Entity | Purpose | Relationship |
|---|---|---|
| `platforms` | 플랫폼 기본 정보 | platform 1개는 n명의 user를 가진다. |
| `users` | 플랫폼 소속 사용자 정보 | user 1명은 1개 platform에 소속된다. |
| `usage_capabilities` | 현재 period의 한도/사용량 상태 | owner가 platform 또는 user다. |
| `usage_events` | 요청별 사용량 원본 이력 | 모든 successful/failed/blocked 요청을 기록한다. |
| `usage_rate_limit_events` | sliding-window throttle 판단용 요청 로그 | user별 최근 10분 요청 수를 계산한다. |
| `usage_period_snapshots` | reset 전 period 집계 snapshot | 감사/정산/리포팅에 사용한다. |
| `alert_events` | Slack/email/in-app alert 발송 이력 | 중복 발송 방지와 실패 재시도에 사용한다. |
| `capability_extensions` | instant credits extension 이력 | hard cap 예외 buffer를 추적한다. |

## 5. Data Model

### 5.1 `platforms`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | 플랫폼 ID |
| `name` | string | Yes | 플랫폼 이름 |
| `status` | enum | Yes | `active`, `disabled` |
| `created_at` | datetime | Yes | 생성 시각 |
| `updated_at` | datetime | Yes | 수정 시각 |

### 5.2 `users`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | 내부 유저 ID |
| `platform_id` | uuid/string | Yes | 소속 플랫폼 ID |
| `external_user_id` | string | Yes | 클라이언트/LangGraph에서 전달하는 유저 식별자 |
| `tier` | enum | Yes | `high`, `low` |
| `status` | enum | Yes | `active`, `blocked`, `whitelisted` |
| `created_at` | datetime | Yes | 생성 시각 |
| `updated_at` | datetime | Yes | 수정 시각 |

| Constraint | Definition |
|---|---|
| Unique user | `(platform_id, external_user_id)` unique |
| Default tier | 신규 유저는 `low` |
| Default status | 신규 유저는 `active` |

### 5.3 `usage_capabilities`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | capability ID |
| `owner_type` | enum | Yes | `platform`, `user` |
| `owner_id` | uuid/string | Yes | `platform_id` 또는 `user_id` |
| `period_type` | enum | Yes | `12h`, `daily`, `weekly` |
| `metric_type` | enum | Yes | `token`, `usd`, `query` |
| `limit_amount` | decimal | Yes | 해당 period의 총 한도 |
| `used_amount` | decimal | Yes | 현재 사용량 |
| `period_start_at` | datetime | Yes | 현재 period 시작 시각 |
| `period_end_at` | datetime | Yes | 현재 period 종료 시각 |
| `warning_threshold` | decimal | Yes | 기본 `0.8` |
| `warning_sent_at` | datetime | No | 80% 경고 발송 시각 |
| `hard_cap_reached_at` | datetime | No | 100% 도달 시각 |
| `reset_policy` | enum | Yes | `scheduled`, `manual`, `extension` |
| `created_at` | datetime | Yes | 생성 시각 |
| `updated_at` | datetime | Yes | 수정 시각 |

| Constraint | Definition |
|---|---|
| Unique capability period | `(owner_type, owner_id, period_type, metric_type, period_start_at)` unique |
| Valid usage | `used_amount >= 0` |
| Valid limit | `limit_amount > 0` |
| Usage ratio | `used_amount / limit_amount` |

| Recommended Capability | Owner Type | Period | Metric | Purpose |
|---|---|---|---|---|
| Platform daily spend | `platform` | `daily` | `usd` | 일간 비용 hard cap |
| Platform weekly spend | `platform` | `weekly` | `usd` | 주간 비용 hard cap |
| User weekly budget | `user` | `weekly` | `usd` or `token` | tier별 사용자 한도 |
| User 12h query budget | `user` | `12h` | `query` or `token` | 짧은 주기 abuse control |

### 5.4 `usage_events`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | event ID |
| `request_id` | string | Yes | idempotency key |
| `platform_id` | uuid/string | Yes | 플랫폼 ID |
| `user_id` | uuid/string | Yes | 유저 ID |
| `input_tokens` | integer | Yes | 입력 토큰 |
| `output_tokens` | integer | Yes | 출력 토큰 |
| `total_tokens` | integer | Yes | 총 토큰 |
| `usd_amount` | decimal | Yes | 추정 또는 확정 비용 |
| `model` | string | No | 사용 모델 |
| `status` | enum | Yes | `success`, `failed`, `blocked` |
| `blocked_reason` | enum | No | 차단 사유 |
| `created_at` | datetime | Yes | 생성 시각 |

| Constraint | Definition |
|---|---|
| Idempotency | `request_id` unique |
| Failed request | 비용이 없으면 `total_tokens = 0`, `usd_amount = 0` |
| Blocked request | `status = blocked`, `blocked_reason` 필수 |

### 5.5 `usage_rate_limit_events`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | event ID |
| `platform_id` | uuid/string | Yes | 플랫폼 ID |
| `user_id` | uuid/string | Yes | 유저 ID |
| `request_id` | string | Yes | 요청 ID |
| `created_at` | datetime | Yes | 요청 시각 |

| Decision | Detail |
|---|---|
| MVP | DB table로 구현 |
| Scale-up | Redis sorted set으로 교체 |
| Window | rolling 10 minutes |
| Limit | 10 queries / user / window |

### 5.6 `usage_period_snapshots`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | snapshot ID |
| `owner_type` | enum | Yes | `platform`, `user` |
| `owner_id` | uuid/string | Yes | owner ID |
| `period_type` | enum | Yes | `12h`, `daily`, `weekly` |
| `metric_type` | enum | Yes | `token`, `usd`, `query` |
| `limit_amount` | decimal | Yes | 당시 한도 |
| `used_amount` | decimal | Yes | 당시 사용량 |
| `period_start_at` | datetime | Yes | period 시작 |
| `period_end_at` | datetime | Yes | period 종료 |
| `created_at` | datetime | Yes | snapshot 생성 시각 |

### 5.7 `alert_events`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | alert ID |
| `alert_type` | enum | Yes | `platform_warning`, `platform_hard_cap`, `user_warning`, `user_hard_cap`, `user_throttle` |
| `platform_id` | uuid/string | Yes | 플랫폼 ID |
| `user_id` | uuid/string | No | 유저 ID |
| `capability_id` | uuid/string | No | 관련 capability |
| `channel` | enum | Yes | `slack`, `email`, `in_app` |
| `status` | enum | Yes | `pending`, `sent`, `failed` |
| `payload` | json | Yes | 발송 내용 |
| `sent_at` | datetime | No | 발송 시각 |
| `created_at` | datetime | Yes | 생성 시각 |

| Constraint | Definition |
|---|---|
| Duplicate prevention | `(alert_type, capability_id, period_start_at)` unique 권장 |

### 5.8 `capability_extensions`

| Column | Type | Required | Description |
|---|---|---|---|
| `id` | uuid/string | Yes | extension ID |
| `platform_id` | uuid/string | Yes | 플랫폼 ID |
| `user_id` | uuid/string | Yes | 유저 ID |
| `capability_id` | uuid/string | Yes | 대상 capability |
| `extension_type` | enum | Yes | `query`, `token`, `usd` |
| `amount` | decimal | Yes | 확장량. 기본 `+20 query` 또는 설정값 |
| `reason` | string | No | 사유 |
| `created_by` | string | Yes | 요청자 |
| `created_at` | datetime | Yes | 생성 시각 |

## 6. Core Workflows

### 6.1 Chat Request Flow

| Step | Actor | Action | Output |
|---|---|---|---|
| 1 | Frontend | User submits chat input | `request_id` 생성 |
| 2 | Backend | `/usage/check` 호출 | allow/block 판단 |
| 3 | Backend | platform/user/rate limit 확인 | `allowed=true/false` |
| 4 | LangGraph | allowed이면 agent 실행 | LLM response |
| 5 | LLM Client | output token max 500 적용 | 제한된 응답 |
| 6 | Backend | token/USD usage 추출 | usage delta |
| 7 | Backend | `/usage/record` 처리 | event insert, counters update |
| 8 | Backend | threshold crossing 확인 | alert 생성 |
| 9 | Frontend | 최신 usage state 반영 | progress bar/toast/overlay |

### 6.2 Usage Record Transaction

| Step | Operation | Requirement |
|---|---|---|
| 1 | Resolve platform/user | 신규 user면 `low` tier로 생성 |
| 2 | Insert `usage_events` | `request_id` unique로 중복 방지 |
| 3 | Increment user capability | atomic increment 사용 |
| 4 | Increment platform capability | atomic increment 사용 |
| 5 | Check 80% threshold | 최초 crossing이면 warning alert 생성 |
| 6 | Check 100% threshold | 최초 crossing이면 hard cap alert 생성 |
| 7 | Return usage summary | UI가 즉시 상태를 갱신할 수 있어야 함 |

### 6.3 Hard Cap Policy

| Scenario | Decision | User Experience |
|---|---|---|
| 요청 전 user usage >= 100% | 차단 | input disabled, hard cap overlay |
| 요청 전 platform usage >= 100% | 차단 | input disabled, platform budget overlay |
| 요청 전 usage < 100%, 요청 후 user usage > 100% | 현재 요청 완료, 다음 턴 차단 | 응답 표시 후 다음 입력 disabled |
| 요청 전 usage < 100%, 요청 후 platform usage > 100% | 현재 요청 완료, 이후 전체 차단 | 응답 표시 후 모든 유저 차단 |
| user가 whitelisted | user hard cap 예외 가능 | platform hard cap은 예외 없음 |

## 7. API Requirements

### 7.1 Public/Runtime APIs

| Method | Path | Purpose | Caller |
|---|---|---|---|
| `POST` | `/usage/check` | 요청 가능 여부 확인 | Chat backend |
| `POST` | `/usage/record` | 실제 사용량 기록 | Chat backend/LangGraph |
| `GET` | `/usage/platforms/{platform_id}/summary` | 플랫폼 사용량 조회 | UI/Admin |
| `GET` | `/usage/platforms/{platform_id}/users/{user_id}` | 개별 유저 사용량 조회 | UI/Admin |

### 7.2 Admin APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/platforms` | 플랫폼 목록 조회 |
| `GET` | `/admin/platforms/{platform_id}/users` | 플랫폼별 유저 목록 조회 |
| `PATCH` | `/admin/users/{user_id}/tier` | 유저 tier 변경 |
| `PATCH` | `/admin/usage-capabilities/{capability_id}` | limit 조정 |
| `POST` | `/admin/usage-capabilities/{capability_id}/reset` | 사용량 수동 reset |
| `POST` | `/admin/users/{user_id}/whitelist` | 유저 whitelist 처리 |
| `POST` | `/admin/users/{user_id}/extensions` | instant credits extension 부여 |

### 7.3 `/usage/check`

| Field | Value |
|---|---|
| Method | `POST` |
| Purpose | chat submit 전에 user/platform/rate limit을 확인한다. |
| Side Effect | 신규 user 자동 생성, rate limit event 기록 가능 |
| Success Response | `allowed=true`, platform/user/usage summary |
| Block Response | `allowed=false`, `blocked_reason`, message, retry info |

| Request Field | Type | Required | Description |
|---|---|---|---|
| `platform_id` | string | Yes | 플랫폼 ID |
| `external_user_id` | string | Yes | 외부 유저 ID |
| `request_id` | string | Yes | 요청 ID |
| `estimated_input_tokens` | integer | No | 입력 토큰 추정치 |

| Blocked Reason | Meaning | HTTP Status |
|---|---|---|
| `USER_HARD_CAP` | 유저 한도 소진 | 200 with business block |
| `PLATFORM_HARD_CAP` | 플랫폼 한도 소진 | 200 with business block |
| `RATE_LIMITED` | rolling window 초과 | 200 with business block |
| `USER_DISABLED` | 유저 비활성화 | 200 with business block |
| `PLATFORM_DISABLED` | 플랫폼 비활성화 | 200 with business block |

### 7.4 `/usage/record`

| Field | Value |
|---|---|
| Method | `POST` |
| Purpose | LangGraph/LLM 호출 후 실제 token/USD 사용량을 기록한다. |
| Required Guarantee | 같은 `request_id`는 한 번만 집계된다. |
| Side Effect | `usage_events` insert, user/platform capability increment, alert 생성 |

| Request Field | Type | Required | Description |
|---|---|---|---|
| `platform_id` | string | Yes | 플랫폼 ID |
| `external_user_id` | string | Yes | 외부 유저 ID |
| `request_id` | string | Yes | 요청 ID |
| `model` | string | No | 사용 모델 |
| `input_tokens` | integer | Yes | 입력 토큰 |
| `output_tokens` | integer | Yes | 출력 토큰 |
| `total_tokens` | integer | Yes | 총 토큰 |
| `usd_amount` | decimal | Yes | 비용 |
| `status` | enum | Yes | `success`, `failed` |

## 8. LangGraph and LLM Requirements

| Requirement | Implementation |
|---|---|
| Pre-check | LangGraph agent 실행 전 `/usage/check`를 호출한다. |
| Output limit | 모든 LLM 호출에 `max_tokens` 또는 `max_output_tokens <= 500`을 적용한다. |
| Prompt style | dense, structured, decision-ready summary를 선호하도록 system prompt를 조정한다. |
| Post-record | LLM response 이후 token usage를 추출해 `/usage/record`로 기록한다. |
| Error handling | LLM/API error와 usage block을 분리한다. |

| Usage Block | LLM/API Error |
|---|---|
| 정책상 정상 차단 | provider/network/model failure |
| `allowed=false` business response | exception/error response |
| UI overlay/input disabled | error toast 또는 retry UX |

## 9. Rate Limit Requirements

| Item | Requirement |
|---|---|
| Scope | user 단위 |
| Window | rolling 10 minutes |
| Limit | 10 queries |
| Block Message | `Too many requests. Please wait X minutes.` |
| MVP Storage | `usage_rate_limit_events` DB table |
| Scale Storage | Redis sorted set |
| Alert | user throttle 발생 시 Slack alert 생성 |

| Algorithm Step | DB MVP |
|---|---|
| 1 | `created_at >= now() - interval '10 minutes'` 요청 수 조회 |
| 2 | count >= 10이면 `RATE_LIMITED` 반환 |
| 3 | count < 10이면 current request event insert |
| 4 | response에 남은 quota와 retry time 포함 |

## 10. Reset and Batch Requirements

| Reset Type | Scope | Trigger | Action |
|---|---|---|---|
| 12h reset | selected capabilities | scheduled batch | snapshot 저장 후 `used_amount=0` |
| Daily reset | platform daily limit | scheduled batch | snapshot 저장 후 새 daily period 시작 |
| Weekly reset | user/platform weekly limit | scheduled batch | snapshot 저장 후 새 weekly period 시작 |
| Manual reset | admin selected capability | admin API | snapshot 저장 후 reset |
| Lazy reset | expired capability at request time | `/usage/check` | period rollover 후 check 진행 |

| Reset Step | Requirement |
|---|---|
| 1 | `period_end_at <= now()`인 capability 조회 |
| 2 | `usage_period_snapshots`에 현재 상태 저장 |
| 3 | `used_amount = 0` |
| 4 | `warning_sent_at = null` |
| 5 | `hard_cap_reached_at = null` |
| 6 | next `period_start_at`, `period_end_at` 설정 |

| Open Decision | Proposed Default |
|---|---|
| Week timezone | UTC 또는 business timezone 중 하나로 고정 |
| Week start | Monday 00:00 |
| 12h reset boundary | 00:00/12:00 기준 또는 user-independent rolling period |

## 11. Alerting Requirements

| Alert | Condition | Channel | Duplicate Rule | Priority |
|---|---|---|---|---|
| Platform warning | platform usage ratio crosses 80% | Slack `#ads-ai-cost-guard` | once per period | P0 |
| Platform hard cap | platform usage ratio crosses 100% | Slack `#ads-ai-cost-guard` | once per period | P0 |
| User warning | user usage ratio crosses 80% | in-app + Slack/email | once per period | P1 |
| User hard cap | user usage ratio crosses 100% | in-app + Slack/email | once per period | P1 |
| User throttle | user hits rolling-window throttle | Slack | configurable | P1 |

| Alert State | Meaning |
|---|---|
| `pending` | alert 생성됨, 아직 발송 안 됨 |
| `sent` | 발송 성공 |
| `failed` | 발송 실패. retry 대상 |

## 12. Frontend Requirements

### 12.1 Chatbot UX

| UI Element | Requirement | Acceptance Criteria |
|---|---|---|
| Usage status area | chat 하단 또는 side banner에 표시 | user weekly usage ratio가 보인다. |
| Progress bar | remaining weekly budget 표시 | 80% 이상이면 warning state로 표시한다. |
| Soft warning toast | 80% 도달 시 표시 | `You've used 80% of your weekly AI credits` |
| Hard cap overlay | 100% 도달 시 표시 | `AI Budget Reached, new credits to be allocated next week` |
| Chat input | hard cap/rate limit 시 disabled | 사용자가 추가 요청을 보낼 수 없다. |
| Countdown | rate limit 시 표시 | `Too many requests. Please wait X minutes.` |

### 12.2 Admin Console

| Page | UI Pattern | Capabilities |
|---|---|---|
| Platform list | Table | platform별 총 사용량, status, limit 표시 |
| Platform detail | Nested table | platform 내 user 목록 표시 |
| User detail | Detail panel | tier, usage, alerts, extension history 표시 |
| User actions | Inline actions/modal | tier 변경, limit 변경, reset, whitelist |
| Extension action | CTA/modal | instant credits extension 부여 |

## 13. Consistency, Idempotency, and Concurrency

| Concern | Requirement | Implementation |
|---|---|---|
| Duplicate usage record | 같은 요청이 중복 집계되면 안 된다. | `usage_events.request_id` unique |
| Counter race condition | 동시 요청에서 `used_amount`가 유실되면 안 된다. | atomic increment 사용 |
| Platform/user sum | user usage 합과 platform usage가 일치해야 한다. | event 기반 reconciliation |
| Batch failure | reset batch 지연이 서비스 장애가 되면 안 된다. | lazy reset |
| Alert duplicate | 같은 period에서 같은 alert가 반복되면 안 된다. | `warning_sent_at`, `hard_cap_reached_at`, unique alert key |

| Atomic Update Pattern | Example |
|---|---|
| Counter increment | `UPDATE usage_capabilities SET used_amount = used_amount + :delta WHERE id = :id` |
| Anti-pattern | read-modify-write 후 저장 |

## 14. Reconciliation Requirements

| Job | Frequency | Purpose | Action on Mismatch |
|---|---|---|---|
| Event-to-capability reconciliation | daily or hourly | `usage_events` 기준으로 current counter 검증 | capability 재계산 또는 admin alert |
| Platform-user sum check | daily or hourly | user 합과 platform counter 비교 | 차이 기록 후 event 기준 보정 |
| Alert delivery retry | frequent | failed alert 재시도 | retry count 초과 시 admin alert |
| Snapshot completeness check | daily | reset snapshot 누락 확인 | 누락 snapshot 생성 |

## 15. Implementation Plan

| Phase | Name | Scope | Exit Criteria |
|---|---|---|---|
| 1 | Core Usage Guard | `platforms`, `users`, `usage_capabilities`, `usage_events`, `/usage/check`, `/usage/record` | user/platform hard cap이 동작한다. |
| 2 | LangGraph Integration | pre-check, max output token 500, post-record | 모든 chat 요청이 usage guard를 통과한다. |
| 3 | Chat UI | progress bar, toast, input disabled, overlay | 사용자가 현재 usage와 차단 상태를 볼 수 있다. |
| 4 | Rate Limit | rolling 10-minute throttle | 10분 10회 초과 요청이 차단된다. |
| 5 | Alerting | Slack webhook, alert_events, duplicate prevention | 80%/100%/throttle alert가 발송된다. |
| 6 | Admin Console | platform/user table, tier/limit/reset/whitelist | PO/Finance가 재배포 없이 limit을 조정한다. |
| 7 | Batch & Reconciliation | reset jobs, snapshots, lazy reset, reconciliation | period reset과 정합성 검증이 자동화된다. |

## 16. MVP Scope

| Included in MVP | Deferred |
|---|---|
| 단일 또는 제한된 platform set | multi-org advanced hierarchy |
| 신규 유저 자동 생성 | full signup/user lifecycle |
| `low`/`high` tier | custom per-user pricing policy |
| user weekly limit | advanced quota marketplace |
| platform daily/weekly limit | complex budget forecasting |
| user/platform hard cap | fine-grained per-tool limit |
| usage progress bar | advanced analytics dashboard |
| `/usage/check`, `/usage/record` | full admin audit workflow |
| `usage_events` 기록 | long-term warehouse pipeline |
| output token 500 제한 | dynamic model routing |

| Conditional MVP Inclusion | Reason |
|---|---|
| Slack platform hard cap alert | 비용 리스크가 큰 환경이면 P0로 포함한다. |
| Platform hard cap | 비용 보호 목적상 MVP에 포함하는 것을 권장한다. |

## 17. Open Questions

| ID | Question | Proposed Default | Owner |
|---|---|---|---|
| OQ-001 | Platform daily USD limit 값은? | `x` | PO/Finance |
| OQ-002 | Platform weekly USD limit 값은? | `y` | PO/Finance |
| OQ-003 | High Tier weekly limit 값은? | `x` | PO/Finance |
| OQ-004 | Low Tier weekly limit 값은? | `y` | PO/Finance |
| OQ-005 | limit metric은 token, USD, query 중 무엇인가? | USD for platform, token/USD for user | PO/Engineering |
| OQ-006 | weekly reset timezone은? | UTC 또는 business timezone | Engineering/PO |
| OQ-007 | 신규 유저 기본 tier는? | `low` | PO |
| OQ-008 | Instant extension 단위는? | `+20 query` | PO |
| OQ-009 | Slack webhook secret 관리는? | env var 또는 secret manager | Engineering |
| OQ-010 | Admin auth 방식은? | internal-only MVP, 이후 SSO/RBAC | Engineering |
| OQ-011 | NestJS 역할은? | BFF/API gateway 여부 결정 필요 | Engineering |

## 18. Final Recommended Architecture

| Layer | Components |
|---|---|
| Runtime API | FastAPI usage service, LangGraph integration |
| Data | `platforms`, `users`, `usage_capabilities`, `usage_events` |
| Operations | reset batch, reconciliation job, alert retry job |
| Alerting | Slack webhook, `alert_events` |
| Frontend | React chatbot UI, React admin console |
| Optional Scale Components | Redis for rate limit, warehouse for long-term analytics |

| Principle | Rule |
|---|---|
| Source of truth | `usage_events` is the source of truth. |
| Fast read path | `usage_capabilities` is the current-state counter for check/UI. |
| Shared capability model | platform/user capability is separated by `owner_type`, not by table. |
| Cost protection | platform hard cap has priority over user-level exceptions. |
| UX | usage block is a business state, not a generic API error. |
