# Simple push UI message

Independent chat example derived from graph-basic example 47. `model → tools → model` uses real model-selected tool calls; custom UI progress is emitted before/after each operation and retained by `ui_message_reducer`. `metadata.message_id` points to the final assistant ID allocated before the first operation.

Tools search local demo notes and aggregate fixed sales records. No internet search, production DB access, private reasoning, or durable conversation storage is implied. UI progress is persisted within a graph invocation; the demo browser retains completed turn history until reload/new conversation.

From the independent workspace root:

```sh
pnpm --filter reason-hwang-langgraph-fast dev
pnpm --filter reason-hwang-fe-host dev
```

Open `http://127.0.0.1:2800/examples/push-ui-message` and ask `매출 집계 기준을 조사하고 서울 매출을 조회해줘`, then `부산도 조회해서 비교해줘`.

The server uses the existing A2UI model factory (including OAuth Responses compatibility), so A2UI_MODEL or OPENAI_MODEL and the local provider/base URL must be configured. No new credentials are needed. Final answer text is delivered at completion; operation status events are streamed while running.

Code ownership: this folder, `server/push_ui_message/`, and frontend `features/push-ui-message/`. Integration points are FastAPI router registration, `langgraph.json`, the thin Next page/proxy route, and scoped test scripts. The copied template's weather file is retained, but it is not registered as a tool in this example.

[Design and validation scenarios](../../../../../docs/stock/tech-shared/push-ui-message/INDEX.md)
