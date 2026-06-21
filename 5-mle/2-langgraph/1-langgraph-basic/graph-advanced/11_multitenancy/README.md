# 11_multitenancy — 사용자별 격리 + JWT + Rate Limit

## 1. 한 줄 소개
`thread_id = "{user_id}:{conv_id}"` + Store namespace `("memories", user_id)` + JWT 인증 + 사용자별 rate limit 으로 LangGraph 를 멀티 테넌트 환경에 안전하게 운영.

## 2. 왜 필요한가
- 단일 그래프를 여러 사용자가 쓰면 thread 충돌 / 메모리 누설 / 한 사용자가 cost 다 태우기 같은 사고가 난다.
- LangGraph 는 thread_id / store namespace 만 잘 짜면 격리가 자연스러우나, **인증 + 소유권 검증 + 자원 제한** 은 애플리케이션 책임.

## 3. 어떻게 해결하는가
- **인증**: `Authorization: Bearer <JWT>` → HS256 검증 → `sub` 를 `user_id` 로.
- **thread 격리**: 클라이언트는 `conv_id` 만 보냄. 서버가 `f"{user_id}:{conv_id}"` 로 변환.
- **소유권 검증**: 직접 `thread_id` 로 접근하는 엔드포인트 (`GET /threads/{tid}`) 는 prefix 검사 → 불일치 시 403.
- **store 격리**: `store.put(("memories", user_id), ...)` — namespace 자체에 user_id.
- **rate limit**: 사용자별 시간당 N회 (in-memory deque, TODO Redis).
- **영속**: PostgresSaver + PostgresStore.

## 4. 그래프 구조
```
START ─▶ agent ⇄ tools(remember, recall)
            │
            ▼
           END
```

## 5. 실행 방법
```bash
uv sync --extra advanced
cp graph-advanced/11_multitenancy/.env.example .env

docker compose -f graph-advanced/11_multitenancy/docker-compose.yml up -d
uv run uvicorn server:app --app-dir graph-advanced/11_multitenancy --host 0.0.0.0 --port 8000
```

## 6. 검증 시나리오
```bash
# 1) 토큰 발급 (개발 편의)
ALICE=$(curl -s -X POST http://localhost:8000/_dev/token \
  -H "Content-Type: application/json" -d '{"user_id":"alice"}' | jq -r .token)
BOB=$(curl -s -X POST http://localhost:8000/_dev/token \
  -H "Content-Type: application/json" -d '{"user_id":"bob"}' | jq -r .token)

# 2) 정상 — alice 가 자기 conv 에 메시지
curl -s -X POST http://localhost:8000/chat \
  -H "Authorization: Bearer $ALICE" -H "Content-Type: application/json" \
  -d '{"conv_id":"c1","message":"내 이름은 alice 라고 기억해줘"}'

# 3) 격리 — bob 이 같은 conv_id 를 써도 thread 가 다름 (alice:c1 vs bob:c1)
curl -s -X POST http://localhost:8000/chat \
  -H "Authorization: Bearer $BOB" -H "Content-Type: application/json" \
  -d '{"conv_id":"c1","message":"내 이름이 뭐야?"}'
# → recall 결과 (not found) — bob namespace 에 alice 데이터 없음

# 4) 소유권 위반 — bob 이 alice:c1 thread 직접 조회 시도
curl -s -H "Authorization: Bearer $BOB" \
  http://localhost:8000/threads/alice:c1
# → 403 Forbidden

# 5) Rate limit (RATE_LIMIT_PER_HOUR=30 기준)
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/chat \
    -H "Authorization: Bearer $ALICE" -H "Content-Type: application/json" \
    -d '{"conv_id":"c1","message":"hi"}'
done
# → 30회 200, 이후 429
```

## 7. 트레이드오프 / 운영 주의
- in-memory rate limit 은 단일 프로세스 전용. multi-replica 면 Redis `INCR` + `EXPIRE` 또는 token bucket.
- JWT secret 로테이션 / kid 헤더 / RS256 (KMS 서명) 으로 강화 필요.
- `_dev/token` 엔드포인트는 운영에서 반드시 제거.
- Postgres store 는 cross-user query 를 막는 책임이 namespace 에 있음 — tool 안에서 절대 namespace 를 사용자 입력으로 받지 말 것 (본 코드는 `config.user_id` 만 신뢰).
- LangGraph `config.configurable` 는 graph state 와 분리되어 checkpoint 에 저장되지 않음 → 매 invoke 마다 재주입 필요.
- Audit log: user_id, thread_id, tool_calls 를 별도 로그로 남겨 데이터 접근 추적.

## 8. 부모 graph/ 와의 관계
- ReAct 구조 자체는 `graph/03_tool_node.py` 그대로.
- `graph/12_long_term_memory.py` 류의 store 사용 패턴에 namespace 격리 + 인증 미들웨어를 더한 것.
- `docs/심화주제.md` 의 멀티테넌시 / 보안 섹션 구현체.
