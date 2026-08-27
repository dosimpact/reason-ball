# 02_tool_rag — 50+ Tool 에서 Top-K 만 bind

## 1. 한 줄 소개
50+ 개의 가상 tool 카탈로그를 임베딩 인덱싱한 뒤, 사용자 질문에 따라 의미적으로 관련된 top-k(=5) tool 만 LLM 에 bind 하는 ReAct 그래프.

## 2. 왜 필요한가
Anthropic 문서 기준 tool 수가 늘어날수록:
- 매 LLM 호출마다 모든 tool description 이 프롬프트에 들어가 **토큰 비용 ↑**
- LLM 이 비슷한 이름의 tool 들 사이에서 잘못 고를 확률 ↑ (정확도 ↓)
- prompt context window 압박

도시 50개 × 기능 5개만 해도 250 tool, 실제 운영 환경에서는 수백~수천 개에 달할 수 있습니다.

## 3. 어떻게 해결하는가
1. 각 tool 의 `(name, description, examples)` 를 **OpenAI embeddings** 로 임베딩 → in-memory 행렬에 저장 (lazy 빌드)
2. 사용자 질문이 들어오면 질문 임베딩 vs 카탈로그 행렬 코사인 유사도 → top-k=5
3. 선택된 5개만 `llm.bind_tools(selected)` 후 ReAct
4. `ToolNode` 도 매 사이클 selected 기준으로 동적 구성 (불필요한 tool 노출 방지)

본 데모의 카탈로그는 약 60개 mock tool (날씨/계산/DB/번역/뉴스/주식/검색/이미지 카테고리).

## 4. 그래프 구조

```
START ─▶ select_tools ─▶ agent ⇄ tools ─▶ END
         (top-k=5)
```

## 5. 실행 방법

```bash
uv sync --extra advanced

# OPENAI_API_KEY 환경변수 사용
uv run python graph-advanced/02_tool_rag/graph.py             # 데모 (4개 질문)
uv run langgraph dev --config langgraph-advanced.json               # Studio
```

첫 실행 시 카탈로그(약 60개) 전체를 임베딩하므로 수 초 소요됩니다 (이후 lru_cache).

## 6. 검증 시나리오

`python graph.py` 출력에서 `selected=[...]` 가 의미에 맞게 좁혀지는지 확인:

```
q='내일 도쿄 날씨 알려줘'
selected=['weather_tokyo', 'weather_osaka', 'weather_seoul', 'weather_busan', 'news_world']

q='AAPL 주가 어때?'
selected=['stock_aapl', 'stock_msft', 'stock_googl', 'stock_nvda', 'stock_amzn']

q='users 테이블 row 보여줘'
selected=['db_query_users', 'db_query_orders', 'db_query_payments', ...]
```

기대 동작: 질문과 무관한 카테고리(이미지/번역) 가 top-5 안에 들어오면 카탈로그 description 을 더 풍부하게 작성하거나 k 를 조정.

## 7. 트레이드오프 / 운영 주의
- top-k 가 너무 작으면 정작 필요한 tool 이 누락 → recall 확보 위해 보통 5~10
- description 품질이 retrieval 품질을 좌우. 단순 이름만으로는 부족 → examples / use-case 함께 임베딩
- 임베딩 캐싱 필수. 60개 tool × 매번 호출하면 의미 없음 → 본 코드는 `lru_cache` 로 최초 1회만 빌드
- 카탈로그가 자주 바뀌면 (배포 시 tool 추가/제거) → 캐시 무효화 로직 또는 외부 vector store(Qdrant/OpenSearch) 사용
- 다국어 카탈로그면 다국어 임베딩 모델(Titan v2 multilingual / multilingual-e5) 필수

## 8. 부모 프로젝트와의 관계
- `graph-basic/15_react_tool_loop.py` ReAct 의 앞단에 retrieval 노드를 끼운 변형.
- `graph-basic/34_rag.py` (문서 RAG) 의 retrieval 패턴을 **tool 메타데이터** 에 적용한 것.
- `docs/심화주제.md` §2 직접 구현체.
