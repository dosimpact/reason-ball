# ohlcv-talib-analysis-agent Validation Evidence

## Environment

- Project: `20-portfolio/1-reason-hwang/3-langgraph-fast/`
- Runtime: Python 3.12.14, LangGraph API 0.13.2, TA-Lib 0.7.1
- Validation date: 2026-08-29 (Asia/Seoul)

## Command Evidence

| Check | Command / observation | Result |
| --- | --- | --- |
| Feature tests | `pnpm test:technical-analysis` | PASS — 14 passed |
| Full regression | `pnpm test` | PASS — 101 collected, 94 passed, 7 PostgreSQL-environment skips |
| Feature lint | `uv run --with ruff ruff check <technical-analysis scope>` | PASS — no findings |
| Type check | `pnpm typecheck` | PASS — 0 errors, 0 warnings |
| Build | `pnpm build` | PASS — sdist and wheel built |
| Feature coverage | `coverage run --source=<technical-analysis modules> -m pytest ...` | PASS — 463 statements, 26 missed, 94% |
| Full lint baseline | `pnpm lint` | FAIL — 54 findings in pre-existing/out-of-scope 10-K, Neo4j, PostgreSQL, server, and integration-test modules; feature-scoped lint is clean |
| Dev server health | `uv run langgraph dev --no-browser --port 53291`; `GET /ok` | PASS — server loaded all graphs |
| Graph registration | `POST /assistants/search` | PASS — `main_graph`, `technical_analysis_graph`, and `price_agent` returned |
| Invalid-input Standard API run | `POST /runs/wait` with empty `prices` | PASS — deterministic `prices: at least one PriceData item is required`, no model call |
| Live-model dev run | Valid 80-point prices through Standard API | PASS — project configuration reached the healthy proxy directly on `18741`; model issued one SMA(20)/RSI(14)/MACD(12,26,9) tool call and returned a grounded final answer |
| Standard API stream | `POST /runs/stream` with `stream_mode=["updates"]` on port `53291` | PASS — emitted `validate_price`, `call_model`, `tools`, `call_model`; exposed exact tool arguments, three successful indicator results, and grounded final response |
| LangSmith Studio UI | Opened Studio in Chrome | OPTIONAL — current browser session is logged out; not a validation gate because Standard API supplies the authoritative graph/run events |

## E2E Evidence

| ID | Result | Evidence |
| --- | --- | --- |
| E2E-01 | PASS | Engine tests compare SMA/RSI/MACD results with direct TA-Lib calls. |
| E2E-02 | PASS | Engine batch test merges SMA, RSI, ATR, and OBV from all four category registries. |
| E2E-03 | PASS | Normalization tests preserve input length, convert NaN warm-up values to `None`, and select the last valid value. |
| E2E-04 | PASS | Graph test keeps 80-point full series in `analysis_result` while the ToolMessage contains only five recent points. |
| E2E-05 | PASS | Validation test rejects mixed symbols before model execution; engine tests return structured insufficient-data outcomes. |
| E2E-06 | PASS | `/runs/stream` returned one model tool call containing exactly SMA(20), RSI(14), and MACD(12/26/9); TA-Lib produced successful results and the final answer cited only computed values. |
| E2E-07 | PASS | Engine converts adapter exceptions to sanitized indicator error outcomes without a stack trace or sibling-result loss. |
| E2E-08 | PASS | Fake `TechnicalAnalysisEngine` completes the graph loop once; architecture test confines `import talib` to the infrastructure boundary. |
| E2E-09 | PASS | Separate overlap, momentum, volatility, and volume category tests pass. |
| E2E-10 | PASS | `/assistants/search` returned `main_graph`, `technical_analysis_graph`, and `price_agent`; `/runs/stream` exposed `validate_price → call_model → tools → call_model`, tool input/output, and final response. |
| E2E-11 | PASS | Full regression passes and dev API exposes all three graphs without replacing existing registrations. |

## Runtime Notes

- The graph loads without making a model request at import time.
- The live dev request completed `validate_price → call_model → tools → call_model → END` through the OAuth proxy.
- The provider default, `.env.example`, and local `.env` now target the proxy's actual `18741` port; a second `/runs/wait` run succeeded without a temporary forward.
- The LangGraph dev process was stopped cleanly after verification.
- The 2026-08-29 regression run exposed a weekend-dependent Yahoo fixture. Its exchange clock is now fixed in the test, so `is_partial` behavior is deterministic across weekdays and weekends; the full suite then returned 94 passed and 7 environment skips.
- No unrelated lint findings were modified because they are outside this feature plan and include concurrent user work.
