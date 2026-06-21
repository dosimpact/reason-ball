# graph-advanced — 심화 주제 구현 모음

`docs/심화주제.md` 의 11개 주제를 루트 프로젝트의 공용 의존성과 `common/` 모듈을 사용하도록 구성한 모음입니다.

각 디렉토리는 주제별 graph 코드와 보조 모듈만 담고, 실행과 의존성 관리는 루트의 `pyproject.toml` 및 `langgraph-advanced.json`에서 처리합니다.

## 디렉토리 구조

```
graph-advanced/
├── README.md                          # 이 파일
├── 01_semantic_cache/
├── 02_tool_rag/
├── 03_async_webhook/
├── 04_graceful_degradation/
├── 05_code_sandbox/
├── 06_postgres_checkpointer/
├── 07_vectordb_rag/
├── 08_eval_harness/
├── 09_observability/
├── 10_async_sse/
└── 11_multitenancy/
```

## 각 예제 공통 구조

```
NN_<topic>/
├── README.md                # 주제 설명 + 실행 방법 + 검증 시나리오
├── .env.example             # 필요한 환경변수 (있으면)
├── docker-compose.yml       # 외부 서비스 필요시
├── graph.py                 # 메인 그래프 (LangGraph entrypoint)
└── (추가 모듈 / 서버 파일)
```

공통 LLM 팩토리는 루트 `common/llm.py`를 사용합니다. 고급 예제에 필요한 추가 패키지는 루트 `pyproject.toml`의 `advanced` extra에서 관리합니다.

## 빠른 시작

### LLM 환경변수 (모든 프로젝트 공통)
부모 프로젝트의 `.env` 에 이미 설정되어 있다면 그대로 재사용:
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=default
OPENAI_MODEL_DEFAULT=gpt-4o-mini
OPENAI_MODEL_FAST=gpt-4o-mini
OPENAI_MODEL_NORMAL=gpt-5-nano
OPENAI_MODEL_SMART=gpt-5-mini
OPENAI_MODEL_REASONING=o4-mini
```

각 프로젝트의 `.env.example` 에 추가로 필요한 변수가 적혀있습니다.

### 실행
```bash
uv sync --extra advanced
docker compose -f graph-advanced/07_vectordb_rag/docker-compose.yml up -d  # 인프라 필요한 프로젝트만
uv run langgraph dev --config langgraph-advanced.json --port 2025
# 또는
uv run python graph-advanced/01_semantic_cache/graph.py
```

## 주제별 인프라 요약

| # | 주제 | 외부 인프라 | 핵심 기술 |
|---|------|------------|-----------|
| 01 | Semantic Cache | (선택) Redis | 임베딩, 코사인 유사도 |
| 02 | Tool RAG | (없음, in-memory) | 임베딩 기반 tool 선택 |
| 03 | Async Webhook | Postgres + Mock external | `interrupt()`, `Command(resume)` |
| 04 | Graceful Degradation | (없음) | retry / fallback / partial result |
| 05 | Code Sandbox | Docker (별도 컨테이너) | 격리 실행 환경 |
| 06 | Postgres Checkpointer | Postgres | `PostgresSaver` |
| 07 | Vector DB RAG | Qdrant | hybrid retrieval, reranking |
| 08 | Eval Harness | (선택) LangSmith | golden set + LLM-as-judge |
| 09 | Observability | LangSmith + Prometheus | tracing, 메트릭 |
| 10 | Async + SSE | (없음) | FastAPI + `astream` |
| 11 | Multitenancy | Postgres + JWT | thread/store 격리 |

## 학습 순서 권장

```
[기초 응용]   01 → 04 → 08
[저장소]      06 → 07 → 11
[운영]        09 → 10
[고급]        02 → 03 → 05
```

## 부모 프로젝트와의 관계

- 부모 (`graph/01~21`): LangGraph **API** 학습
- 이 디렉토리 (`graph-advanced/`): LangGraph 를 **실제 서비스에 올릴 때** 마주치는 운영 패턴 구현

심화주제 개념 설명은 `../docs/심화주제.md` 참고.
