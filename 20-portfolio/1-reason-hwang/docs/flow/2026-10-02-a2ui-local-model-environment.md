# A2UI-OPS-ENV-001: local model environment loading

- Date: 2026-10-02
- Scope: FastAPI launch scripts; Dynamic A2UI local operation.
- Context: `/a2ui/dynamic` returned HTTP 422 `Set A2UI_MODEL (or OPENAI_MODEL)` after a launch without `--env-file`. The existing ignored `.env` already contained OPENAI_MODEL and the local OAuth proxy URL.
- Change: `dev` and `start` load `.env` explicitly and invoke `python -m uvicorn`. The existing virtualenv uvicorn launcher referenced a different checkout; module invocation uses the active interpreter.
- Rationale: retain explicit model/provider configuration rather than adding a hardcoded model fallback. Process environment takes precedence over dotenv values. No credential contents were copied or committed.
- Stock: [A2UI operations](../stock/tech-shared/a2ui-system/operations-and-validation.md), [workspace commands](../stock/tech-shared/workspace.md).

## Validation

Given the existing local model configuration, when the committed dev script starts and the user submits `전체 매출 현황을 KPI와 차트로 보여줘`, then Dynamic completes with validated KPI and chart surfaces rather than the missing-model 422.

- VAL-BROWSER-001 PASS: Chrome CUA MCP opened `http://127.0.0.1:2800/a2ui/dynamic`, submitted the prompt, observed progressive preview then 작업 완료 and 요청한 화면을 준비했습니다. Revenue $680,000, quota $630,000, attainment 107.9%, and regional/monthly/owner charts were present in the accessibility tree. Screenshot visually confirmed final KPIs.
- VAL-API-001: existing `test:a2ui:api` collection against port 8000: initial run 10/11 requests, 14/15 tests, 12/12 assertions. Dynamic batch, progressive preview, sales action, and invalid rendering-option checks passed. Fixed reverse-route check failed with RUN_ERROR; Full rerun PASS: 11/11 requests, 15/15 tests, 12/12 assertions, including Fixed reverse route. The initial model-generation failure did not reproduce; both runs are retained here.
- `git diff --check` PASS; DB health returned `{"ok":true}`.

## Resources

The previous turn owned FastAPI process 46888/46890 was stopped normally and its tool session exited; `ps` confirmed both PIDs absent. Replacement service is started by `pnpm --filter reason-hwang-langgraph-fast dev` (session 99992, reloader 47908) and remains running for the user, as requested. Existing frontend, BFF, Docker infrastructure and OAuth proxy are preserved. Created Chrome verification tab 52017595 was explicitly closed. No additional test servers or browser profiles were created.
