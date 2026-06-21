# 01 SDK Connection

## Coding Scope

- Graph: `graphs/01_sdk_connection.py` exposes the simplest assistant entrypoint with one node that echoes input and emits a small state update.
- Frontend: `src/examples/01-sdk-connection/` provides assistant selection, thread controls, run controls, and a stream event log.
- Shared code: create reusable LangGraph client utilities instead of constructing SDK clients in the component.

## Implementation Plan

1. Register a `sdk_connection` graph in `langgraph.json`.
2. Add SDK helpers for assistants, threads, runs, stream subscription, and error normalization.
3. Build UI panels for server status, assistant list, thread create/delete/reuse, run input, run status, and stream events.
4. Persist the selected assistant and current thread in local component state only.

## SDK And State Notes

Use `Client.assistants.search`, thread create/get/delete APIs, run creation, and streaming events. Display raw event type, run id, status, and final values.

## Risks

- SDK event shapes may change by LangGraph version, so retain a raw event log.
- A missing dev server or invalid `.env` must fail visibly instead of silently.

## Acceptance Criteria

- The UI lists available assistants from the running LangGraph server.
- A user can create a thread, run the selected assistant, see streaming events, and delete the thread.
- Errors from missing server or invalid assistant are visible in the UI.
