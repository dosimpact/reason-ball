# PostgreSQL multiworker 실행 구현과 API 검증

- 날짜: 2026-11-16
- 결정 ID: LG-OSS-MULTI-001
- 상태: 구현·API 검증·관련 단위/실PG 검사·소유 자원 정리 완료. 운영 서비스는 전환하지 않음.
- 승인 근거: 사용자 지정 LangGraph OSS 설계의 multiworker 절 구현 승인. human-docs 원문은 수정하지 않는다.

## 범위

Redis 없이 PostgreSQL을 실행 접수·전역 용량·소유권·lease·취소·이벤트·terminal 결과의 공통 기준으로 사용한다. 기존 SDK graph/input/message/OpenUI/Canvas 계약과 개발 런타임의 데이터는 유지한다. 브라우저는 사용자 방침에 따라 실행하지 않는다. 비용 있는 외부 모델·SEC 도구는 고정 fixture로 대체하며 사용자 데이터와 서비스는 변경하지 않는다.

## 검증 설계와 재사용 경계

기존 API parity의 compiled fixture 그래프, 실제 server lifespan/GraphRegistry/manager 경로, LangGraph Python SDK와 Bruno 컬렉션을 재사용한다. 단일 manager 두 개의 task를 만든 검증과 별도 OS 프로세스의 실제 app 검증은 구분한다. 필수 multiworker 판정은 별도 FastAPI 프로세스2개와 전용 PostgreSQL Docker 컨테이너에서 수행한다.

- 사전 schema/saver 준비를1회 수행하고 두 worker는 준비된 schema로 시작한다. migration을 worker마다 실행하지 않는 계약을 확인한다.
- A에서 접수/실행, B에서 상태·SSE·취소한다. 다른 정상 worker 실행 중 B 재시작이 해당 실행을 중단시키지 않아야 한다.
- 같은 thread FIFO, 서로 다른 thread 병행, 전체 worker 합계 cap/queue, idempotency 동일/상이 payload, cancel/claim/terminal 경합을 확인한다.
- SIGSTOP/SIGCONT 또는 강제 종료로 lease와 구 owner의 복귀를 분리한다. checkpoint/pending writes의 stale owner 거부는 실제 PostgreSQL로 확인하고 최종 상태 보호만으로 대체하지 않는다.
- queued만 재선점되고 이미 실행된 run은 자동 재실행되지 않아야 한다. 상태 수정·삭제와 실행 소유권의 상호 배제도 확인한다.
- DB 연결 중단, NOTIFY 누락·listener 재연결의 polling 보완, 이벤트 cursor/gap, terminal 결과와 end의 원자성을 확인한다.
- 기존 SDK values/messages/tool IDs/custom namespaces와 OpenUI/Canvas ready payload를 확인한다. fixture 모델·도구를 사용한 결과를 외부 모델 품질 검증으로 주장하지 않는다.

## 자원 소유와 초기 상태

현재는 테스트 서버나 DB를 생성하지 않았다. 이후 전용3981/3982와 필요 시 validator3183, 무작위 이름의 소유 PostgreSQL 컨테이너와 임시 artifact 경로를 기록한다. DB 장애 실험은 해당 컨테이너에만 수행하고 공유 PostgreSQL 연결은 종료하지 않는다. 성공·실패·중단 모두 finally로 정리하고 PID/포트/컨테이너/임시 설정 부재를 확인한다.

기존 dirty 상태의 Host route/테스트·Next 설정·TA stock·human-docs 증거를 보존한다. 검증 담당은 커밋하지 않는다. 실행한 증거와 미검증 항목은 구현 freeze 후 이 새 flow에 누적한다.

## 문서와 스킬

- [공용 검증 설계](../stock/tech-shared/test-design.md)
- [FastAPI 런타임 stock](../stock/tech-shared/3-langgraph-fast/fastapi-runtime.md)
- [검증 자원 정리 정책](../validation/INDEX.md#val-cleanup-001)
- Bruno: `../../.agentic-playbook-rc/apb-bruno-api-tests/SKILL.md`
- PostgreSQL: `/Users/studio/workspace/projects/reason-ball/.agents/skills/supabase-postgres-best-practices/SKILL.md`

## 최종 구현과 검증 결과

PostgreSQL mode의 접수·예약·claim·FIFO·전역 cap·idempotency·owner/epoch/lease·취소·위험 thread review·이벤트·terminal 결과를 구현했다. saver의 checkpoint/pending writes/control 쓰기는 같은 DB transaction의 guard로 보호한다. 사전 migration만 DDL을 수행하고 worker는 verify-only다. 사용자 production 서비스나 환경 설정을 전환하지 않았으며 기존 memory/dev runtime을 임의로 종료하지 않았다.

검증은 하나의 전체 성공 횟수로 중복 합산하지 않고 다음처럼 구분한다.

| 검증 층 | 결과 |
| --- | --- |
| 실제2OS HTTP/SDK 인수 묶음 | 아래13묶음 PASS |
| Bruno | 27-fastapi-multiworker의11 requests/11 tests/11 assertions PASS |
| 독립 saver/events/생산 queue 단위·실PG | 담당 agent 최종24 PASS; 독립 컨테이너와 정리 증거 수신 |
| 기존 API/settings CPU 회귀 | 담당 backend20 PASS; 위24와 다른 파일 묶음 |
| 운영 preflight | 동시 첫 A/B startup PASS, 공식 migration CLI2회 PASS, health/runtime GET PASS |
| 브라우저 | 사용자 API-only 예외로 미실행; 브라우저/Playwright/공유 MCP 연결 생성0 |

### 실제2OS API/SDK13묶음

1. PID A가 실행 중일 때 B를 시작하고 B에서 state/SSE/cancel: 정상 A를 startup recover로 중단시키지 않으며 실제 취소 뒤 interrupted 유지.
2. 같은 thread FIFO/reject409, 서로 다른 thread 병행, 전 worker 합계 active2+queued2 및 초과429/Retry-After. 기본10/10 부하 시험으로 표현하지 않는다.
3. A/B 동시 같은 idempotency key는 같은 run ID와 한 번의 fixture 수행, 상이 payload409.
4. 현재 등록11개 실제 graph의 모든 schema, 실제 Python SDK error stream→저장 checkpoint/tool ID 복원→다음 turn 성공. 실패한 실행을 자동 재시도하지 않는다.
5. claim/cancel 경합5회, 활성 state/delete409, idle cross-worker state 수정·삭제와 checkpoint 정합성.
6. 가장 오래된 thread row lock이 있어도 다른 thread가 SKIP LOCKED로 진행.
7. 위험 효과 fixture의 interruption은 blocked thread와 queued 보류, 명시적인 runtime/review 이후에만 진행.
8. OS SIGSTOP→lease 만료→queued 재개→구 owner SIGCONT. 실제 생산 guard를 사용해 옛 authority의 checkpoint·pending writes를 직접 거부하고 기존 저장 row 보존을 확인.
9. 실행 owner SIGKILL/restart 후 running은 interrupted·시작 횟수1, queued만 한 번 수행.
10. B LISTEN을 끈 상태의 DB 조회/cursor, byte/event retention, gap error+end, TTL 뒤 저장 values/end 복원.300개40KB 이벤트의 실제 보존은217개/8,381,083bytes로8MiB/256 이내였다. TTL 경계는 소유 run의 updated_at을61초 전으로 조정해 검증했다. 실시간 lost-wakeup/reconnect/NOTIFY는 별도 실PG/단위 결과와 구분한다.
11. 소유 PostgreSQL container stop/start 동안 신규 접수503, 메모리 fallback 없음. DB 복구 뒤 running 자동 재시도0, queued 보존·한 번 재개.
12. terminal end INSERT에 소유 DB trigger 지연을 넣고 commit 직전 owner SIGKILL. status/result/end 부분 반영이 없고 lease 회수 후 interrupted/end1. 완료 checkpoint가 있어도 성공으로 승격하지 않음.
13. 실제 Canvas workflow에 고정 Spy model/OHLCV를 주입: SDK A 생성/B join_stream에서 UUID report의 validating→ready,9958자 OpenUI Host parser valid, 저장 report 동일, Spy1회. 외부 LLM/Yahoo 호출0이며 실제 모델 품질 증거가 아니다.

Bruno는 두 worker의 graph discovery/thread/run/join/SSE/tool ID/namespace/idempotency/delete와 DB mode의 미지원 thread stream/event-bus/commands501을 별도로 확인했다. 가짜 메모리 성공 응답을 허용하지 않는다.

운영 preflight는 `python -m infrastructure.postgres.runtime_migration --bootstrap-base` 다음 같은 module의 무flag 실행으로2회 정상 종료한 뒤 production profile worker를 부팅했다. 동시 첫 두 worker의 assistant seeding도 성공했다. 최종 `/health/runtime`은 mode postgres, namespace qa-multi, executionVersion qa-v1, limits2/2, active/queued0, blockedVersions 배열, live workers2를 확인했다. 이는 운영 서비스 활성화나 실제 production DB migration 증거가 아니다.

### 발견과 수정

- 잠긴 선두 thread가 다른 thread claim을 막을 수 있는 후보 선택을 실제 SKIP LOCKED 후보 조회로 조정했다.
- 활성 thread control의 쓰기는 차단됐지만 예외가 HTTP500으로 노출됐다. HTTP control context에서만409 thread_control_conflict로 매핑한 뒤 실제 API를 재확인했다. 실행 fencing 예외와 DB 오류를409로 위장하지 않는다.
- 동시 첫 assistant seed의 없는-row 경쟁을 처리했다.
- 별도 실PG 검증에서 thread epoch 변경 후 heartbeat/terminal, late cancel result, publish/claim/heartbeat/finish의 write 이후 lease 만료 rollback을 보완했다. 후속 정상 API13묶음을 불필요하게 반복하지 않고 해당 실PG 경합 회귀로 확인했다.
- 첫 custom assertion은 input values를 받고 너무 일찍 취소한 fixture 문제였다. 실제 namespaced custom 수신 후 취소하도록 수정했다. idle state POST는 공식 checkpoint-only 응답이며 이후 GET으로 값을 확인했다.
- Docker의 동적 빈 HostPort 매핑이 stop/start 때 바뀌는 현상을 별도 소유 probe로 확인했다. 장애 시험은 고정된 소유 임시 host port로 교체했다. 이를 제품 DB 복구 오류로 기록하지 않는다.

### 관련 단위·정적 증거

Backend 명령 `pnpm -C 3-langgraph-fast test tests/server/test_postgres_runtime_contract.py tests/server/test_threads_runs_api.py tests/server/test_assistants_api.py tests/test_settings_postgres.py -q`는20 PASS다. backend 소유 파일 Ruff/Pyright도 PASS(0 errors/0 warnings) 보고를 받았다.

별도 담당24개는 adapter/event unit, test-guard 실제PG, 생산 RuntimeQueue 실제PG 및 notification/lost-wakeup/reconnect를 포함한다. test guard의 원자성 증명과 생산 queue guard 검증을 같은 증거로 취급하지 않는다. 최종 postlease/fullqueue 추가5건도 포함된 수치다. 실제PG test container는 담당자가 별도로 삭제하고 schema/port 부재를 확인했다.

검증 담당의 driver/fixture Ruff와 task diff check도 PASS다. 브라우저·실제 외부 모델·production 서비스 전환·production 데이터 품질은 확인한 것으로 주장하지 않는다.

## 재현과 증거 위치

```sh
pnpm -C 3-langgraph-fast test:multiworker:api
MULTIWORKER_PREFLIGHT=concurrent pnpm -C 3-langgraph-fast test:multiworker:api
# 이미 통과한 앞 단계를 반복하지 않고 특정 장애 단계부터 조사
MULTIWORKER_START_AT=database_disconnect pnpm -C 3-langgraph-fast test:multiworker:api
```

로컬 evidence JSON/worker/Bruno 로그는 `/var/folders/mt/kwf9rfcx09g46g_8lltsq3100000gn/T/fastapi-multiworker-*/`에 보존하며 커밋하지 않는다. 대표 artifact suffix: core/Bruno11 `_c7xubb3`, controls/lease/fence/retention `bvaug4e6`, DB/terminal `4wsig7qx`, Canvas+공식migration `x1votaab`, 최종health/동시startup `zkiqj8vi`. 실패한 시도의 로그도 원인 구분을 위해 보존한다. 단일 full-run PASS로 꾸미지 않고 통과한 focused execution을 위처럼 연결한다.

## 최종 정리와 남은 경계

모든 실행의 finally가 소유 worker와 parser를 종료하고 전용 DB container/volume을 삭제했다. 최종 검사에서 소유 container11개 모두 docker inspect 부재,3981/3982/3193 listen 부재, 마지막 PID89312/89313 및 parser87738와 worker87708/87722 부재를 확인했다. Docker 동적-port 조사용 probe도 자체 finally로 삭제했다. 사용자 PostgreSQL·서비스·브라우저·공유 MCP는 종료하지 않았다.

parser는3193과 고유 `.next-multiworker-41158342`를 사용했다. 기존 dirty next-env/tsconfig를 시작 전에 보존했고 자신의 include·route reference만 되돌렸다. parent 종료 직후 child가 trace를 늦게 재생성한 것을 추가 검사에서 발견해, 소유 process group 부재 확인 후 해당 exact 디렉터리만 다시 제거했다. driver도 자식 group 종료를 기다린 후 cache를 지우도록 보완했다. 최종 own cache/reference 부재를 확인했다. 관련 없는 Next 설정 변경은 보존한다.

운영 배포는 별도 drain/migration/worker 전환 절차가 필요하다. 이번 작업은 코드를 구현·검증했으며 사용자 운영 runtime을 다중 worker로 전환하지 않았다. 검증 담당은 stage/commit하지 않는다.
