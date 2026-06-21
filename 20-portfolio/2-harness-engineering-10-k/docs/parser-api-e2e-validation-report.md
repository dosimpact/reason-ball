# Parser API E2E Validation Report

Date: 2026-04-16  
Scope: `3-10-k-parser` only  
Out of scope: `4-10-k-chat-bot-next`

## Verdict

Validation process passed for the currently implemented parser API surface.

- Bruno setup flow: `PASS`
- Bruno langgraph flow: `PASS`
- Parser API overall E2E verdict: `PASS`

## Validation Target

This report validates only the parser-integrated backend APIs:

- `POST /api/parser/init-neo4j`
- `POST /api/parser/parse-manifest`
- `POST /api/langgraph/threads`
- `POST /api/langgraph/threads/{threadId}/runs/stream`
- `GET /api/langgraph/threads/{threadId}/snapshot`
- `GET /api/langgraph/threads/{threadId}/stream`

## Environment

- Parser server base URL: `http://127.0.0.1:3314`
- Bruno collection: `3-10-k-parser/bruno-api-tests`
- Bruno environment override: `baseUrl=http://127.0.0.1:3314`
- Fixed runtime thread id: `11111111-1111-1111-1111-111111111111`

## Commands Executed

```bash
cd 3-10-k-parser
PYTHONPATH=src python3 -m parser.server --port 3314

cd 3-10-k-parser/bruno-api-tests
bru run setup --env local --env-var baseUrl=http://127.0.0.1:3314
bru run langgraph --env local --env-var baseUrl=http://127.0.0.1:3314
```

## Test Case Report

| Suite | Test Case | Endpoint | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| Setup | Init Neo4j constraints | `POST /api/parser/init-neo4j` | `200`, `status=ok`, `action=init-neo4j` | Returned `200 OK` and expected payload | PASS |
| Setup | Parse bundled mock manifest | `POST /api/parser/parse-manifest` | `200`, `total=1`, `success=1`, `failed=0` | Returned `200 OK`, parsed 1 record successfully | PASS |
| Setup | Graph write smoke | `POST /api/parser/parse-manifest` | At least one graph node written | Bruno test confirmed graph nodes > 0 | PASS |
| LangGraph | Create runtime thread | `POST /api/langgraph/threads` | `200`, fixed `threadId`, assistant id preserved | Returned expected thread and assistant ids | PASS |
| LangGraph | Run retrieval stream | `POST /api/langgraph/threads/{threadId}/runs/stream` | SSE contains `text-delta`, `data-retrieval-debug`, `data-selected-filing` | All expected SSE event types present | PASS |
| LangGraph | Persist thread snapshot | `GET /api/langgraph/threads/{threadId}/snapshot` | Messages and non-empty evidence bundle stored | Snapshot included messages and evidence bundle | PASS |
| LangGraph | Resume latest stream | `GET /api/langgraph/threads/{threadId}/stream` | SSE replay includes `text-delta` | Replay stream returned text delta events | PASS |

## Bruno Run Summary

### Setup Flow

- Requests: `2`
- Passed: `2`
- Failed: `0`
- Tests: `1/1`
- Assertions: `7/7`
- Status: `PASS`

### LangGraph Flow

- Requests: `4`
- Passed: `4`
- Failed: `0`
- Tests: `7/7`
- Assertions: `7/7`
- Status: `PASS`

## Observed API Results

### `parse-manifest`

The parser successfully processed the bundled mock filing and wrote graph data:

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

### `runs/stream`

The stream included:

- `text-start`
- multiple `text-delta`
- `text-end`
- `finish`
- `data-retrieval-debug`
- `data-selected-filing`

### `snapshot`

The runtime snapshot persisted:

- user and assistant messages
- selected filing metadata
- evidence bundle for grounded answer generation

## Issues Fixed Before Final Validation

1. Parser API manifest path resolution was corrected to resolve from project root.
2. Parser API CLI wrapper was updated to parse JSON summary output before treating non-zero exit as fatal.
3. Warning noise from Python dependency startup was prevented from masking API error handling.
4. `FilingSegmenter` constructor was made settings-aware so chunk config is loaded correctly.
5. Bruno langgraph test flow was stabilized with a deterministic thread id.
6. SSE assertions were aligned with the runtime’s actual JSON formatting.

## Residual Notes

- Validation used the bundled mock filing fixture, not production SEC data.
- `urllib3` still emits `NotOpenSSLWarning` at parser startup in this local Python environment, but it does not break API execution.
- This report intentionally excludes Next.js validation.

## Final Conclusion

The parser-only validation process passed, and the currently implemented parser API endpoints are working end-to-end for setup, graph seeding, LangGraph thread creation, retrieval streaming, snapshot persistence, and stream resume.
