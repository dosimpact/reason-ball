# FastAPI

FastAPI is a modern Python web framework based on type hints, with built-in
OpenAPI/Swagger documentation and async support.

## LangGraph 와 함께 쓰기

- `graph.ainvoke()` 를 async route 안에서 호출
- Streaming 응답: `graph.astream()` + SSE (`text/event-stream`)
- 멀티유저: 요청마다 `thread_id = f"{user_id}:{session_id}"` 로 격리
- 백그라운드 작업: `BackgroundTasks` 또는 별도 worker (Celery / Arq)

## 운영 팁

- Uvicorn `--workers N` 으로 수평확장
- `httpx.AsyncClient` 재사용으로 connection pool 유지
- Pydantic v2 로 input/output 스키마 강제
