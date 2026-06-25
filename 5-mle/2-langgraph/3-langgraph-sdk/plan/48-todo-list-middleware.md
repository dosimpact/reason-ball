# 48 Todo List Middleware

## Coding Scope

- Graph: `graphs/48_todo_list_middleware.py` implements a LangChain agent graph using `TodoListMiddleware` and exposes `todos` state updates.
- Frontend: `src/examples/48-todo-list-middleware/` renders a chat surface plus a todo board that tracks `pending`, `in_progress`, and `completed` items.
- Runtime: reuse the shared LangGraph SDK client, streaming event handling, and example route registration patterns.

## Implementation Plan

1. Add a `todo_list_middleware` graph that wraps a LangChain `create_agent` instance with `TodoListMiddleware`.
2. Use a deterministic multi-step task prompt fixture so the agent is expected to call `write_todos` before executing the work.
3. Stream `messages`, `updates`, and final `values` so the frontend can show both tool-call messages and the authoritative `todos` state.
4. Render the todo board beside the chat with stable rows for content, status, latest update time, and source event.
5. Show `write_todos` tool calls separately from normal assistant text so learners can see that the tool replaces the full todo list.
6. Add a duplicate-call guard demo state that displays middleware error `ToolMessage` output if multiple `write_todos` calls appear in one model turn.
7. Register graph, example metadata, navigation entry, and route as example 48.

## Graph Requirements

- State includes `messages` and `todos` from `PlanningState`.
- Todo items follow the LangChain middleware shape: `content: string` and `status: "pending" | "in_progress" | "completed"`.
- The graph should preserve the middleware as the owner of the `todos` channel unless a project-level state schema explicitly reuses the same channel definition.
- The graph should avoid live external tools; use simple local tools or fixture work so the example focuses on todo state behavior.

## Frontend Behavior

- The main view shows chat on the left and a todo board on the right.
- Todo statuses use clear visual states and do not reorder rows unless the backend sends a new full list.
- The UI distinguishes three event types: assistant messages, `write_todos` tool messages, and state update snapshots.
- If no todo list exists yet, the board shows an empty state rather than inferring tasks from prose.
- If the middleware emits an error message for parallel `write_todos` calls, the error appears inline and in a compact warning area above the todo board.

## SDK And State Notes

`TodoListMiddleware` writes the entire todo list on each `write_todos` call. The frontend must treat `todos` as replace-not-append state and render the latest state from stream updates or final values. Chat messages are useful for explaining what happened, but the todo board should use the state payload as the source of truth.

## Risks

- The model may skip `write_todos` for simple prompts, so the example needs a clearly multi-step fixture prompt.
- Custom state schemas can conflict with `PlanningState.todos` if they define the same channel differently.
- Parallel `write_todos` calls are rejected by the middleware, so the UI needs a visible error path instead of silently dropping tool messages.
- Streaming payload shape may vary across SDK versions; parsing should be centralized in the existing event normalization layer.

## Acceptance Criteria

- The Todo List Middleware example appears as example 48 in the navigation.
- A multi-step prompt produces a visible todo board with `pending`, `in_progress`, and `completed` states.
- `write_todos` tool calls are visible as tool activity and the board reflects the latest full todo list.
- The final assistant response appears after the last todo update rather than being replaced by todo completion.
- Middleware error output for duplicate `write_todos` calls is rendered without crashing the chat or todo board.
