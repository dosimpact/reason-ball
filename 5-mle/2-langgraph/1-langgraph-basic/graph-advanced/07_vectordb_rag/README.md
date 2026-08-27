# 07 — Qdrant + BM25 하이브리드 RAG

## 1. 한 줄 소개
부모 `graph-basic/34_rag.py` 의 인메모리 키워드 매칭을 Qdrant + BM25 하이브리드 + RRF + LLM rerank 로 업그레이드한 실전 RAG.

## 2. 왜 필요한가
부모 10번 예제는 학습용 키워드 매칭이라 한국어 어절 / 동의어 / 의미 검색이 약하다. 실서비스 RAG 는:
- **의미 검색 (dense)** — 패러프레이즈 / 동의어 처리
- **키워드 검색 (sparse)** — 고유명사 / 코드 / 약어
- **결합** — 둘 다 못 잡는 것을 줄임
- **rerank** — top-N 노이즈 제거
- **인용 강제 + 부족 시 모른다고 답** — hallucination 방지

## 3. 어떻게 해결하는가
- **Dense**: OpenAI embeddings (`text-embedding-3-small`, 1536-dim) → Qdrant 코사인
- **Sparse**: `rank_bm25` 인메모리 BM25Okapi
- **결합**: RRF (k=60)
- **Rerank**: LLM 한 번 호출로 0–10 점수화 (외부 reranker 불필요한 경량 데모)
- **Generate**: 컨텍스트 + 질문 → "ONLY context, cite [doc-id], say so if insufficient"

## 4. 그래프 구조
```
START ─▶ retrieve(dense + sparse → RRF) ─▶ rerank(LLM 0~10) ─▶ augment ─▶ generate ─▶ END
```

## 5. 실행 방법
```bash
uv sync --extra advanced
export OPENAI_API_KEY="sk-..."

# Qdrant 기동
docker compose -f graph-advanced/07_vectordb_rag/docker-compose.yml up -d
docker compose -f graph-advanced/07_vectordb_rag/docker-compose.yml ps          # qdrant healthy 확인

# 데이터 인덱싱 (data/*.md 8개)
uv run python graph-advanced/07_vectordb_rag/ingest.py --reset

# 단독 실행 (5개 검증 질문 일괄 실행)
uv run python graph-advanced/07_vectordb_rag/graph.py

# Studio
uv run langgraph dev --config langgraph-advanced.json
```

## 6. 검증 시나리오
graph.py 의 5개 질문이 그대로 회귀 테스트 역할:

| # | 질문 | 기대 |
|---|------|------|
| 1 | LangGraph 가 뭐야? | `langgraph#chunk-*` 인용 |
| 2 | Bedrock Guardrails 의 역할은? | `guardrails#chunk-*` 인용 |
| 3 | BM25 와 dense retrieval 차이? | `bm25_vs_dense#*` 인용 |
| 4 | RRF 가 어떻게 두 결과를 합쳐? | `rrf#*` 인용 |
| 5 | 쿠버네티스 파드란? | "정보 없음" 류 응답 (인용 없음) |

추가로 Studio 에서 같은 질문 한국어/영어 변형으로 입력해 dense 의 강점을 확인해도 좋다.

## 7. 트레이드오프 / 운영 주의
- **BM25 메모리**: 본 예제는 collection 전체를 인메모리로 올림. 수만 문서 이상이면 OpenSearch / Elasticsearch 의 BM25 사용을 권장.
- **임베딩 비용**: Titan v2 는 1k 토큰 당 매우 저렴하나, 인덱싱 시 일괄 호출이 비싸질 수 있음. 배치 + 재시도 + 캐시.
- **재인덱싱**: 모델/차원 변경 시 collection 재생성 필요 (`--reset`).
- **Rerank 비용**: LLM rerank 는 노드당 1회 LLM 호출. 트래픽 많으면 cross-encoder (bge-reranker, Cohere Rerank) 로 교체.
- **인용 검증**: 본 예제는 system prompt 만 강제. 진짜 환각 방어는 `cite_check` 노드 추가 (LLM-as-judge) 권장.
- **청킹**: 마크다운 헤더 분할 + 800자 제한. 토큰 단위가 아니라 글자 단위라는 점 유의 (한국어는 더 짧게).

## 8. 부모 graph/NN_*.py 와의 관계
- 베이스: `graph-basic/34_rag.py`
- 변경점: 인메모리 dict → Qdrant; 키워드 점수 → dense+BM25+RRF+rerank
- 인용 ID 강제 / 부족시 모른다고 답하는 system prompt 패턴은 그대로 계승
