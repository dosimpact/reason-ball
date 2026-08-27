# 06 — Postgres Checkpointer (영속 멀티턴 대화)

## 1. 한 줄 소개
부모 `graph-basic/20_checkpointer.py` 의 `InMemorySaver` 를 `PostgresSaver` 로 교체해 프로세스 재시작에도 thread 가 살아있는 멀티턴 에이전트.

## 2. 왜 필요한가
`MemorySaver` 는 인메모리이므로:
- 프로세스/컨테이너 재시작 시 모든 대화 증발
- 단일 머신만 지원 (수평확장 불가)
- 백업/장애복구 불가

운영 챗봇은 thread 가 며칠~몇 달 살아있어야 한다.

## 3. 어떻게 해결하는가
`langgraph-checkpoint-postgres` 의 `PostgresSaver` 를 사용.
- 같은 `thread_id` 로 호출하면 이전 메시지가 자동 복원
- `saver.setup()` 이 멱등(idempotent) 마이그레이션
- 단독 실행 시 `compiled_with_postgres()` 컨텍스트로 명시 부착
- `langgraph dev` / Platform 환경에서는 플랫폼이 checkpointer 를 자동 주입하므로
  `build_graph()` 는 checkpointer 없이 컴파일

## 4. 그래프 구조
```
START ─▶ agent ⇄ tools ─▶ END
                │
                ▼ (PostgresSaver 가 매 step 커밋)
            postgres: checkpoints 테이블
```

## 5. 실행 방법
```bash
# 의존성
uv sync --extra advanced

# .env 작성 (OPENAI_API_KEY + DATABASE_URL)
cp graph-advanced/06_postgres_checkpointer/.env.example .env
# 부모 프로젝트 .env 에서 OPENAI_API_KEY 값 복사

# Postgres 기동
docker compose -f graph-advanced/06_postgres_checkpointer/docker-compose.yml up -d
docker compose -f graph-advanced/06_postgres_checkpointer/docker-compose.yml ps   # healthy 확인

# 단독 실행 (1턴 + 2턴)
uv run python graph-advanced/06_postgres_checkpointer/graph.py

# Studio (자동 주입)
uv run langgraph dev --config langgraph-advanced.json
```

## 6. 검증 시나리오
**시나리오 A — 멀티턴 컨텍스트**
1. `python graph.py` → "[TURN-2] 도경..." 출력 확인
2. 같은 thread_id 로 추가 invoke 시 이전 컨텍스트 누적

**시나리오 B — 영속성 (이 프로젝트의 핵심)**
1. `python graph.py` 로 1턴 작성
2. `docker compose restart postgres` (DB 컨테이너 재기동)
3. `python graph.py --replay` 실행
4. → 이름을 여전히 기억해야 정상 (PostgresSaver 가 디스크에 보존했기 때문)

**시나리오 C — thread 격리**
- `cfg["configurable"]["thread_id"]` 를 다른 값으로 바꾸면 → "기억 없음" 응답이 정상

## 7. 트레이드오프 / 운영 주의
- **레이턴시**: MemorySaver 대비 매 step 마다 SQL 왕복 (수~수십 ms 추가)
- **연결 풀**: 본 예제는 컨텍스트 매니저로 짧게 열고 닫음. 서버에서는 `Connection.from_conn_string` 대신 풀(`psycopg_pool.ConnectionPool`) + `PostgresSaver(pool)` 권장
- **TTL/GC**: 오래된 thread 정리 정책 필요 (`DELETE FROM checkpoints WHERE created_at < NOW() - INTERVAL '30 days'`)
- **PII**: state 에 민감정보 들어가면 컬럼 암호화 또는 별도 KMS
- **스키마 진화**: state TypedDict 필드 추가는 OK, 타입 변경 시 마이그레이션 스크립트
- **thread_id 충돌**: 멀티테넌시면 `{tenant}:{user}:{conv}` prefix 권장

## 8. 부모 graph/NN_*.py 와의 관계
- 베이스: `graph-basic/20_checkpointer.py` (InMemorySaver)
- 본 프로젝트는 step 1: 인메모리 → 영속화
- 다음 단계 (별도 프로젝트): `PostgresStore` 로 cross-thread 장기 메모리 (`graph-basic/26_long_term_memory.py` 후속)
