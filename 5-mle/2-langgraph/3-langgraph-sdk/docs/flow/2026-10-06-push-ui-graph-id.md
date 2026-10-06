# 2026-10-06: Correct example 25 graph ID

Requirement: SDK-25.

- Context: the example sent `25_push_ui_message_example`, causing HTTP 422 because that graph is not registered.
- Change: the frontend stream request now uses `push_ui_message_example`, matching `langgraph.json`. No backend registration change.
- Stock: system design section SDK-25 records the canonical identifier.
- Validation: `pnpm lint` passed. The existing scoped Playwright CLI suite could not launch because its Chromium headless executable is not installed.
- Live browser fallback: Playwright MCP at localhost:2805 selected example 25 and ran the default prompt against localhost:2931. Request assistant_id was `push_ui_message_example`; stream returned HTTP 200. UI reached Run complete, final/render status completed, 4 UI messages and 1 unsupported-component fallback. The verification-created thread remains available in the dev server.
