# LangGraph PostgreSQL 저장 설계

## LG-OSS-003 저장 경계

FastAPI는 `langgraph.json`에 등록된 graph를 lifespan에서 checkpointer와 함께 compile한다. 실제 실행 중 LangGraph가 단계별 checkpoint와 pending writes를 저장한다. Threads API는 `aget_state`, `aget_state_history`, `aupdate_state`로 상태를 읽고 수정한다. 최신 또는 지정된 checkpoint를 조회할 수 있으며 이력은 기준 checkpoint, metadata, limit으로 제한한다. `thread_id`는 스레드, `checkpoint_ns`는 서브그래프 등의 범위, `checkpoint_id`는 그 범위의 상태 버전을 식별한다.

| 소유권 | 대표 데이터 | 스키마 준비 |
| --- | --- | --- |
| LangGraph saver | checkpoints, checkpoint_writes, checkpoint_blobs | `AsyncPostgresSaver.setup()` |
| 애플리케이션 repository | assistant 및 버전, thread, run, cron, store, A2A task | `infrastructure.postgres.migrations` |
| PostgreSQL 실행 조정 | run 소유권, 수용량, thread 예약, worker lease, SSE event | `infrastructure.postgres.runtime_migration` |

repository의 thread values는 검색용 projection이다. 실행 checkpoint가 상태의 원본이며 metadata projection과 별도의 생명주기를 가진다. 등록 graph를 실행하는 경로와 별도로, 호환 API의 fallback은 주입된 saver로 직접 snapshot을 읽고 쓸 수 있다.

## 설정과 연결

`ENV_PROFILE`은 `local`, `dev`, `staging`, `production` 중 하나다. `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`와 함께 제공한다. `POSTGRES_SCHEMA`는 소문자 PostgreSQL 식별자로 기본값은 `langgraph`다. BFF와 논리 데이터베이스를 공유할 수 있으며 SEC 테이블은 `public`에 둔다. pool의 search path는 지정 schema, `public` 순이다.

한 worker의 API repository와 saver가 lifespan 단위의 Psycopg 3 비동기 pool을 공유한다. pool 설정은 `LANGGRAPH_DB_POOL_MIN=1`, `LANGGRAPH_DB_POOL_MAX=8`, `LANGGRAPH_DB_POOL_TIMEOUT=5`(초)이며 worker 수에 따라 총 연결 수가 달라진다. 기본 연결은 autocommit, dict row, prepare threshold 0이며 조정·fencing에는 명시적 transaction을 사용한다. lifespan 종료 시 manager와 pool을 닫는다. 비밀번호가 들어 있는 conninfo 전체를 로그에 기록하지 않는다.

| 실행 모드 | 기동 시 정책 | 복구 |
| --- | --- | --- |
| memory, PostgreSQL 미설정 | process-local InMemorySaver | 재시작 시 상태 소실 |
| memory + PostgreSQL, local | 앱 schema 및 saver 멱등 초기화 | 저장 상태 유지, 이전 pending/running을 interrupted 처리 |
| memory + PostgreSQL, dev/staging/production | 준비된 schema와 saver 테이블 확인 | 저장 상태 유지, 이전 pending/running을 interrupted 처리 |
| postgres | 모든 profile에서 verify-only, 사전 migration과 PostgreSQL 필수 | DB lease로 만료된 실행 회수, 실행된 run 자동 재실행 없음 |

`prepare_schema`의 public legacy table 이동과 snapshot backfill은 별도 명시적 작업이다. 일반 기동에서는 비활성이다. `postgres` 모드의 배포 명령, 버전 호환, queue 복구, 장애 응답은 [FastAPI runtime](fastapi-runtime.md#lg-oss-multi-001-postgresql-여러-worker)에 정의한다.

## LG-OSS-MULTI-001 쓰기와 삭제

PostgreSQL 조정 모드는 `FencedAsyncPostgresSaver`로 실행 owner/epoch, thread의 실행 포인터 및 lease를 같은 transaction에서 검사한다. checkpoint/pending writes의 stale owner 쓰기를 거부한다. thread 상태 수정과 직접 삭제는 control transaction에서 수행하며 활성 또는 검토로 차단된 thread에 409를 반환한다. 삭제가 허용되면 metadata와 saver checkpoint를 함께 정리한다.

애플리케이션 테이블에는 saver 테이블을 가리키는 FK나 cascade가 없다. Assistant 삭제의 `delete_threads=true`는 repository metadata 삭제 범위이며 saver checkpoint는 보존한다. memory 모드의 일반 metadata 삭제도 이 경계를 따른다. PostgreSQL 조정 모드의 무키 transient thread는 종료 후 자동 정리하며, 일반 checkpoint 보존 기간이나 별도 전역 GC는 정의하지 않는다.

## 검증과 코드

- `RUN_POSTGRES_TESTS=1 pnpm -C 3-langgraph-fast test`에서 실제 PostgreSQL 통합 검증을 선택한다. saver setup 멱등성, 시점별 상태 복원, metadata 삭제 격리를 확인한다.
- [Multiworker 검증](multiworker-validation.md)은 별도 두 OS 프로세스, 전용 PostgreSQL 및 SDK/HTTP로 fencing과 복구를 확인한다.
- 구현은 `src/server/server.py`, `src/server/graph_registry.py`, `src/server/run_manager.py`, `src/server/postgres_run_manager.py`, `src/infrastructure/postgres/checkpointer.py`, `src/infrastructure/postgres/fenced_saver.py`, `src/infrastructure/postgres/migrations.py`에 있다.
