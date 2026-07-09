# claude-code-proxy

Local OpenAI-compatible proxy backed by Claude Code CLI print mode.

This server exposes a small subset of the OpenAI API:

```text
http://127.0.0.1:18742/health
http://127.0.0.1:18742/v1/chat/completions
http://127.0.0.1:18742/v1/responses
```

It translates incoming requests into a prompt and runs:

```bash
claude --bare -p "<prompt>" --output-format json
```

## Requirements

Install and authenticate Claude Code first:

```bash
claude --version
claude -p "Say hello" --output-format json
```

If your Claude Code default model is not available, set a model that your
account can use:

```bash
CLAUDE_CODE_MODEL=sonnet uv run python proxy-server/main.py --serve
```

## Setup

```bash
uv sync
```

## Run

```bash
uv run python proxy-server/main.py --serve
```

## SDK Smoke Test

```bash
OPENAI_BASE_URL=http://127.0.0.1:18742/v1 \
OPENAI_API_KEY=claude-code-placeholder \
uv run python examples/sdk.py
```

## Notes

This is a subprocess wrapper, not a direct Anthropic API proxy. It is useful for
local automation and development, but it has different latency and feature
limits than a native LLM API. Keep it bound to `127.0.0.1`.
