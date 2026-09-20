# LangGraph DB Saver 역기술 기획서

## 문서 목적

이 문서는 신규 구현 제안서가 아니라 `3-langgraph-fast`의 현재 코드와 테스트를 기준으로 작성한 AS-IS 역기술 문서다. 구현에서 확인되는 동작을 사실로 기록하고, 그 구현으로부터 요구사항과 설계 의도를 역으로 도출한다.

### 분석 범위

- PostgreSQL saver의 생성과 종료 생명주기
- 체크포인트 저장, 조회, 이력 탐색과 재시작 복구
- LangGraph 소유 데이터와 애플리케이션 소유 데이터의 경계
- 환경별 스키마 준비 정책과 장애 시 동작
- 현재 구현의 제약과 후속 개선 과제

### 사실과 추론의 구분

- **구현 확인**: 코드 또는 테스트에서 직접 확인되는 동작
- **설계 의도 추론**: 코드 구조와 정책으로부터 역으로 도출한 목적
- **개선 제안**: 현재 구현에는 없으며 향후 별도 결정이 필요한 항목

## 1. 결론

`3-langgraph-fast` 프로젝트는 LangGraph 상태와 체크포인트를 영속화하기 위해 PostgreSQL 기반의 `AsyncPostgresSaver`를 사용한다.

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

self.checkpointer = AsyncPostgresSaver(self.pool)
```

관련 의존성은 다음과 같다.

```toml
"langgraph-checkpoint-postgres>=2.0.0"
"psycopg[binary,pool]>=3.2.0"
```

| 구분 | 적용 기술 |
| --- | --- |
| Saver 구현체 | `AsyncPostgresSaver` |
| 데이터베이스 | PostgreSQL |
| PostgreSQL 드라이버 | Psycopg 3 |
| 커넥션 풀 | `psycopg_pool.AsyncConnectionPool` |
| 실행 모델 | 비동기 I/O |
| 주요 식별자 | `thread_id`, `checkpoint_ns`, `checkpoint_id` |

## 1.1. 역도출한 기획 배경

현재 구현을 기준으로 볼 때 이 기능의 기획 배경은 다음과 같이 정리할 수 있다.

1. LangGraph 실행 상태가 API 서버 프로세스의 수명에 종속되면 안 된다.
2. 사용자는 최신 상태뿐 아니라 특정 과거 체크포인트와 상태 이력을 조회할 수 있어야 한다.
3. FastAPI의 비동기 실행 모델을 막지 않는 저장 계층이 필요하다.
4. Assistant, thread, run 같은 서비스 메타데이터와 LangGraph 내부 체크포인트의 생명주기를 분리해야 한다.
5. 로컬 개발에서는 자동 초기화가 편리해야 하지만 배포 환경에서는 DDL 권한과 변경 절차가 통제되어야 한다.

## 1.2. 역도출한 요구사항

### 기능 요구사항

| ID | 요구사항 | 구현 근거 | 상태 |
| --- | --- | --- | --- |
| FR-01 | 스레드 상태를 PostgreSQL에 체크포인트로 저장한다. | `AsyncPostgresSaver.aput()` | 구현 확인 |
| FR-02 | 스레드의 최신 상태를 조회한다. | `aget_tuple()`에 `thread_id` 전달 | 구현 확인 |
| FR-03 | `checkpoint_id`로 과거 상태를 조회한다. | config에 `checkpoint_id` 추가 | 구현 확인 |
| FR-04 | 상태 이력을 최신순으로 제한 조회한다. | `alist(limit=...)` | 구현 확인 |
| FR-05 | 메타데이터와 기준 체크포인트로 이력을 필터링한다. | `filter`, `before` 인자 | 구현 확인 |
| FR-06 | 서버 재시작 후 DB의 체크포인트를 읽을 수 있다. | 시작 시 saver 주입 후 storage 조회 | 구현 확인 |
| FR-07 | 로컬 환경에서 saver 스키마를 멱등 생성한다. | `ENV_PROFILE=local`일 때 `setup()` | 구현 확인 |
| FR-08 | 애플리케이션 메타데이터 삭제가 saver 데이터를 연쇄 삭제하지 않는다. | FK/cascade 분리 및 통합 테스트 | 구현 확인 |

### 비기능 요구사항

| ID | 요구사항 | 설계 반영 |
| --- | --- | --- |
| NFR-01 | 비동기 API 처리 중 DB I/O가 이벤트 루프를 블로킹하지 않아야 한다. | async saver와 async connection pool 사용 |
| NFR-02 | 커넥션을 요청마다 새로 만들지 않고 재사용해야 한다. | lifespan 단위 `AsyncConnectionPool` 사용 |
| NFR-03 | 로컬 초기화는 반복 실행에 안전해야 한다. | saver `setup()` 멱등성 통합 테스트 |
| NFR-04 | 운영 환경에서 런타임의 임의 DDL 실행을 막아야 한다. | local 외 profile에서는 setup 미실행 |
| NFR-05 | 비밀정보가 로그나 문서에 노출되지 않아야 한다. | 비밀번호는 환경 변수로 주입; conninfo 로깅 금지 필요 |
| NFR-06 | 체크포인트와 서비스 메타데이터의 장애·삭제 범위를 격리해야 한다. | 스키마 소유권과 cascade 경계 분리 |

## 1.3. AS-IS 아키텍처

```text
Client
  |
  v
FastAPI Threads / Runs API
  |
  v
Runs Runtime
  |------------------------------|
  v                              v
Application Repositories         AsyncPostgresSaver
(assistant/thread/run 등)        (checkpoint/write/blob)
  |                              |
  |-------- AsyncConnectionPool -|
                 |
                 v
             PostgreSQL
```

`Runs Runtime`이 API 모델과 LangGraph saver 형식 사이의 어댑터 역할을 한다. 애플리케이션 repository와 saver는 같은 pool을 사용하지만, 테이블 소유권과 삭제 정책은 서로 독립적이다.

PostgreSQL 논리 데이터베이스는 BFF와 동일한 `sec_collector`를 사용할 수 있지만, 모든
LangGraph 애플리케이션 메타데이터와 saver 테이블은 `POSTGRES_SCHEMA`로 지정한 전용
`langgraph` 스키마에 저장한다. BFF의 SEC 테이블은 `public`에 남는다. pool connection의
`search_path`는 `langgraph,public`이며 repository와 saver가 같은 전용 스키마를 사용한다.

## 2. Saver의 역할

LangGraph saver는 그래프의 실행 상태를 체크포인트 단위로 저장하고 다시 읽는 컴포넌트다. 이 프로젝트에서 saver는 다음 기능을 담당한다.

- 스레드의 최신 상태 저장 및 복구
- 특정 `checkpoint_id` 시점의 상태 조회
- 체크포인트 이력 조회와 페이지네이션
- 부모 체크포인트를 이용한 상태 계보 유지
- 프로세스 재시작 후 PostgreSQL에서 상태 복원

Saver가 저장하는 대표 데이터는 체크포인트 본문, 메타데이터, 비동기 write 및 channel value blob이다. 실제 PostgreSQL 테이블의 생성과 변경은 애플리케이션 마이그레이션이 아니라 `AsyncPostgresSaver`가 소유한다.

## 3. 초기화와 연결 구조

서버가 시작되면 FastAPI lifespan에서 PostgreSQL 설정 여부를 확인하고 `PostgresRuntime`을 연다.

```text
환경 변수
  -> AppSettings.postgres_conninfo()
  -> PostgresRuntime.open()
  -> AsyncConnectionPool.open()
  -> AsyncPostgresSaver(pool)
  -> runs_runtime.set_checkpointer(checkpointer)
  -> runs_runtime.hydrate()
```

커넥션 풀은 다음 옵션을 사용한다.

```python
AsyncConnectionPool(
    conninfo=self.conninfo,
    kwargs={
        "autocommit": True,
        "prepare_threshold": 0,
        "row_factory": dict_row,
    },
    open=False,
)
```

- `autocommit=True`: saver의 setup과 개별 저장 연산이 명시적인 외부 commit 없이 동작한다.
- `prepare_threshold=0`: Psycopg의 서버 측 prepared statement 사용 방식에 영향을 주는 설정이다.
- `row_factory=dict_row`: 조회 결과를 사전 형태로 받는다.
- 하나의 비동기 pool을 saver와 애플리케이션 repository들이 공유한다.

서버 종료 시에는 checkpointer와 repository 주입을 해제하고 pool을 닫는다.

## 4. 환경별 스키마 정책

`ENV_PROFILE`은 `local`, `dev`, `staging`, `production` 중 하나여야 한다.

### local

로컬 환경에서는 시작 시 다음 초기화가 실행된다.

```python
self.checkpointer = AsyncPostgresSaver(self.pool)
if self.profile == "local":
    await self.checkpointer.setup()
```

`setup()`은 LangGraph checkpointer가 요구하는 PostgreSQL 스키마를 멱등적으로 준비한다. 따라서 로컬 DB 계정에는 `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` 권한이 필요하다.

### dev, staging, production

이 환경에서는 애플리케이션 시작 과정이 DDL을 실행하지 않는다. 필요한 saver 스키마와 애플리케이션 스키마는 배포 전에 별도 마이그레이션 절차로 준비해야 한다. 스키마가 없거나 버전이 오래되면 시작이 실패하도록 설계되어 있다.

운영 환경에서 애플리케이션 계정에 광범위한 DDL 권한을 주지 않고, 배포 마이그레이션 계정과 런타임 계정을 분리하기 위한 정책이다.

## 5. 체크포인트 저장 모델

체크포인트를 지정하는 LangGraph config의 핵심 구조는 다음과 같다.

```python
{
    "configurable": {
        "thread_id": "...",
        "checkpoint_ns": "",
        "checkpoint_id": "...",  # 특정 시점을 지정할 때 사용
    }
}
```

- `thread_id`: 대화 또는 실행 흐름의 영속 식별자
- `checkpoint_ns`: 서브그래프 등을 구분하는 체크포인트 네임스페이스
- `checkpoint_id`: 한 스레드 안의 특정 상태 버전

상태 저장 시 런타임은 LangGraph saver 형식의 체크포인트를 만든 뒤 `aput()`을 호출한다.

```python
saved_config = await checkpointer.aput(
    config,
    checkpoint,
    metadata,
    new_versions,
)
```

체크포인트에는 `channel_values`, `channel_versions`, `versions_seen`, `pending_sends` 등이 포함된다. 값이 객체가 아닌 단일 루트 값이면 `__root__` channel로 감싸 저장한다. 저장 후 saver가 반환한 canonical `checkpoint_id`를 HTTP 응답과 인프로세스 상태 인덱스에 다시 반영한다.

## 6. 읽기와 복구

### 최신 또는 특정 상태 조회

런타임은 `aget_tuple()`을 이용해 최신 체크포인트 또는 지정된 `checkpoint_id`의 체크포인트를 읽는다.

```python
item = await checkpointer.aget_tuple({"configurable": configurable})
```

저장된 `channel_values`는 API의 `values`로 변환되고, saver config는 `thread_id`, `checkpoint_ns`, `checkpoint_id`를 포함한 API 체크포인트 표현으로 변환된다.

### 이력 조회

체크포인트 이력에는 `alist()`를 사용한다.

```python
items = checkpointer.alist(
    config,
    filter=metadata or None,
    before=before_config,
    limit=limit,
)
```

따라서 메타데이터 필터, `before` 체크포인트 기반 페이지네이션, 조회 개수 제한을 지원한다.

### 재시작 후 복구

서버 시작 시 `hydrate()`가 thread/run 애플리케이션 메타데이터 캐시를 먼저 복원한다. 실제 체크포인트 상태와 이력은 주입된 `AsyncPostgresSaver`를 통해 PostgreSQL에서 읽는다. 다만 실행 중이던 락, 큐, active coordination 같은 프로세스 내부 제어 상태는 재시작 후 복원하지 않는다.

## 7. 데이터 소유권과 삭제 정책

이 프로젝트는 데이터를 두 영역으로 분리한다.

| 영역 | 소유자 | 대표 데이터 |
| --- | --- | --- |
| LangGraph 체크포인트 | `AsyncPostgresSaver` | checkpoint, write, blob |
| 애플리케이션 메타데이터 | 프로젝트 repository/migration | assistant, thread, run, cron, store, A2A task |

애플리케이션 마이그레이션에는 LangGraph checkpointer 테이블을 정의하지 않는다. 또한 애플리케이션 테이블에서 checkpointer 테이블로 외래 키나 cascade를 연결하지 않는다.

이 경계 때문에 `delete_threads=true`로 Assistant, thread, run 메타데이터를 삭제해도 LangGraph의 checkpoint, write, blob row는 보존된다. 체크포인트 삭제가 필요하다면 별도의 보존 기간과 정리 정책을 수립하여 saver 데이터에 명시적으로 적용해야 한다.

## 8. PostgreSQL 설정

필수 환경 변수는 다음과 같다.

```dotenv
ENV_PROFILE=local
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=...
POSTGRES_DB=...
POSTGRES_SCHEMA=langgraph
```

여섯 값 중 하나라도 비어 있거나 placeholder인 `your`이면 PostgreSQL이 구성된 것으로 판단하지 않는다. 연결 문자열은 내부적으로 다음 Psycopg conninfo 형식으로 만들어진다.

```text
host=... port=... user=... password=... dbname=...
```

비밀번호가 포함되므로 conninfo 전체를 로그에 출력하면 안 된다.

## 9. 장애 및 fallback 동작

- PostgreSQL 런타임 의존성을 import할 수 없으면 서버는 명확한 `RuntimeError`를 발생시킨다.
- PostgreSQL 환경 변수가 완전하지 않으면 saver가 주입되지 않는다.
- checkpointer가 없는 경우 일부 상태 API는 프로세스 메모리의 상태 인덱스를 fallback으로 사용한다.
- 메모리 fallback은 프로세스 재시작과 다중 worker 사이에서 공유되지 않으므로 영속 저장의 대체재가 아니다.
- 이 서비스는 단일 Uvicorn worker 실행을 전제로 한다. 분산 락과 worker 간 실행 조정은 saver의 책임 범위가 아니다.

## 10. 검증 방법

PostgreSQL 통합 테스트는 `RUN_POSTGRES_TESTS=1`일 때 실행된다. 테스트는 다음 사항을 검증한다.

- `setup()`을 여러 번 실행해도 안전한지
- `aput()`으로 저장한 체크포인트를 `aget()`으로 복원할 수 있는지
- Assistant 또는 thread 메타데이터 삭제가 체크포인트를 삭제하지 않는지
- 최신 체크포인트와 특정 과거 체크포인트를 모두 조회할 수 있는지

```sh
cd 20-portfolio/1-reason-hwang/3-langgraph-fast
RUN_POSTGRES_TESTS=1 pnpm test
```

## 11. 주요 코드 위치

- `3-langgraph-fast/src/infrastructure/postgres/checkpointer.py`: pool 및 `AsyncPostgresSaver` 초기화
- `3-langgraph-fast/src/server/server.py`: FastAPI lifespan에서 saver 주입과 종료 처리
- `3-langgraph-fast/src/server/runs/runtime.py`: 체크포인트 저장, 상태 조회, 이력 조회
- `3-langgraph-fast/src/infrastructure/postgres/migrations.py`: 애플리케이션 스키마와 saver 스키마의 소유권 경계
- `3-langgraph-fast/src/settings.py`: PostgreSQL 환경 변수 검증과 conninfo 생성
- `3-langgraph-fast/tests/integration/test_postgres_checkpointer.py`: saver 영속성과 삭제 격리 통합 테스트

## 12. 설계 결정 역추적

| 결정 | 선택 | 역추론한 이유 | 트레이드오프 |
| --- | --- | --- | --- |
| 저장소 | PostgreSQL | 재시작 후 복구와 일관된 영속 저장 | DB 운영과 마이그레이션 비용 발생 |
| saver | `AsyncPostgresSaver` | LangGraph 표준 체크포인트 모델과 비동기 FastAPI에 적합 | saver 버전과 스키마 호환성 관리 필요 |
| pool | lifespan 공유 pool | 연결 생성 비용 절감과 repository 공동 사용 | pool 장애가 여러 저장 기능에 동시에 영향 |
| 스키마 소유권 | saver와 앱 migration 분리 | LangGraph 내부 스키마 결합 및 cascade 사고 방지 | 백업·정리 정책을 두 영역에 각각 정의해야 함 |
| local DDL | 시작 시 자동 setup | 개발 환경 구성 단순화 | 로컬 role에 DDL 권한 필요 |
| 운영 DDL | out-of-band | 배포 통제와 최소 권한 원칙 | 배포 전 별도 migration 단계 필요 |
| saver 미구성 | 메모리 fallback | DB 없이 제한적인 개발·테스트 가능 | 재시작 및 다중 worker 영속성 없음 |

## 13. 처리 시퀀스

### 상태 저장

```text
Client -> Threads API: 상태 갱신 요청
Threads API -> Runs Runtime: add_state_persisted(...)
Runs Runtime -> In-process state: 신규 checkpoint_id 생성
Runs Runtime -> AsyncPostgresSaver: aput(config, checkpoint, metadata, versions)
AsyncPostgresSaver -> PostgreSQL: checkpoint/write/blob 영속화
PostgreSQL --> AsyncPostgresSaver: canonical config
Runs Runtime -> Thread Repository: 최신 thread values 저장
Runs Runtime --> Client: canonical checkpoint_id 반환
```

현재 구현은 saver 저장 후 thread 메타데이터를 별도로 저장한다. 두 작업을 하나의 명시적 애플리케이션 트랜잭션으로 묶는 코드는 확인되지 않으므로, 중간 실패 시 두 저장 영역의 시점이 잠시 달라질 가능성을 운영상 고려해야 한다.

### 상태 조회

```text
Client -> Threads API: thread_id (+ optional checkpoint_id)
Threads API -> Runs Runtime: state_from_storage(...)
Runs Runtime -> AsyncPostgresSaver: aget_tuple(config)
AsyncPostgresSaver -> PostgreSQL: 체크포인트 조회
Runs Runtime: saver 형식을 API 상태 형식으로 변환
Runs Runtime --> Client: values, checkpoint, metadata 반환
```

### 서버 시작과 종료

```text
Startup
  -> 환경 변수 검증
  -> pool open
  -> 앱 스키마 준비 또는 검증
  -> local인 경우 saver.setup()
  -> repository/checkpointer 주입
  -> thread/run metadata hydrate

Shutdown
  -> repository/checkpointer 주입 해제
  -> pool close
```

## 14. 인수 조건

현재 테스트와 코드로부터 다음 인수 조건을 도출할 수 있다.

- [x] PostgreSQL에 저장한 체크포인트를 동일한 `thread_id`로 다시 읽을 수 있다.
- [x] 특정 `checkpoint_id`를 지정해 과거 상태를 읽을 수 있다.
- [x] 체크포인트 이력에 limit, before, metadata filter를 적용할 수 있다.
- [x] 로컬에서 saver setup을 반복 실행해도 실패하지 않는다.
- [x] 서버를 재시작해도 저장된 체크포인트가 유지된다.
- [x] Assistant/thread/run 메타데이터 삭제가 saver 체크포인트를 연쇄 삭제하지 않는다.
- [x] saver가 없을 때 단일 프로세스 메모리 fallback이 동작한다.
- [ ] saver와 thread repository의 원자적 저장 보장이 문서화되거나 구현되어 있다.
- [ ] 체크포인트 보존 기간과 정리 작업이 정의되어 있다.
- [ ] 운영 migration 실행 절차와 rollback 절차가 정의되어 있다.
- [ ] pool 크기, timeout, retry 정책이 트래픽 기준으로 정의되어 있다.

체크되지 않은 항목은 현재 구현의 실패를 의미하지 않는다. 코드에서 정책 또는 보장을 확인할 수 없어 별도 기획 결정이 필요한 항목이다.

## 15. 리스크 및 개선 기획

### P0: 운영 전 결정 필요

1. **스키마 배포 절차**: `dev`, `staging`, `production`에서 누가 어떤 명령으로 `AsyncPostgresSaver` 스키마를 준비하는지 CI/CD 단계로 명문화한다.
2. **백업과 복구 범위**: 애플리케이션 테이블뿐 아니라 saver 소유 테이블도 같은 RPO/RTO 기준으로 백업하는지 결정한다.
3. **비밀정보 보호**: conninfo와 예외 메시지에 `POSTGRES_PASSWORD`가 노출되지 않도록 로깅 정책과 redaction 테스트를 둔다.

### P1: 신뢰성 개선

1. **이중 저장 일관성**: saver의 `aput()`과 thread repository 저장 사이에서 실패할 때의 정합성 기준을 정한다. 필요하면 재시도, reconciliation 또는 outbox 패턴을 검토한다.
2. **retention/GC**: 삭제에서 의도적으로 보존되는 checkpoint/write/blob가 무기한 증가하지 않도록 기간, 최대 버전 수, 법적 보존 요건을 정의한다.
3. **pool 정책**: 최대 연결 수, acquire timeout, statement timeout, 장애 재시도와 circuit breaking 기준을 부하 테스트로 결정한다.
4. **관측성**: 저장·조회 latency, error count, pool saturation, checkpoint row 증가율을 metric으로 추가한다.

### P2: 확장성 개선

1. 다중 worker 또는 수평 확장이 필요하면 saver와 별도로 분산 실행 조정 및 동일 thread 동시 실행 제어를 설계한다.
2. 큰 `channel_values`가 blob 크기와 조회 latency에 미치는 영향을 측정하고 payload 한도 또는 외부 object storage 분리를 검토한다.
3. saver 패키지 업그레이드 시 스키마 호환성 검증을 위한 staging migration 테스트를 자동화한다.

## 16. 핵심 요약

이 프로젝트의 DB saver는 비동기 PostgreSQL saver인 `AsyncPostgresSaver`다. FastAPI lifespan에서 Psycopg 비동기 pool과 함께 초기화되고, LangGraph 상태의 저장·시점 조회·이력 조회·재시작 후 복구를 담당한다. 체크포인트 데이터는 애플리케이션 메타데이터와 스키마 및 삭제 생명주기가 분리되어 있으므로, 운영 시에는 별도의 마이그레이션과 보존 정책을 함께 관리해야 한다.
