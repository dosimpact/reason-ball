# Python LangGraph backend

`uv sync --frozen`으로 설치하고 `.env.example`을 `.env`로 복사해 OPENAI_API_KEY를 설정한다.

```bash
uv run langgraph dev --port 2038 --no-browser
uv run pytest
uv run ruff check agent tests
```

프런트엔드는 http://127.0.0.1:3046 이다. `agent/system-prompt.txt`는 shadcn 카탈로그에서 생성하여 명시적으로 동기화한 패키지 자산이다. 자세한 흐름은 [시스템 설계](../docs/stock/system.md)를 참조한다.
