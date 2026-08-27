# 01_semantic_cache — 시멘틱 캐시 + ReAct

## 1. 한 줄 소개
같은 의미의 질문이 들어오면 임베딩 코사인 유사도로 이전 응답을 재사용해 LLM 호출을 절감하는 ReAct 그래프.

## 2. 왜 필요한가
같은 의도의 질문이 다른 표현으로 반복되면(`"지금 몇 시야"` / `"What time is it"` / `"현재 시간 알려줘"`)
정확히 같은 문자열이 아니므로 일반 LRU/문자열 캐시로는 잡을 수 없습니다. LLM 호출이 매번 발생해
**비용·지연시간·rate limit** 모두 손해입니다.

## 3. 어떻게 해결하는가
- 사용자 질문을 **임베딩** 으로 바꿔 in-memory store 에 (vec, answer) 형태로 저장
- 새 질문이 들어오면 **코사인 유사도** 가장 큰 항목을 찾아 `threshold(=0.95)` 이상이면 즉시 응답 반환
- miss 일 때만 ReAct agent 가 실행되고, 결과를 캐시에 저장

임베딩 백엔드는 두 가지 옵션:
- `EMBEDDING_BACKEND=openai` (기본): OpenAI embeddings (`text-embedding-3-small`)
- `EMBEDDING_BACKEND=sbert`: 로컬 sentence-transformers (오프라인 / 무료)

## 4. 그래프 구조

```
START ─▶ cache_lookup ──hit──▶ END
              │ miss
              ▼
            agent ⇄ tools
              │
              ▼
         cache_store ─▶ END
```

## 5. 실행 방법

```bash
uv sync --extra advanced

# (옵션) 로컬 sbert 사용
# uv sync --extra advanced --extra local-embeddings
# export EMBEDDING_BACKEND=sbert

# OpenAI 사용 시 OPENAI_API_KEY 설정
uv run python graph-advanced/01_semantic_cache/graph.py      # 단독 실행 (3개 질문 차례 invoke)
uv run langgraph dev --config langgraph-advanced.json        # Studio
```

## 6. 검증 시나리오

`python graph.py` 실행 시 콘솔 출력 예시:

```
[cache] MISS                q='지금 몇 시야'
[cache] STORE size=1        q='지금 몇 시야'
  → 2025-... KST

[cache] HIT  score=0.97...  q='현재 시간 알려줘'
  → 2025-... KST            ← 동일 응답 재사용

[cache] HIT  score=0.95...  q='What time is it'
  → 2025-... KST
```

threshold 를 0.99 로 올리면 hit 이 줄어들고, 0.85 까지 낮추면 의미가 다른 질문도 hit 처리될 수 있습니다.

## 7. 트레이드오프 / 운영 주의
- **threshold 튜닝이 핵심**. 너무 낮으면 잘못된 응답 재사용(금융/의료 도메인 위험), 너무 높으면 hit rate 0%.
- 시간 의존 답변(`get_current_time`) 을 캐싱하면 stale 데이터 노출. TTL / 도메인별 캐시 분리 필요.
- in-memory 는 프로세스 죽으면 사라짐. 프로덕션은 Redis VL / Qdrant 등으로 교체.
- 사용자별 격리(다국어, A/B 그룹) 가 필요하면 namespace 키 추가 (현재는 글로벌 단일 캐시).

## 8. 부모 프로젝트와의 관계
- `graph-basic/15_react_tool_loop.py` 의 앞뒤에 `cache_lookup` / `cache_store` 노드를 끼워 넣은 형태.
- `node/llm_node.py` 의 `make_call_model` 패턴을 참고하되, LLM 생성은 루트 `common/llm.py`를 사용.
- `docs/심화주제.md` §1 의 직접 구현체.
