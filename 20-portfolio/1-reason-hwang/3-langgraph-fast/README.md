# LangGraph Fast Init

FastAPI and LangGraph starter project using `uv`.

## Setup

```sh
uv sync
```

## Run

```sh
uv run uvicorn server.server:app --reload
```

## LangGraph Studio

```sh
pnpm studio
```

The Studio config exposes `main_graph` and `tenk_subgraph` as separate graph modules.

## API

- `GET /health`: service health check.
- `POST /graph/run`: run the minimal LangGraph workflow.

Example:

```sh
curl -X POST http://127.0.0.1:8000/graph/run \
  -H 'content-type: application/json' \
  -d '{"message":"Say hello in one sentence","provider":"openai"}'
```

Use `provider: "chatgpt-oauth-proxy"` with `OPENAI_BASE_URL` pointing to the
running OAuth proxy (for example, `http://127.0.0.1:2890/v1`).
