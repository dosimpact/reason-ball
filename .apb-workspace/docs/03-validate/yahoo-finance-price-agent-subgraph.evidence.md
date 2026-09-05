# yahoo-finance-price-agent-subgraph Validation Evidence

Validation date: 2026-08-28 (Asia/Seoul)

## Automated checks

| Command | Result | Summary |
| --- | --- | --- |
| `uv run pytest tests/graph/shared tests/graph/subgraph/price_agent -q` | PASS | 28 passed |
| `pnpm test` | PASS | 93 passed, 7 skipped, 2 unrelated deprecation warnings |
| `pnpm typecheck` | PASS | 0 errors, 0 warnings |
| `pnpm build` | PASS | sdist and wheel built successfully |
| feature-scoped Ruff | PASS | `src/graph/shared`, `src/graph/subgraph/price_agent`, and matching tests passed |
| feature-scoped Pyright | PASS | 0 errors, 0 warnings |
| `git diff --check` on feature files/docs | PASS | no whitespace errors |

The repository-wide `pnpm lint` reports 54 pre-existing errors in files outside the
price-agent feature paths. The feature-scoped Ruff run is clean; unrelated files were not
modified as part of this goal.

## Live Yahoo Finance smoke

The adapter was executed twice in one process with `CPNG`, `interval=1d`, `count=10`, and a
cleared in-memory cache.

```text
symbol=CPNG
count=10
first_date=2026-08-17
last_date=2026-08-28
latest_close=16.571199417114258
latest_is_partial=true
first_cache_hit=false
second_cache_hit=true
error_code=null
```

This confirms a live Yahoo response, ten chronological daily values, inclusion of the current
partial bar, raw `Close`, and the process-local cache hit path. The quoted price is smoke-test
evidence, not a stable fixture.

## LangGraph Dev smoke

`uv run langgraph dev --no-browser --port 53291` started successfully. Startup logs imported
`main_graph`, `technical_analysis_graph`, and the independent `price_agent` graph. A
`POST /assistants/search` request returned an assistant with `graph_id=price_agent`, and the
server was then shut down cleanly.

## LLM/Studio limitation

An actual `run_price_agent("쿠팡의 최근 10개 일봉 종가를 알려줘.")` execution was attempted.
The graph reached `extract_request`, but the configured local OAuth proxy at
`http://127.0.0.1:2890/v1` was not running and returned `openai.APIConnectionError`.
Consequently, the live LangSmith Studio trace that includes the real LLM tool call is recorded
as SKIP. The same node/tool/collection/formatter sequence and exact one-call invariant pass in
the mocked graph tests.
