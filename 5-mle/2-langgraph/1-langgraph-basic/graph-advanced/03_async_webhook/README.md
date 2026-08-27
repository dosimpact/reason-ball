# 03_async_webhook — interrupt() + Webhook Callback

## 1. 한 줄 소개
장시간 걸리는 외부 잡을 tool 에서 제출한 뒤 그래프를 멈췄다가, 외부 시스템이 webhook 으로 결과를 보내오면 `Command(resume=...)` 으로 재개하는 패턴.

## 2. 왜 필요한가
- 영상 인코딩, 배치 분석, human approval 같은 작업은 수 분~수 시간이 걸린다.
- 그래프 노드 안에서 `time.sleep` 폴링은 워커를 점유하고 클라이언트 connection 도 잡아둔다.
- 동기 invoke 는 timeout / 비용 / 안정성 모두에서 부적절.

## 3. 어떻게 해결하는가
- tool 안에서 외부에 job 제출 → `interrupt({...})` 호출로 그래프 일시정지 + checkpoint 저장.
- 외부 시스템이 결과 준비되면 우리 서버의 `POST /webhook/{thread_id}` 호출.
- 서버는 해당 thread 를 `graph.invoke(Command(resume=body), ...)` 로 깨운다 → 멈춰있던 `interrupt()` 가 body 를 반환 → tool 정상 종료 → agent 가 후속 응답 생성.
- thread 영속이 필수이므로 `PostgresSaver` 사용.

## 4. 그래프 구조
```
START ─▶ agent ⇄ tools(long_running_job ⛔ interrupt)
            │
            ▼
           END
```

## 5. 실행 방법
```bash
# 0) deps
uv sync --extra advanced
export OPENAI_API_KEY="sk-..."

# 1) Postgres
docker compose -f graph-advanced/03_async_webhook/docker-compose.yml up -d

# 2) 서버
uv run uvicorn server:app --app-dir graph-advanced/03_async_webhook --host 0.0.0.0 --port 8000

# 3) 외부 mock 시스템 (별 터미널)
uv run python graph-advanced/03_async_webhook/mock_external.py
```

## 6. 검증 시나리오
```bash
# 잡 시작 — 응답에 status=waiting, interrupt 페이로드 노출
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"thread_id": "t1", "message": "비디오 인코딩 잡 돌려줘"}'

# (5초 뒤 mock_external 이 자동으로 /webhook/t1 호출)

# 결과 확인
curl -s http://localhost:8000/chat/t1
```

수동으로 webhook 흉내내려면:
```bash
curl -s -X POST http://localhost:8000/webhook/t1 \
  -H "Content-Type: application/json" \
  -d '{"result": "encoded ok"}'
```

## 7. 트레이드오프 / 운영 주의
- webhook 은 외부에서 우리 서버로 들어오는 트래픽 — 인증(서명/HMAC)·재시도·idempotency 필수. 본 데모는 평문.
- `interrupt()` 후 webhook 이 영영 안 오는 경우 dangling thread → TTL / dead-letter 처리 필요.
- multi-replica 서버: 동일 thread 에 동시 resume 이 들어올 수 있으니 thread 단위 lock 또는 outbox 필요.
- Postgres 가 쓰기 부하의 SPOF — checkpoint 빈도 / 압축 / 보존정책 설계.

## 8. 부모 graph/ 와의 관계
- `graph-basic/22_dynamic_interrupt.py` 의 `interrupt()` + `Command(resume)` 패턴을 그대로 확장.
- 사용자(사람) 대신 외부 시스템(webhook) 이 resume 주체가 된다는 점만 다름.
- ToolNode + ReAct 사이클은 `graph-basic/15_react_tool_loop.py` 와 동일.
