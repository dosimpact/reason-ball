# LangGraph SDK examples: system design

Current state: 2026-10-06.

## Frontend and runtime boundaries

The `langgraph-sdk-examples` package uses TypeScript, React, Vite, and `lucide-react`. `src/App.tsx` owns active example selection, five expandable navigation groups, the mobile menu, and component rendering. `src/data/examples.ts` owns catalog metadata. Selection is local React state; this interface update introduces no URL-routing change.

`src/lib/langgraphClient.ts` centralizes LangGraph client creation and API URL resolution. Existing examples use LangGraph SDK direct calls or React hooks. Graph entry points and registration remain in the Python project. CopilotKit examples additionally use the existing runtime service and Vite `/api/copilotkit` proxy to port 2932. UI-GH-01 does not change runtime configuration, SDK payloads, graph IDs, or environment variables.

The committed frontend `dev` script launches Vite on port 2805. The graph command documented in `README.md` uses `uv run langgraph dev --host 0.0.0.0 --port 2931 --tunnel`. Live graph/provider verification requires the matching backend to be available.

Detailed plans under `plan/` retain their English source text and append a Korean translation after a horizontal rule. Keep code identifiers, paths, and API names unchanged in both sections when updating a plan.

## SDK-GRAPH-ID: numbered graph identifiers

Every key registered in `langgraph.json` uses its two-digit example number as a prefix, such as `01_sdk_connection` and `25_push_ui_message_example`. SDK calls, CopilotKit runtime registrations, graph metadata, and examples must use the same graph id.

## UI-GH-01: styling ownership

`src/styles.css` defines shared semantic color variables, existing example layouts, and reusable controls. Repeated shared palette literals now use tokens for surfaces, borders, text, accent, success, attention, and danger. Core shared rules retain their layout properties and use compact GitHub-style controls.

`src/github-theme.css`, imported after the shared styles in `src/main.tsx`, defines the new repository header and overview, focused component refinements, empty response styling, and responsive adaptations. Existing example layouts and feature-specific A2UI styles remain in their current files. No new package dependency or lockfile change is needed.

The shell uses a 288 px sidebar above 1150 px, a 260 px sidebar between 920 and 1150 px, and a single-column mobile layout at 920 px or below. Mobile navigation retains its explicit open/closed state. Existing example grid breakpoints remain authoritative.

## Checks and evidence

- `pnpm --filter langgraph-sdk-examples lint`: TypeScript checking through `tsc --noEmit`.
- `pnpm --filter langgraph-sdk-examples build`: TypeScript project build plus Vite production build.
- Browser visual/navigation checks follow `e2e-plan/github-design-system.md`; record actual results in `progress/e2e-progress.md`.
- A passing frontend build does not establish live graph/provider success.

## UI-PUSH-CHAT-25: state and streaming

`graphs/25_push_ui_message.py` extends `MessagesState` with `ui`, `assistant_message_id`, `stage_results`, `final_status`, and `error` in addition to inherited `messages`. Final text lives only in the Assistant message; UI stages live in UI props. There is no separate `workflow_id`, `answer`, `final`, or `ui_render_status` state. The graph runs prompt preparation, three explicitly named LLM/push-UI nodes, and final answer generation. `build_graph()` declares each node and edge explicitly by name, without loops or positional lookup. The shared `route_after_stage` sends failed stages to END and successful stages to their explicitly declared successor. Preparation unconditionally generates a fresh Assistant UUID every turn, from which work/stage UI IDs are derived; progress UI links to the final response through `metadata.message_id`. Each stage emits running UI before its LLM call, then updates the same UI ID using `merge=True`; stage exceptions emit failed UI, persist failed status and the placeholder, and route to END. Preparation adds one empty Assistant placeholder; final generation replaces that same ID rather than appending another response. Every model input excludes empty Assistant placeholders. The work lifecycle UI shares the ID with the three progress cards; stage completion includes a short public result summary.

`PushUiMessageExample.tsx` sends messages rather than a separate prompt, reuses its thread for follow-ups, merges update/custom streams by ID, and reconciles with thread state after each run. It renders UI by assistant message ID, preserves conversation history and empty placeholders, and handles stream errors. The frontend sends only the user message. Preparation creates the Assistant placeholder and ID on the backend; its streamed update creates one Assistant bubble in the frontend. Its final content is updated in place; there is no separate pending-response bubble. Failed placeholders stay in history. The message list preserves the user’s scroll position; updates do not force scrolling. ProgressMessage renders li elements inside a semantic ul with the stage title, status, and summary inline; scoped progress-list styles replace card styling for example 25. A native details/summary wraps each turn’s progress list and starts closed. Its DOM remains mounted during progress and final-content updates, preserving the user’s open/closed choice. Final answer content sits outside the disclosure. This example uses four provider calls per turn and fixed dummy material; it performs no real search. Stream modes are messages-tuple/updates/custom. Tuple payloads arrive as messages events containing [chunk, metadata]. The tuple boundary validates the required fields with a local Zod schema; textContent separately extracts strings/text blocks, and assistantDelta applies Assistant/tag filtering and ID selection. The generic tuple parser resolves metadata.message_id when explicitly supplied, otherwise chunk.id; it has no graph-state-field or node-name dependency. Text chunks accumulate directly in a single ChatMessage[] by ID; early chunks create a running Assistant message when no placeholder exists yet. Server messages are normalized into this same display model. Snapshots establish server order/content while preserving unconfirmed input and running/failed partial replies at their previous positions. Example 25 supplies metadata.message_id on the final LLM invocation to match the progress placeholder and persisted response ID. This is an application contract, not a required SDK field. Internal calls use langsmith:nostream; non-text blocks are ignored. Node updates and final thread state confirm the saved answer without duplicated tokens; completed messages ignore late deltas. Failed turns retain received partial text and failed status in the same messages array. Optimistic user submissions also enter this array; a matching server message confirms them by ID. The migrated example-25 E2E spec passed four Chromium tests at http://localhost:2805/: live provider stage ordering, progressive answer, saved-state equality, multi-turn history and new-chat behavior; browser-isolated fixtures cover UI patches/removal/fallback and interrupted partial answers. Provider interruption/recovery itself remains unverified. Evidence: docs/flow/2026-10-06-push-ui-e2e.md and playwright-report/index.html.

## LLM-MODELS-06: configured model aliases

User-specified model IDs are synchronized across `.env`, `.env.example`, and `common/llm.py` fallbacks: default/fast/normal use `gpt-6-luna`; smart/reasoning use `gpt-6-sol`. `OPENAI_MODEL=default`. Per-alias environment variables override fallback values, and `LANGGRAPH_MODEL` still takes precedence over `OPENAI_MODEL`. The obsolete `OPENAI_MODEL_CHEAP` fallback is removed. Model configuration is read at module import, so restart the graph process to apply changes. These IDs were configured as requested; provider availability was not checked.

## SDK-GRAPH-COMMENTS: 한국어 코드 안내

`graphs/`의 50개 Python 소스(01–49번 예제와 `__init__.py`)에 예제 목적과 실행 흐름을 설명하는 한국어 주석을 둡니다. 상태 타입, reducer 병합, 그래프 구성과 서버 진입점, 주요 처리 및 분기, 단독 실행 데모를 중심으로 설명합니다. 고정 자료·시뮬레이션과 실제 모델/API 호출의 경계를 명시하며, 모델용 프롬프트·도구 docstring·실행 로직은 유지합니다. 검증 및 변경 기록: `docs/flow/2026-10-06-korean-graph-comments.md`.

## UI-PUSH-TYPES-25: progress payload contract

The example frontend defines ThinkingStatusProps from a Zod schema: title/summary are strings, stage is a nonnegative integer, total is a positive integer, status is running/completed/failed, and dummy is boolean. ThinkingStatusUpdate is Partial<ThinkingStatusProps> for merge events. Metadata types cover message_id, schema_version, ordinal, and merge. Initial payloads are validated as full props; merge payloads allow partial props. ThinkingStatusMessage explicitly pairs name="thinking_status" with props: ThinkingStatusProps. ThinkingStatusUpdateMessage pairs that same name with partial props and metadata.merge=true. Stream events are merged and validated before entering React state as complete ThinkingStatusMessage objects. Unknown/incomplete payloads use a separate UnsupportedUIMessage variant for JSON fallback; the renderer narrows by type and name, with JSON fallback for UI names without a dedicated renderer. The progress denominator uses props.total rather than a hardcoded 3. Zod is an existing dependency.

## UI-PUSH-READABILITY-25 / UI-PUSH-LAYERS-25: frontend layers

Example 25 keeps related responsibilities in eight files under `src/examples/25-push-ui-message/`:

- `PushUiMessageExample.tsx`: screen composition, composer/form event binding, and runtime controls.
- `ChatMessageBubble.tsx`: message/progress rendering, icons, labels, and the native per-turn disclosure.
- `RunDiagnostics.tsx`: final state and raw stream event presentation.
- `usePushUiChat.ts`: thread creation/reuse, SDK requests, stream routing, and final state lookup. It accepts no DOM event.
- `usePushUiChatState.ts`: React state, derived busy, grouped turn transitions, and applying updates or final snapshots. The single messages reducer handles optimistic user input, streamed text, server updates/snapshots, failure and reset. There are no drafts, pendingUser or messageViews states/selectors.
- `chatMessages.ts`: ChatMessage display model and the pure chatMessagesReducer. Server normalization and precedence rules are centralized here; rendered messages are a client model, not raw server objects.
- `uiMessages.ts`: named UI types/schemas/registration, payload validation, ID-based merge/removal, resolution/fallback, failure marking, and progress lookup by message ID.
- `stream.ts`: plain record validation, node-update extraction, and generic Assistant ID/text delta parsing. It contains no React state or SDK calls.

Pure data modules have no React dependency. Components import types from the owning data modules, rather than through hooks. The screen retains existing public ThinkingStatus type exports. Non-message state uses useState; messages uses useReducer. startTurn/completeTurn/failTurn/resetChat remain. Presentation labels stay with their component; no generic service wrappers are introduced. ChatMessageBubble keeps its disclosure mounted and the answer outside it. Validation and change evidence: `docs/flow/2026-10-06-push-ui-layers.md`.

## UI-PUSH-STATUS-25: request lifecycle

The hook stores only status (idle/running/completed/failed) for request activity. busy is derived as status === "running"; there is no separate busy state or setter. Streamed final_status does not end the frontend request lifecycle: status stays running until stream consumption and final state reconciliation complete. Success sets completed; exceptions set failed.

The state hook groups related setters into startTurn (prepare a request and append user input), completeTurn (reconcile final server state and confirm completion), failTurn (display failure and restore input), and the existing resetChat. Message transitions dispatch reducer actions; independent thread/UI/error/diagnostic state retains useState.

## UI-PUSH-MERGE-25: common merge and named UI resolution

`uiMessages.ts` separates three pure operations: `normalizeUi` validates the incoming envelope and, for registered names, complete or partial props; `mergeUi` applies ID-based updates, removal, shallow props patches, and metadata merging; `resolveUi` validates merged props using the matching `uiDefinitions` entry and returns a typed UI message or JSON fallback. `applyUiMessages` normalizes incoming values and connects them through `mergeUi(current, incoming).map(resolveUi)` for both node-state updates and custom events; the state hook only stores the resulting list.

The common merge function contains no UI-specific schema or `thinking_status` construction. Registering `defineUi(name, objectSchema)` derives another supported message variant without editing merge logic. Dedicated display behavior is added in the view as needed; unrendered names use JSON fallback. Progress failure and final-answer waiting behavior apply only to `thinking_status`. If an existing ID changes UI name, props and metadata from the old name are not inherited. Partial patches remain shallow, and arrays/nested objects are replaced when supplied.

## EXAMPLES-LAYERS-06: independent example modules

All 54 frontend example folders use local responsibility boundaries. Example 25 retains its existing eight-file split; the remaining 53 folders, including SDK React-hook variants and CopilotKit examples, have been refactored. Public entry component paths/exports remain stable for src/App.tsx. Each example owns its controller hook, state transitions where needed, data types/parsing, and substantive presentation components. SDK examples often use RuntimeControls, ResultPanels/ResultsPanels and RunDiagnostics; CopilotKit examples keep the provider in the public entry and execute registration hooks inside the child chat view, with ToolRenderers and model schemas kept local. Complex approval, recipe, predictive document and preview state have dedicated state hooks. Small rendering-only selection state can stay with its renderer.

Pure data modules do not import React; browser file/canvas/storage adapters stay separate. DOM form/change/drag event handling belongs to views; controllers receive values. Existing shared SDK/CopilotKit helpers remain; no sibling example imports or runtime import cycles were added. Graph IDs, stream modes, tool names/schemas, payloads, provider boundaries, hooks and existing visible behavior are preserved. No backend, runtime, package, lockfile or common stylesheet changes belong to this refactor.

The module-count inventory and worker ownership are in plan/examples-layer-refactor.md; individual plans describe local roles in English and Korean. Audit/build evidence is in docs/flow/2026-10-06-examples-layer-refactor.md. Static checks are distinct from live-provider/browser verification; this refactor does not claim all-example E2E coverage.

## UI-PUSH-SSOT-25: one display message state

The client display uses one `messages: ChatMessage[]`, each with id, role, text content and lifecycle status. The server remains authoritative for persisted conversation state; raw responses are retained only as final-state/stream diagnostics, not a second rendered-message source.

`chatMessagesReducer` accepts start/delta/server/fail/reset actions. Deltas append only to running Assistant messages; completed/failed messages ignore late deltas. Server final text replaces accumulated text instead of appending it. Empty running/failed placeholders preserve received text, and a late running placeholder cannot reopen a terminal message. Final snapshots keep server-confirmed messages and preserve unconfirmed input or partial replies at their existing position. Failure marks local running messages failed without clearing their text. The view consumes messages directly.

Validation: 24 reducer regression checks and three existing Chromium tests (initial controls, successful isolated stream, interrupted partial stream) passed on an owned temporary Vite server. Provider-backed E2E was not rerun for this change. See `docs/flow/2026-10-07-push-ui-message-ssot.md`.

## EXAMPLES-REMEDA-07: standard data utilities

All54 src/examples folders use Remeda2.51.0 for applicable standard data utilities. The dependency belongs to langgraph-sdk-examples; the authoritative pnpm workspace lockfile records it. Custom isRecord functions are removed. Use isPlainObject/isString/isArray and meaningful values/entries/pipe/filter/map/flatMap/uniqueBy/sortBy/findLast/countBy transformations directly. Example-specific normalization, Zod schemas, message reducers and latest-value keyed Map updates remain local. Simple JSX mapping, browser/media objects and side-effectful domain operations remain native where appropriate. No sibling-example dependencies were introduced.

These guards intentionally describe serialized JSON: isPlainObject excludes class/Date/Map/array instances, and isNumber excludes NaN. Example05 now correctly treats tuple arrays as arrays rather than records. For first-occurrence deduplication, uniqueBy preserves the earlier choice and ordering; latest-occurrence keyed updates retain their Map semantics.

Coverage:54folders,94sourcefiles with Remeda imports, no sibling imports or custom isRecord wrappers. Static lint/typecheck and production build pass; browser/live-provider E2E was not rerun for this change. Existing Vite large-chunk warnings remain. Evidence: plan/examples-remeda-refactor.md, docs/flow/2026-10-07-examples-remeda.md and the JSON coverage audit.
