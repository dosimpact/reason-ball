# 10_async_sse — Async ReAct + FastAPI SSE

## 1. 한 줄 소개
`async` 노드 + `graph.astream(stream_mode="messages")` + FastAPI SSE 로 LLM 토큰을 HTTP 위에서 한 줄씩 client 로 흘리는 데모.

## 2. 왜 필요한가
- 부모 `graph-basic/17_streaming.py` 는 동기 `graph.stream()` 을 CLI 에 print 한 데모. 실제 서비스에서는 HTTP 위에서 토큰을 client 에 흘려야 UX 가 산다.
- 동기 노드 + 동기 stream 은 FastAPI worker 를 점유하므로 동시 접속이 늘면 throughput 이 무너진다.
- 노드를 `async def` 로 만들고 `llm.ainvoke()` / `graph.astream()` 을 쓰면 동일 worker 가 다른 요청을 처리할 수 있다.

## 3. 어떻게 해결하는가
- 모든 노드를 `async def` 로 작성 → `llm.ainvoke` 사용.
- 서버는 `EventSourceResponse(_token_iter(q))` 로 SSE 송출.
- `stream_mode="messages"` 가 (chunk, metadata) 페어를 yield → 토큰 텍스트만 추출해 클라이언트로.

## 4. 그래프 구조
```
START ─▶ agent ⇄ tools(get_current_time, calculate)
            │
            ▼
           END
```

## 5. 실행 방법
```bash
uv sync --extra advanced
cp graph-advanced/10_async_sse/.env.example .env

uv run uvicorn server:app --app-dir graph-advanced/10_async_sse --host 0.0.0.0 --port 8000
# 브라우저: http://localhost:8000/
```

## 6. 검증 시나리오
```bash
# CLI
curl -N "http://localhost:8000/stream?q=langgraph%20에%20대해%20설명해줘"

# tool 사용
curl -N "http://localhost:8000/stream?q=지금%20몇%20시야%3F"
curl -N "http://localhost:8000/stream?q=12*7%20계산해줘"
```

각 토큰은 다음 형식의 SSE 이벤트:
```
event: token
data: {"node": "agent", "text": "Lang"}

event: done
data: [DONE]
```

## 7. 트레이드오프 / 운영 주의
- SSE 는 단방향. 양방향이 필요하면 WebSocket 으로 교체.
- 프록시 (nginx, ALB) 의 buffering / idle timeout 설정 필요. (`X-Accel-Buffering: no`, `proxy_read_timeout` 등)
- backpressure: client 가 느리면 producer 가 쌓일 수 있음 — `astream` 은 await 이므로 자연스러운 backpressure 가 생기지만 graph 노드 안의 무거운 동기 작업은 막힘.
- tool 안에서 동기 blocking I/O 를 부르면 event loop 가 멈춤 → 외부 호출은 `httpx.AsyncClient` 등 비동기로.
- 인증 / rate limit 은 본 데모에 없음 (11_multitenancy 참고).

## 8. 부모 graph/ 와의 관계
- `graph-basic/17_streaming.py` 의 sync stream 데모를 → async + HTTP SSE 로 확장.
- `graph-basic/15_react_tool_loop.py` 의 ReAct 구조와 동일하나, 노드 함수 시그니처가 `async def` 이고 `llm.ainvoke` 를 사용.
