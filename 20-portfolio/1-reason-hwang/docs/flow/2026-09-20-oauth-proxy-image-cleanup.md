# OAuth Proxy Image Cleanup

- Date: 2026-09-20
- Context: Code review found an unused Compose environment variable, files copied into the runtime image without being used, and example-only libraries installed as production dependencies.
- Change:
  - Removed the ineffective Compose host/port environment settings and redundant Dockerfile host/port environment values. The explicit container command continues to bind `0.0.0.0:18741`, while `CODEX_OAUTH_PROXY_PORT` controls the loopback host port and defaults to `2890`.
  - Removed `examples/` and `README.md` from the Docker runtime image.
  - Kept `aiohttp` as the sole production dependency and moved `openai`, `langchain-openai`, and `langgraph` to the `dev` dependency group.
- Rationale: Keep container configuration unambiguous and reduce the runtime image dependency and file surface without changing local examples or proxy behavior.
- Affected stock sections: `docs/stock/system-design.md` — Data and infrastructure.
- Validation:
  - `uv lock` and `uv sync --frozen`: PASS.
  - `pnpm test`: PASS (17 passed, 2 credential-gated live tests skipped).
  - `pnpm lint`: PASS.
  - `docker compose config`: PASS.
  - `pnpm build`: PASS; the image installed only the 10-package `aiohttp` runtime tree.
  - Runtime image inspection: PASS; `examples/`, `README.md`, `openai`, `langgraph`, and `langchain_openai` are absent, while `aiohttp` and `core` import successfully.
  - `git diff --check`: PASS.
