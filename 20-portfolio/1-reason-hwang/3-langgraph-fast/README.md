# LangGraph Fast Init

FastAPI and LangGraph starter project using `uv`.

## Setup

```sh
uv sync
```

## Run

```sh
uv run uvicorn langgraph_fast.server.server:app --reload
```

## API

- `GET /health`: service health check.
- `POST /graph/run`: run the minimal LangGraph workflow.

Example:

```sh
curl -X POST http://127.0.0.1:8000/graph/run \
  -H 'content-type: application/json' \
  -d '{"message":"Say hello in one sentence","provider":"openai"}'
```

Use `provider: "chatgpt-oauth-proxy"` with
`CHATGPT_OAUTH_PROXY_URL` set when `/Users/studio/workspace/projects/chatgpt-oauth-proxy`
is running.
