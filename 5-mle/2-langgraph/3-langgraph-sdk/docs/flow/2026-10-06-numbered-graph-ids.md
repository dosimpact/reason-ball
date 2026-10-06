# 2026-10-06: Numbered LangGraph identifiers

## Context and decision

The user requested numeric prefixes on graph keys in `langgraph.json` so graph identifiers align with the numbered example catalog.

## Change and rationale

- Prefixed all 49 graph keys with the two-digit example number, for example `sdk_connection` became `01_sdk_connection`.
- Updated graph-id references in SDK calls, frontend examples, CopilotKit runtime registration, Python graph metadata, E2E plans, progress records, and SDK documentation.
- Kept Python module paths unchanged; they already include the example number.

Affected stock section: system design, SDK-GRAPH-ID.

## Validation and follow-up

- JSON validation confirmed 49 unique graph ids, each prefixed with its numbered example; all 13 CopilotKit registry keys match their `graphId` values.
- `pnpm --dir 5-mle/2-langgraph/3-langgraph-sdk lint` passed.
- `git diff --check` passed. Live graph-server execution was not run.
