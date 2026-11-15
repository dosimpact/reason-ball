# 자체 FastAPI graph runtime

## LG-OSS-001: 실행 범위와 registry

`server.server:app`은 2981에서 기존 HTTP API와 함께 실제 LangGraph 실행을 제공한다. `GraphRegistry`는 `langgraph.json`의 allowlist를 읽고 기존 export의 StateGraph builder를 같은 업무 node/tool로 다시 compile한다. 개발용 export는 변경하지 않는다. FastAPI 인스턴스만 lifespan의 `AsyncPostgresSaver`를 주입받는다. PostgreSQL 미설정 시 process-local InMemorySaver를 사용하므로 재시작 복구를 보장하지 않는다.

registry는 실제 input/output/state/config schema를 제공하고 graph ID별 안정적 UUID의 기본 assistant를 `if_exists=do_nothing`으로 등록한다. 저장 assistant UUID와 graph ID 양쪽을 실행 시 해석한다. assistant config/context에 요청 값을 합치고, `configurable.thread_id`와 run/graph metadata는 서버가 설정한다. 한 thread는 하나의 graph에 연결하며 다른 graph 실행은409다.

## LG-OSS-002: Task와 streaming

단일 프로세스 `RunManager`가 background Task, 전역 semaphore, thread별 잠금을 소유한다. `LANGGRAPH_MAX_ACTIVE=10`, `LANGGRAPH_MAX_QUEUED=10`이 기본이다. 같은 thread는 enqueue로 직렬화하며 reject는409다. 용량 초과는429 및 Retry-After다. 다른 multitask 전략·rollback 취소·resume command는422로 명시한다. 다중 worker/인스턴스 조정은 이번 범위에 없다.

`/runs/stream`은 실제 graph.astream의 values/updates/messages/custom 등 요청 mode를 전달한다. messages는 SDK용 messages-tuple로 직렬화하며 stream_subgraphs 요청 시 namespace를 event 이름에 보존한다. metadata.run_id가 먼저 오고 실패는 error event와 error run 상태, 종료는 end다. AIMessage/ToolMessage는 JSON 구조와 tool call ID·이름·상태를 보존한다. Canvas custom payload는 변형하지 않는다. 두 TA graph의 inline presentation과 별도 Canvas 동작은 유지한다.

subscriber 연결이 끊겨도 background 실행·저장은 계속한다. 명시적 cancel은 실제 Task 취소를 기다리고 interrupted로 종료하며 rollback은 하지 않는다. 동기 외부 작업 자체가 이미 시작되었다면 그 부작용까지 취소한다고 보장하지 않는다. wait/join은 shield로 실행 수명과 HTTP 수명을 분리한다.

stream 버퍼는 run당 기본8MiB/256events로 제한한다(`LANGGRAPH_STREAM_BUFFER_BYTES`). 단일 큰 event는 유지한다. 느린 subscriber가 버퍼를 놓치면 gap error로 최신 state 조회를 안내한다. 종료60초 후 버퍼를 해제하므로 전체 token replay는 보장하지 않는다. 완료 run은 저장된 최종 결과/state로 복구한다.

## LG-OSS-003: PostgreSQL 상태

실제 graph가 step checkpoint와 pending writes를 saver에 기록한다. state/history/update HTTP는 graph.aget_state/aget_state_history/aupdate_state를 사용하며 수동 최종 snapshot 쓰기를 실제 실행에 사용하지 않는다. thread/run/assistant metadata와 검색용 values projection은 기존 repository를 재사용한다. 활성 run 중 state 수정은409다.

재시작 시 기존 pending/running metadata는 interrupted로 정리하며 자동 재실행하지 않는다. 대화와 실행 checkpoint는 PostgreSQL에서 읽는다. 개발 런타임 데이터는 이전하거나 삭제하지 않는다.

`prepare_schema`는 기본적으로 public legacy table을 이동하지 않는다. 명시적 `move_legacy_tables=True`를 사용한 별도 이전만 가능하다. lifespan의 예전 snapshot backfill도 `FASTAPI_ENABLE_LEGACY_MIGRATION=true`인 경우에만 실행한다. 일반 실행은 과거 데이터를 자동 이전하지 않는다. `FASTAPI_STARTUP_GRAPH_ONLY=true`는 Neo4j/SEC 모델링 초기화와 legacy backfill을 건너뛰되 PostgreSQL 설정·연결은 유지한다. 운영 schema 준비 정책은 기존 DB saver 문서를 따른다.

## 경계와 검증

이번 단계는 신뢰하는 제한된 내부 사용자의 공유 대화용이다. 사용자별 소유권/인증을 새로 구현한 것은 아니며 공개 노출이나 다중 프로세스 운영을 전제로 하지 않는다. 나머지 HTTP scaffold API가 LangGraph dev와 모두 동등하다고 주장하지 않는다.

코드는 `server/graph_registry.py`, `server/run_manager.py`, 기존 assistants/threads/runs 라우트에 있다. API 검증은 별도 소유 FastAPI·validator와 격리 PostgreSQL schema를 사용한다. 실제 graph stream, 취소, disconnect 후 완료, 동일 thread/용량 제한, 프로세스 재시작 복구를 검증하며 브라우저 검증은 사용자 담당이다. 실행 결과는 해당 날짜 flow에 기록한다.
