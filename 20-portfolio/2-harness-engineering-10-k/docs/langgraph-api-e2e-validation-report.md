# LangGraph API E2E Validation Report

Date: 2026-04-16  
Workspace: `/Users/studio/.openclaw/workspace/harness-engineering-10-k`
Revalidated At: 2026-04-16 01:20:53 KST

## Summary

Current validation process passed end-to-end.

- Parser Bruno setup flow: `PASS`
- Parser Bruno langgraph flow: `PASS`
- Next parser-backed chat smoke: `PASS`
- Unified validation script: `PASS`

Latest revalidation on `2026-04-16 01:20:53 KST` also passed end-to-end with the same parser and Next base URLs:

- Parser Bruno setup flow re-run: `PASS`
- Parser Bruno langgraph flow re-run: `PASS`
- Next parser-backed chat smoke re-run: `PASS`
- Unified validation script re-run: `PASS`

## Validation Environment

- Parser server: `http://127.0.0.1:3313`
- Next dev server: `http://127.0.0.1:3302`
- Bruno collection: `3-10-k-parser/bruno-api-tests`
- Unified script: `scripts/validate-parser-langgraph-e2e.sh`

## Commands Executed

```bash
cd 3-10-k-parser && python3 -m pip install -r requirements.txt
npm install -g @usebruno/cli

cd 3-10-k-parser && PYTHONPATH=src python3 -m parser.server --port 3313
cd 4-10-k-chat-bot-next && PARSER_BACKEND_URL=http://127.0.0.1:3313 ./node_modules/.bin/next dev --port 3302

cd 3-10-k-parser/bruno-api-tests && bru run setup --env local --env-var baseUrl=http://127.0.0.1:3313
cd 3-10-k-parser/bruno-api-tests && bru run langgraph --env local --env-var baseUrl=http://127.0.0.1:3313

BASE_URL=http://127.0.0.1:3302 4-10-k-chat-bot-next/tests/parser-backed-chat-smoke.sh

PARSER_BASE_URL=http://127.0.0.1:3313 NEXT_BASE_URL=http://127.0.0.1:3302 ./scripts/validate-parser-langgraph-e2e.sh
```

## Test Cases

| Suite | Test Case | Endpoint / Flow | Expected | Result |
|---|---|---|---|---|
| Parser Setup | Init Neo4j constraints | `POST /api/parser/init-neo4j` | Returns `200`, `status=ok`, `action=init-neo4j` | PASS |
| Parser Setup | Parse mock manifest into Neo4j | `POST /api/parser/parse-manifest` | Returns `200`, `total=1`, `success=1`, graph nodes written | PASS |
| LangGraph | Create runtime thread | `POST /api/langgraph/threads` | Returns fixed `threadId` and assistant id | PASS |
| LangGraph | Run retrieval stream | `POST /api/langgraph/threads/{threadId}/runs/stream` | Returns SSE with `text-delta`, `data-retrieval-debug`, `data-selected-filing` | PASS |
| LangGraph | Read thread snapshot | `GET /api/langgraph/threads/{threadId}/snapshot` | Persists messages and non-empty `evidence_bundle` | PASS |
| LangGraph | Resume latest thread stream | `GET /api/langgraph/threads/{threadId}/stream` | Replays SSE with `text-delta` | PASS |
| Next Chat | Parser-backed chat stream | `POST /api/chat` | Emits parser-backed SSE chunks without backend error text | PASS |
| Next Chat | Parser-backed resume stream | `GET /api/chat/{id}/stream` | Replays assistant text delta stream | PASS |
| Unified Flow | Wrapper validation script | `./scripts/validate-parser-langgraph-e2e.sh` | All 3 stages finish with zero exit code | PASS |

## Observed Evidence

### Parser `parse-manifest`

- Response summary after fix:

```json
{
  "total": 1,
  "success": 1,
  "failed": 0,
  "results": [
    {
      "segments": 4,
      "graph_nodes": 39,
      "graph_relationships": 53,
      "written_nodes": 39,
      "written_relationships": 53
    }
  ],
  "errors": []
}
```

### LangGraph run stream

- SSE contained:
  - `text-start`
  - multiple `text-delta`
  - `text-end`
  - `finish`
  - `data-retrieval-debug`
  - `data-selected-filing`

- Retrieved grounded answer included `Sample Technology Inc.` and `Item 1A` risk citations.

### Next parser-backed chat

- `/api/chat` returned SSE chunks forwarded from parser backend.
- `/api/chat/{id}/stream` replayed assistant text deltas successfully.

### Revalidation run on 2026-04-16 01:20:53 KST

- `bru run setup --env local --env-var baseUrl=http://127.0.0.1:3313`: `PASS`
- `bru run langgraph --env local --env-var baseUrl=http://127.0.0.1:3313`: `PASS`
- `BASE_URL=http://127.0.0.1:3302 4-10-k-chat-bot-next/tests/parser-backed-chat-smoke.sh`: `PASS`
- `PARSER_BASE_URL=http://127.0.0.1:3313 NEXT_BASE_URL=http://127.0.0.1:3302 ./scripts/validate-parser-langgraph-e2e.sh`: `PASS`

## Fixes Required To Reach Passing State

1. Parser API manifest path resolution was corrected to use project root instead of `src/`.
2. Parser CLI wrapper was updated to parse valid JSON output even when the CLI exits non-zero for batch summaries.
3. Parser CLI wrapper now suppresses Python warning noise from breaking error handling.
4. `FilingSegmenter` was made settings-aware so `AppConfig` is not mis-bound to `max_chars`.
5. Bruno langgraph requests were changed to use a deterministic `runtimeThreadId` so folder execution is stable.
6. Bruno SSE assertions were updated to match the actual JSON spacing emitted by the runtime.
7. Next smoke assertions were updated to match the actual SSE event formatting.
8. Unified validation script now runs Bruno from collection root and injects parser/next base URLs explicitly.

## Residual Risks

- Validation currently uses a bundled mock filing manifest, not a real SEC filing corpus.
- Next validation is shell-based smoke coverage, not browser automation.
- `urllib3` still emits `NotOpenSSLWarning` on server startup in this macOS Python environment, although it no longer breaks the validation flow.
- TypeScript full-project typecheck was not used as a release gate here because the repository already contains unrelated pre-existing typing failures outside this feature path.

## Final Verdict

The current validation process passed for the implemented parser-integrated LangGraph runtime and parser-backed Next chat flow.
