# Agentic Design Patterns

`Agentic_Design_Patterns.pdf`의 Agentic Pattern을 LangGraph 예제로 구현한 Python 프로젝트  

## 설치

```bash
uv sync
cp .env.example .env
```

`uv sync`는 `pyproject.toml`과 `uv.lock`을 기준으로 의존성을 설치합니다.
`.env.example`을 복사해서 로컬 실행용 `.env`를 만든 뒤 모델 provider를 설정합니다.

## 모델 설정

OpenAI를 사용할 경우 `.env`를 다음처럼 설정합니다.

```text
MODEL_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

Ollama 로컬 모델을 사용할 경우 `.env`를 다음처럼 설정합니다.

```text
MODEL_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b-mlx
```

Ollama를 사용할 때는 먼저 로컬 Ollama 서버가 실행 중이어야 하고, `OLLAMA_MODEL`에 지정한 모델이 설치되어 있어야 합니다.

```bash
ollama list
ollama pull gemma4:e2b-mlx
```

## 테스트 실행

```bash
uv run pytest
```

현재 테스트는 각 패턴의 graph construction, routing/state transition, 실패 경로, 주요 성공 경로를 검증합니다.

## LangGraph Dev Server 실행

```bash
uv run langgraph dev
#브라우저를 자동으로 열지 않으려면 다음처럼 실행합니다.
uv run langgraph dev --no-browser --tunnel
```

서버가 실행되면 터미널에 다음 URL이 출력됩니다.

- API: `http://127.0.0.1:2024`
- Studio UI: `https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024`
- API Docs: `http://127.0.0.1:2024/docs`

이미 `2024` 포트가 사용 중이면 LangGraph가 다른 임시 포트를 자동으로 선택합니다. 이 경우 터미널에 출력된 실제 포트를 사용하면 됩니다.

## 그래프 등록 위치

LangGraph Studio/dev server에 노출되는 graph 목록은  langgraph.json 에 등록되어 있습니다.
