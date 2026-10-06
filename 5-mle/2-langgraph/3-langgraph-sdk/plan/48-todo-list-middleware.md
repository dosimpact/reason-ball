# 48 Todo List Middleware

## Coding Scope

- Graph: `graphs/48_todo_list_middleware.py` implements a LangChain agent graph using `TodoListMiddleware` and exposes `todos` state updates.
- Frontend: `src/examples/48-todo-list-middleware/` renders a chat surface plus a todo board that tracks `pending`, `in_progress`, and `completed` items.
- Runtime: reuse the shared LangGraph SDK client, streaming event handling, and example route registration patterns.

## Implementation Plan

1. Add a `48_todo_list_middleware` graph that wraps a LangChain `create_agent` instance with `TodoListMiddleware`.
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

---

## 한국어

# 48 할 일 목록 미들웨어

## 코딩 범위

- 그래프: `graphs/48_todo_list_middleware.py`는 `TodoListMiddleware`를 사용하여 LangChain 에이전트 그래프를 구현하고 `todos` 상태 업데이트를 노출합니다.
- 프런트엔드: `src/examples/48-todo-list-middleware/`는 채팅 화면과 `pending`, `in_progress` 및 `completed` 항목을 추적하는 할 일 보드를 렌더링합니다.
- 런타임: 공유 LangGraph SDK 클라이언트, 스트리밍 이벤트 처리 및 예제 경로 등록 패턴을 재사용합니다.

## 구현 계획

1. LangChain `create_agent` 인스턴스를 `TodoListMiddleware`로 래핑하는 `48_todo_list_middleware` 그래프를 추가합니다.
2. 에이전트가 작업을 실행하기 전에 `write_todos`를 호출할 것으로 예상되도록 결정적 다단계 작업 프롬프트 테스트 픽스처를 사용합니다.
3. 프런트엔드에서 도구 호출 메시지와 신뢰할 수 있는 `todos` 상태를 모두 표시할 수 있도록 `messages`, `updates` 및 최종 `values`를 스트리밍합니다.
4. 콘텐츠, 상태, 최신 업데이트 시간 및 소스 이벤트에 대한 안정적인 행이 있는 채팅 옆에 할 일 보드를 렌더링합니다.
5. 일반 어시스턴트 텍스트와 별도로 `write_todos` 도구 호출을 표시하여 학습자가 도구가 전체 할 일 목록을 대체한다는 것을 알 수 있습니다.
6. 한 모델 턴에 여러 `write_todos` 호출이 나타나는 경우 미들웨어 오류 `ToolMessage` 출력을 표시하는 중복 호출 보호 데모 상태를 추가합니다.
7. 예제 48과 같이 그래프, 예제 메타데이터, 탐색 항목 및 경로를 등록합니다.

## 그래프 요구 사항

- 상태에는 `PlanningState`의 `messages` 및 `todos`가 포함됩니다.
- Todo 항목은 LangChain 미들웨어 형태인 `content: string` 및 `status: "pending" | "in_progress" | "completed"`를 따릅니다.
- 그래프는 프로젝트 수준 상태 스키마가 동일한 채널 정의를 명시적으로 재사용하지 않는 한 미들웨어를 `todos` 채널의 소유자로 유지해야 합니다.
- 그래프는 실제 외부 도구를 피해야 합니다. 예제에서는 todo 상태 동작에 중점을 두도록 간단한 로컬 도구나 고정 작업을 사용합니다.

## 프론트엔드 동작

- 메인 화면 왼쪽에는 채팅이, 오른쪽에는 할 일 게시판이 표시됩니다.
- Todo 상태는 명확한 시각적 상태를 사용하며 백엔드가 새로운 전체 목록을 보내지 않는 한 행을 재정렬하지 않습니다.
- UI는 보조 메시지, `write_todos` 도구 메시지 및 상태 업데이트 스냅샷의 세 가지 이벤트 유형을 구분합니다.
- 아직 할 일 목록이 없으면 자연어 텍스트에서 작업을 추론하지 않고 보드에 빈 상태가 표시됩니다.
- 미들웨어가 병렬 `write_todos` 호출에 대해 오류 메시지를 표시하는 경우 오류는 할 일 보드 위의 작은 경고 영역에 인라인으로 표시됩니다.

## SDK 및 상태 참고 사항

`TodoListMiddleware`는 각 `write_todos` 호출마다 전체 할 일 목록을 작성합니다. 프런트엔드는 `todos`를 추가하지 않고 대체 상태로 처리하고 스트림 업데이트 또는 최종 값에서 최신 상태를 렌더링해야 합니다. 채팅 메시지는 무슨 일이 일어났는지 설명하는 데 유용하지만 할 일 보드는 상태 페이로드를 기준 데이터로 사용해야 합니다.

## 위험

- 모델은 간단한 프롬프트의 경우 `write_todos`를 건너뛸 수 있으므로 이 예에서는 명확한 다단계 사전 정의된 프롬프트가 필요합니다.
- 사용자 정의 상태 스키마가 동일한 채널을 다르게 정의하는 경우 `PlanningState.todos`와 충돌할 수 있습니다.
- 병렬 `write_todos` 호출은 미들웨어에 의해 거부되므로 UI에는 도구 메시지를 자동으로 삭제하는 대신 눈에 보이는 오류 경로가 필요합니다.
- 스트리밍 페이로드 형태는 SDK 버전에 따라 다를 수 있습니다. 구문 분석은 기존 이벤트 정규화 계층에 중앙 집중화되어야 합니다.

## 승인 기준

- Todo List Middleware 예제는 탐색에서 예제 48로 나타납니다.
- 다단계 프롬프트는 `pending`, `in_progress` 및 `completed` 상태를 사용하여 눈에 보이는 할 일 보드를 생성합니다.
- `write_todos` 도구 호출은 도구 활동으로 표시되며 보드에는 최신 전체 할 일 목록이 반영됩니다.
- 최종 어시스턴트 응답은 할 일 완료로 교체되지 않고 마지막 할 일 업데이트 후에 나타납니다.
- 중복된 `write_todos` 호출에 대한 미들웨어 오류 출력이 채팅이나 할 일 보드를 충돌시키지 않고 렌더링됩니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `TodoList.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `TodoListMiddlewareExample.tsx` | Screen composition / 화면 구성 |
| `TodoStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `TodoTranscript.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `WritetodosToolCalls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `presentation.tsx` | Presentation helpers / 화면 표시 도우미 |
| `useTodoListMiddleware.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useTodoListMiddlewareState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
