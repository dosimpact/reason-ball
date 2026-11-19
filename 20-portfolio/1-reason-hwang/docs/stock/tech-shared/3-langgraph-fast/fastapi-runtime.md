# 자체 FastAPI graph runtime

## LG-OSS-001: 실행 범위와 registry

`server.server:app`은 2981에서 기존 HTTP API와 함께 실제 LangGraph 실행을 제공한다. `GraphRegistry`는 `langgraph.json`의 allowlist를 읽고 기존 export의 StateGraph builder를 같은 업무 node/tool로 다시 compile한다. 개발용 export는 변경하지 않는다. FastAPI 인스턴스만 lifespan의 `AsyncPostgresSaver`를 주입받는다. memory 모드에서 PostgreSQL 미설정 시 process-local InMemorySaver를 사용하므로 재시작 복구를 보장하지 않는다.

registry는 실제 input/output/state/config schema를 제공하고 graph ID별 안정적 UUID의 기본 assistant를 `if_exists=do_nothing`으로 등록한다. 저장 assistant UUID와 graph ID 양쪽을 실행 시 해석한다. assistant config/context에 요청 값을 합치고, `configurable.thread_id`와 run/graph metadata는 서버가 설정한다. 한 thread는 하나의 graph에 연결하며 다른 graph 실행은409다.

## LG-OSS-002: Task와 streaming

`LANGGRAPH_RUNTIME_MODE=memory`의 단일 프로세스 `RunManager`가 background Task, 전역 semaphore, thread별 잠금을 소유한다. `LANGGRAPH_MAX_ACTIVE=10`, `LANGGRAPH_MAX_QUEUED=10`이 기본이다. 같은 thread는 enqueue로 직렬화하며 reject는409다. 용량 초과는429 및 Retry-After다. 다른 multitask 전략·rollback 취소·resume command는422로 명시한다. 이 memory 실행 소유권 모드는 다중 worker를 지원하지 않는다. 다중 worker는 아래 PostgreSQL 모드를 명시적으로 사용한다.

`/runs/stream`은 실제 graph.astream의 values/updates/messages/custom 등 요청 mode를 전달한다. messages는 SDK용 messages-tuple로 직렬화하며 stream_subgraphs 요청 시 namespace를 event 이름에 보존한다. metadata.run_id가 먼저 오고 실패는 error event와 error run 상태, 종료는 end다. AIMessage/ToolMessage는 JSON 구조와 tool call ID·이름·상태를 보존한다. Canvas custom payload는 변형하지 않는다. 두 TA graph의 inline presentation과 별도 Canvas 동작은 유지한다.

subscriber 연결이 끊겨도 background 실행·저장은 계속한다. 명시적 cancel은 실제 Task 취소를 기다리고 interrupted로 종료하며 rollback은 하지 않는다. 동기 외부 작업 자체가 이미 시작되었다면 그 부작용까지 취소한다고 보장하지 않는다. wait/join은 shield로 실행 수명과 HTTP 수명을 분리한다.

memory 모드 stream 버퍼는 run당 기본8MiB/256events로 제한한다(`LANGGRAPH_STREAM_BUFFER_BYTES`). 단일 큰 event는 유지한다. 느린 subscriber가 버퍼를 놓치면 gap error로 최신 state 조회를 안내한다. 종료60초 후 버퍼를 해제하므로 전체 token replay는 보장하지 않는다. 완료 run은 저장된 최종 결과/state로 복구한다.

## LG-OSS-003: PostgreSQL 상태

실제 graph가 step checkpoint와 pending writes를 saver에 기록한다. state/history/update HTTP는 graph.aget_state/aget_state_history/aupdate_state를 사용하며 수동 최종 snapshot 쓰기를 실제 실행에 사용하지 않는다. thread/run/assistant metadata와 검색용 values projection은 기존 repository를 재사용한다. 활성 run 중 state 수정은409다.

memory 모드 재시작은 기존 pending/running metadata를 interrupted로 정리하며 자동 재실행하지 않는다. PostgreSQL 모드는 아래 lease 정책으로 정상 다른 worker의 실행을 보존한다. 대화와 실행 checkpoint는 PostgreSQL에서 읽는다. 개발 런타임 데이터는 이전하거나 삭제하지 않는다.

`prepare_schema`는 기본적으로 public legacy table을 이동하지 않는다. 명시적 `move_legacy_tables=True`를 사용한 별도 이전만 가능하다. lifespan의 예전 snapshot backfill도 `FASTAPI_ENABLE_LEGACY_MIGRATION=true`인 경우에만 실행한다. 일반 실행은 과거 데이터를 자동 이전하지 않는다. `FASTAPI_STARTUP_GRAPH_ONLY=true`는 Neo4j/SEC 모델링 초기화와 legacy backfill을 건너뛰되 PostgreSQL 설정·연결은 유지한다. 운영 schema 준비 정책은 기존 DB saver 문서를 따른다.

## 경계와 검증

실행 API의 사용 범위는 신뢰하는 내부 사용자의 공유 대화다. 사용자별 소유권과 인증은 제공하지 않는다. memory 모드는 단일 프로세스용이고, 명시적 postgres 모드는 아래 범위에서 여러 프로세스 실행을 지원한다. 나머지 HTTP scaffold API가 LangGraph dev와 모두 동등하다고 주장하지 않는다.

코드는 `server/graph_registry.py`, `server/run_manager.py`, `server/postgres_run_manager.py`, 기존 assistants/threads/runs 라우트에 있다. API 검증은 별도 소유 FastAPI·validator와 격리 PostgreSQL schema를 사용한다. 실제 graph stream, 취소, disconnect 후 완료, 동일 thread/용량 제한, 프로세스 재시작 복구를 검증하며 브라우저 검증은 사용자 담당이다. [Multiworker 검증 계약](multiworker-validation.md)은 PostgreSQL 모드의 검증과 남은 범위를 설명한다.

## LG-OSS-MULTI-001: PostgreSQL 여러 worker

### 모드와 배포

`LANGGRAPH_RUNTIME_MODE=postgres`를 명시해야 DB queue·소유권·SSE 공유를 사용한다. PostgreSQL 미설정·migration 누락·capacity 설정 불일치면 startup을 거부한다. DB 장애를 memory로 자동 fallback하지 않는다. 기존 memory 모드는 단일 worker용이며 PostgreSQL checkpoint를 함께 쓸 수 있다는 사실과 실행 소유권이 여러 프로세스에 안전하다는 것은 다르다.

배포 전에 모든 이전 memory worker를 drain한다. queue 소유권 열이 없는 pending/running이 남아 있으면 새 DB 모드가 startup을 거부한다. 개발 런타임 데이터는 이전·삭제하지 않는다. 다음 명령은 패키지 디렉터리에서, 사전 승인된 대상 DB에 대해 배포 단계에서 한 번 실행한다. 실제 비밀 값이나 `.env`는 커밋하지 않는다.

```sh
# 기존 baseline metadata/saver schema가 준비된 경우: queue의 additive migration만
uv run --env-file .env python -m infrastructure.postgres.runtime_migration
# 새 DB에 baseline/saver도 명시적으로 준비하는 배포 작업
uv run --env-file .env python -m infrastructure.postgres.runtime_migration --bootstrap-base
# 별도 배포 환경에서 LANGGRAPH_RUNTIME_MODE=postgres를 설정한 뒤
LANGGRAPH_RUNTIME_MODE=postgres pnpm run start --workers 2
```

worker startup에서는 baseline·saver·queue DDL이나 Neo4j/모델링 schema 초기화를 실행하지 않는다. 현재 migration은 기존 runs 원장을 확장하고 runtime_capacity/runtime_threads/runtime_workers/runtime_events를 추가한다. schema namespace와 연결·migrations 정책은 DB saver 문서를 따른다. 기존 capacity row의 limits는 migration 재실행으로 덮어쓰지 않는다. limits 변경은 모든 worker와 queued 작업을 먼저 정리한 뒤 승인된 배포 migration으로 조정하고 같은 설정으로 재기동한다.

### 전역 접수와 순서

capacity 행을 잠그고 전역10 active(reserved 포함)/10 queued를 검사한다. 숫자는 LANGGRAPH_MAX_ACTIVE/QUEUED와 배포 migration의 capacity row가 일치해야 한다. 같은 thread의 reject는409, enqueue는 FIFO이며 전체 과부하는429/Retry-After다. run 삽입·예약·thread 포인터·초기 metadata event를 한 트랜잭션으로 commit한 뒤 응답한다.

실행 가능한 동일 thread의 가장 앞선 요청만 claim하며 thread 행의 SKIP LOCKED로 잠긴 head 때문에 다른 thread를 기다리게 하지 않는다. 다른 thread 사이의 완전한 FIFO는 약속하지 않는다. LLM/외부 도구 실행 동안 DB row lock을 유지하지 않는다. 예약과 실행·취소·회수·종료는 같은 capacity→thread→run 잠금 순서를 사용한다. saver는 이 순서의 thread→run 부분만 사용한다.

stateful runs 생성·wait·stream은 body request_id 또는 Idempotency-Key를 지원한다. 같은 namespace/key와 같은 원래 요청은 기존 run, 다른 요청은409다. 키 없는 요청은 자동 중복 판별하지 않는다. 키가 있는 run이 하나라도 존재하는 thread는 transient 자동 정리에서 제외한다. 명시적 run/thread 삭제는 해당 키 보존도 끝내므로 삭제 후 재사용 방지를 무제한 보장하지 않는다. 무키 transient는 종료60초 후 소유권 제어를 통과해 metadata/checkpoint를 정리한다.

### 버전과 lease

접수 시 assistant config/context를 해석하여 저장하고 실행 graph 버전을 고정한다. 실행 시 나중에 변경된 assistant 설정으로 바꾸지 않는다. LANGGRAPH_EXECUTION_VERSION을 배포 label로 명시하거나 packaged source/graph/lock/catalog 및 모델 이름의 hash를 사용한다. 동일 version을 재사용해 서로 다른 코드를 배포하지 않는다. 같은 namespace의 worker는 같은 limits와 호환된 배포를 사용해야 한다.

worker는 시작마다 새 UUID로 등록된다. 기본 heartbeat5초·lease30초이고 DB clock_timestamp로 확인한다. owner와 epoch뿐 아니라 thread의 active_run_id/epoch도 heartbeat·checkpoint·event·최종 commit에서 검증한다. 정상 다른 worker를 startup recover가 중단하지 않는다. 만료된 실제 running/cancelling만 interrupted로 회수하며 자동 재실행하지 않는다. 미실행 queued/reserved는 호환 worker가 이어 처리한다.

호환된 살아 있는 worker가 없는 version의 queued 요청은 보존하고 metadata.runtime_blocked=execution_version_unavailable로 표시한다. owner 없는 reserved는 queued 여유 안에서만 demote한다. queue가 가득 찼으면 reservation을 유지한다. 이 경우 operator가 호환 배포를 복구하거나 명시적으로 cancel해야 하며, 새 버전으로 조용히 실행하거나 queued10/전체20 한도를 초과하지 않는다.

### Checkpoint fencing과 control

FencedAsyncPostgresSaver는 server-only ContextVar authority(run/thread/owner/epoch)를 받는다. checkpoint·blob·pending-write는 thread/run 잠금과 실제 write를 같은 connection/transaction에서 처리하고 write 전후 DB 시각·소유권을 검사한다. 클라이언트 configurable의 token을 신뢰하지 않으며 오래된 owner는 write를 rollback한다.

state update·thread/run delete·metadata patch는 같은 control transaction을 사용한다. adapter에 이미 잠근 connection을 전달하여 새 pool connection으로 자기 lock을 기다리는 deadlock을 피한다. 활성/queued 작업이나 검토 필요 상태에서는409다. 읽기와 검색은 metadata repository와 saver의 DB 값을 사용하고 메모리 dict를 권위로 삼지 않는다.

### 취소와 불명확한 외부 효과

어느 worker에서든 cancel 의도를 DB에 commit한다. 미실행 작업은 원자적으로 interrupted, 실행 중이면 owner가 polling으로 실제 Task를 취소한다. wait 요청은 제한된 종료 대기를 하며 아직 진행 중이면202/Retry-After와 pending/running을 반환한다. cancel-first success-later는 성공과 결과 게시를 차단하고, 이미 성공한 뒤 cancel은 no-op이다. 실패·중단은 기존 thread.values projection을 덮지 않고 마지막 유효 checkpoint는 읽을 수 있다.

외부 쓰기 가능/unknown graph가 실패·중단·lease 만료되면 thread를 review 필요로 막는다. 기본 read-only allowlist 밖의 새 graph도 보수적으로 분류한다. 명시적 `POST /threads/{id}/runtime/review` body acknowledge=true/reason(1..500자)로 확인하기 전 후속 queued 실행을 보류한다. 외부 비용·쓰기를 rollback하거나 exactly-once 외부 효과를 보장하지 않는다.

### Durable event와 연결 예산

실행 worker는 최대50ms/32개 단위로 event를 묶고 DB commit 후 전달한다. sequence는 run row에서 할당하며 terminal/status/result/end는 같은 transaction에 commit한다. checkpoint가 있다는 이유로 commit 전 죽은 run을 success로 올리지 않는다.

어느 worker의 SSE도 DB cursor 이후를 읽는다. 전용 LISTEN connection은 run ID만 담은 NOTIFY를 hint로 사용하고, reconnect 때 구독자를 다시 깨운다. stream revision으로 알림과 DB 조회 사이 lost wake를 막으며 기본1초 polling이 보완한다. subscriber는 DB connection을 계속 점유하지 않는다. 현재 read는 짧은3 SELECT snapshot이다.

기본8MiB/256 event와 terminal60초 retention이다. 16MiB 초과 단일 event는 명시적 실패, retention을 넘긴 데이터는 gap error+end로 끝내며 뒤 Canvas delta를 이어 붙이지 않는다. 보존 범위의 Last-Event-ID 재연결만 제공하고 만료한 terminal은 저장된 result/state를 조회한다. 최종 result는64MiB 상한이며 초과 실패 결과를 projection에 저장하지 않는다.

worker별 기본 pool min1/max8과 LISTEN1 connection을 합쳐 `worker수 × (pool max + listener) + 배포/운영 여유`를 예산으로 잡는다. saver는 같은 pool을 공유한다. LANGGRAPH_WORKER_MAX_ACTIVE는 로컬 Task 제한이고 DB 전역 제한을 늘리지 않는다. listener 장애는 polling으로 보완하지만 DB authority 장애는 새 실행/쓰기를 멈춘다.

### 운영 조회와 범위

GET `/health/runtime`는 namespace, 전역 active/queued/reserved/running/cancelling·만료 lease·가장 오래된 대기, worker heartbeat 지연, blockedVersions, 현재 executionVersion/listener 상태를 제공한다. DB 조회 실패는503이며0으로 숨기지 않는다. run metadata.execution_version과 runtime_blocked로 막힌 배포를 식별한다. 이 namespace는 실행·용량 구분이지 다중 계정 보안 경계가 아니다.

다중 worker 보장은 `/assistants`, `/threads`, `/runs`의 graph runtime과 run-specific SSE에 한정한다. `/api/generative-ui/*`, `/api/sec-chat/prepare|chat|threads/*` 같은 별도 process-local session API는 DB 모드에서501이고 전용 단일 worker 서비스가 필요하다. legacy thread-wide stream/protocol commands/events, checkpoint copy/비삭제 prune 등 미지원 경로도501로 명시한다. 실제 `/fastapi-chat`은 이 경로를 사용하지 않고 run stream/state/history를 사용한다. 기타 FastAPI 모델링/도구 API까지 모두 동등하거나 다중 worker 안전하다고 주장하지 않는다.

제한된 신뢰 내부 사용자의 공유 대화 환경이며 새 계정별 소유권·인증 시스템은 추가하지 않는다. graceful close는 draining→claim 중지→제한 시간 대기→남은 Task 중단→listener/pool 정리 순서다. DB 오류가 발생한 shutdown도 로컬 Task/연결 정리를 시도한다. [Multiworker 검증](multiworker-validation.md)은 격리 DB와 두 OS 프로세스에서 강제 종료·DB 장애·fencing의 인수 기준을 정의한다.
