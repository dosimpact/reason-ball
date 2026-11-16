# Multiworker 실행 검증 계약

결정 ID: LG-OSS-MULTI-001. 구현·운영 설정의 원본은 [FastAPI runtime](fastapi-runtime.md)과 DB saver 문서를 따른다. 이 문서는 검증 경계와 재현 방법의 원본이다. 실행 결과는 [구현·검증 flow](../../../flow/2026-11-16-fastapi-postgres-multiworker-implementation.md)에 기록한다.

## 실제 경로와 격리

`pnpm -C 3-langgraph-fast test:multiworker:api`는 전용 PostgreSQL16 컨테이너와 별도 OS 프로세스의 FastAPI2개를 사용한다. 작업 요청·소유권·lease·DB 이벤트·fenced saver·HTTP 라우트는 정식 `server.server:app` lifespan과 생산 구현이다. test-only GraphRegistry subclass가 dispatcher 시작 전에 고정 graph/model/tool을 등록하며 manager나 저장소를 가짜 구현으로 교체하지 않는다.

schema는 공식 `python -m infrastructure.postgres.runtime_migration --bootstrap-base`로 준비하고 같은 module을 다시 실행해 멱등성을 확인한다. worker는 production profile의 verify-only 경로로 부팅한다. 테스트 전용 용량은 전 worker 합계 active2/queued2, worker별 실행1, lease3초/heartbeat0.5초다. 기본 운영10/10 전체를 부하 시험한 결과로 일반화하지 않는다.

컨테이너는 중단/재시작에도 같은 host port를 유지하도록 비어 있는 loopback port를 명시적으로 매핑한다. Docker의 빈 HostPort 동적 매핑은 restart 때 바뀔 수 있으므로 장애 복구 검증에 사용하지 않는다. 사용자 DB·서비스·브라우저를 재사용하거나 종료하지 않는다. 비용 있는 외부 모델·SEC 도구는 fixture로 대체한다.

## 필수 인수 기준

| 범위 | 확인 기준 |
| --- | --- |
| 프로세스 경계 | A가 소유·실행, B가 DB 상태/SSE/cancel; B 시작·재시작이 정상 A를 중단시키지 않음 |
| 접수와 순서 | 같은 thread FIFO/reject409, 다른 thread 병행, 전체 worker 합계 cap/queue/429+Retry-After |
| 중복과 경합 | 동시 같은 idempotency key는 같은 run/한 번 실행, 다른 payload409; claim/cancel 후 잘못된 성공 없음 |
| 제어 작업 | 활성/검토 필요 thread의 state 수정·삭제/patch409, idle 수정·삭제는 같은 제어 transaction의 saver와 일치 |
| 장애 회수 | SIGSTOP/SIGKILL/DB 중단으로 lease를 잃은 running은 interrupted, 자동 재실행 없음; 안전한 queued만 재개 |
| fencing | 구 owner의 checkpoint/pending writes/event/terminal 거부. 실제 PG transaction의 pre/post lease 검사·rollback으로 증명 |
| 모호한 효과 | 위험 도구 run의 중단은 thread를 막고 명시적 review 이후에만 후속 queued 진행; rollback으로 설명하지 않음 |
| SSE | DB sequence/cursor, namespace/tool IDs, NOTIFY 누락의 polling 보완, byte/event cap, gap error+end, TTL 뒤 저장 결과 복원 |
| 원자적 terminal | terminal status/result/end를 함께 commit. end 직전 죽으면 부분 성공 없음; 완료 checkpoint만으로 성공 승격 금지 |
| 기존 계약 | 현재 등록 graph 전체 schema, 실제 SDK 오류 뒤 checkpoint와 후속 turn, Canvas report UUID/custom ready/검증된 OpenUI 보존 |

두 manager를 같은 Python 프로세스에서 만든 테스트는 위2OS 기준을 대체하지 않는다. 독립 adapter/test guard의 실제 PG 검증, 생산 RuntimeQueue의 실제 PG 검증, 실제2OS HTTP 검증을 각각 기록하고 개수를 중복 합산하지 않는다.

## 실행 선택과 증거

```sh
pnpm -C 3-langgraph-fast test:multiworker:api
# 초기 부팅만 또는 마지막 실패 단계부터 조사할 때
MULTIWORKER_PREFLIGHT=concurrent pnpm -C 3-langgraph-fast test:multiworker:api
MULTIWORKER_START_AT=database_disconnect pnpm -C 3-langgraph-fast test:multiworker:api
```

Bruno 컬렉션은 `bruno-api-tests/27-fastapi-multiworker/`이며 위 driver가 소유한 두 서버에 실행한다. fixture 전용 graph가 필요하므로 사용자 API에 무작정 실행하지 않는다. 기본 driver는 증거 JSON/Bruno 로그/worker 로그와 PID·container 소유권을 소유 임시 artifact 디렉터리에 기록한다. reports와 runtime data는 커밋하지 않는다.

Canvas 검증은 실제 workflow와 SDK/SSE/saver/Host parser를 사용하되 모델·OHLCV는 고정 fixture다. 이를 외부 모델 품질·Yahoo 데이터 품질 검증으로 표현하지 않는다. Host parser는 소유3193/고유 Next dist만 사용하며 시작 전의 dirty 설정을 보존하고 자신의 include·route reference·cache만 정리한다. 브라우저는 사용자 지정 범위에서 실행하지 않는다.

성공·실패·중단 모두 finally에서 worker/validator/컨테이너와 소유 Next 출력을 정리하고 PID/port/container 부재를 확인해야 전체 검증 완료다. 공식 정책은 [VAL-CLEANUP-001](../../../validation/INDEX.md#val-cleanup-001)을 따른다.
