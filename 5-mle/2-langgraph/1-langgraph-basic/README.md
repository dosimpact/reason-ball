# LangGraph Basic OpenAI

LangGraph 핵심 패턴을 학습하기 위한 예제 모음입니다. LLM과 임베딩은 OpenAI API를 사용합니다.

## 구조

```text
common/          # OpenAI LLM 팩토리, 공용 데모 tools
node/            # 재사용 LangGraph 노드와 라우팅 헬퍼
graph-basic/     # 01~21 기본 LangGraph 예제
graph-advanced/  # 캐시, RAG, observability 등 고급 예제
langgraph.json   # 기본 예제 LangGraph Studio 그래프 설정
langgraph-advanced.json # 고급 예제 LangGraph Studio 그래프 설정
```

## 환경 설정

`uv`를 사용합니다.
```
# --- uv 설치
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync
```

`langgraph dev` CLI는 기본 의존성에 포함되어 있습니다.

`.env`에 OpenAI 키를 설정합니다.

```bash
OPENAI_API_KEY=sk-...
```

## 실행

기본 예제:

```bash
uv run python graph-basic/01_simple_graph.py
uv run python graph-basic/03_tool_node.py
uv run python graph-basic/17_configurable.py
```

LangGraph Studio:

```bash
# graph basic
uv run langgraph dev --host 0.0.0.0 --port 2999 --tunnel
>Add to allowed domains

# graph advanced
uv run langgraph dev --config langgraph-advanced.json --host 0.0.0.0 --port 2998 --tunnel
>Add to allowed domains
```

고급 예제는 루트 `pyproject.toml`의 `advanced` extra로 의존성을 관리하고, 루트 `langgraph-advanced.json`으로 Studio에 등록합니다.

```bash
uv sync --extra advanced
uv run langgraph dev --config langgraph-advanced.json --port 2025
```
