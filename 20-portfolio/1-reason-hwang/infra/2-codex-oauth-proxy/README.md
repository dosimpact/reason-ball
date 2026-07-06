# chatgpt-oauth-proxy

Standalone local ChatGPT OAuth proxy for OpenAI-compatible client calls.

## Security Notice

This project stores ChatGPT OAuth tokens under the local project directory. Do not commit, publish, share, or back up `.config/chatgpt_auth.json` to an untrusted location.

Run this proxy on a trusted local machine only. The server binds to `127.0.0.1` by default and is not intended to be exposed to a network.

This is not an official OpenAI API service or API key replacement. Review the applicable service terms and policies before using it.

## Setup

```bash
uv sync
```

## Login

```bash
uv run python -m core.oauth_login --manual-callback
```

The token file is stored under this library root:

```text
chatgpt-oauth-proxy/.config/chatgpt_auth.json
```

## Run Proxy

```bash
uv run python proxy-server/main.py --serve
```

Default endpoints:

```text
http://127.0.0.1:18741/health
http://127.0.0.1:18741/v1/responses
http://127.0.0.1:18741/v1/chat/completions
```

## Run with Docker

Authenticate once on the host so the token file exists:

```bash
uv run python -m core.oauth_login --manual-callback
```

The token file is stored at:

```text
20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config/chatgpt_auth.json
```

Build and run the proxy image:

```bash
docker build -t codex-oauth-proxy .
docker run --rm \
  -p 127.0.0.1:18741:18741 \
  -v "$PWD/.config:/app/.config" \
  codex-oauth-proxy
```

The container does not run the interactive OAuth login flow. It reads the
mounted auth JSON and writes refreshed tokens back to the same mounted path.

## Reason Hwang Infra

From the repository root, the proxy is included in the existing infra startup:

```bash
pnpm infra-up:reason-hwang
```

The compose stack mounts:

```text
20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config -> /app/.config
```

If the auth file was created in the original reference project, copy it
intentionally before starting Docker:

```bash
mkdir -p 20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config
cp /Users/studio/workspace/projects/chatgpt-oauth-proxy/.config/chatgpt_auth.json \
  20-portfolio/1-reason-hwang/infra/2-codex-oauth-proxy/.config/chatgpt_auth.json
```

## SDK Smoke Test

```bash
OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python examples/sdk.py
```

## LangGraph Smoke Test

Start the proxy first:

```bash
uv run python proxy-server/main.py --serve
```

Then run the LangGraph example in another terminal:

```bash
OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python examples/langgraph.py
```

## All-In-One Local Run

From the `chatgpt-oauth-proxy` root:

```bash
cd ~/workspace/projects/chatgpt-oauth-proxy

# Install dependencies from pyproject.toml / uv.lock.
uv sync

# One-time login. Use --manual-callback when localhost redirect cannot be reached
# automatically and paste the full callback URL from the browser address bar.
uv run python -m core.oauth_login --manual-callback

# Re-authenticate later if you switch accounts or refresh tokens stop working.
uv run python -m core.oauth_login --force --manual-callback

# Start the proxy in the foreground.
uv run python proxy-server/main.py --serve
```

In another terminal:

```bash
cd ~/workspace/projects/chatgpt-oauth-proxy

# Health check.
curl http://127.0.0.1:18741/health

# Responses API smoke test.
curl -s http://127.0.0.1:18741/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer chatgpt-oauth-placeholder" \
  -d '{
    "model": "gpt-5.4-mini",
    "input": "Say hello in one short sentence."
  }'

# Chat Completions smoke test.
curl -s http://127.0.0.1:18741/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer chatgpt-oauth-placeholder" \
  -d '{
    "model": "gpt-5.4-mini",
    "messages": [
      {"role": "user", "content": "Say hello in Korean."}
    ]
  }'

# OpenAI SDK Responses example.
OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python - <<'PY'
from openai import OpenAI

client = OpenAI()
resp = client.responses.create(
    model="gpt-5.4-mini",
    input="한 문장으로 자기소개해줘.",
)
print(resp.output_text)
PY

# OpenAI SDK Chat Completions example.
OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python - <<'PY'
from openai import OpenAI

client = OpenAI()
resp = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": "한 문장으로 인사해줘."}],
)
print(resp.choices[0].message.content)
PY

# File-based examples.
OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python examples/sdk.py

OPENAI_BASE_URL=http://127.0.0.1:18741/v1 \
OPENAI_API_KEY=chatgpt-oauth-placeholder \
uv run python examples/langgraph.py
```
