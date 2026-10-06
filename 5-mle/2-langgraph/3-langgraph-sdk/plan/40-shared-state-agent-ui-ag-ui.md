# 40 Shared State Between Agent and UI AG-UI

## Coding Scope

- Graph: `graphs/40_shared_state_agent_ui_ag_ui.py` implements a Python agent that reads and updates shared recipe state.
- Frontend: `src/examples/40-shared-state-agent-ui-ag-ui/` renders editable recipe state alongside CopilotKit chat.
- Runtime: reuse the shared AG-UI runtime and thread-backed state flow.

## Implementation Plan

1. Add a `40_shared_state_agent_ui` graph with state fields for recipe title, servings, ingredients, instructions, and notes.
2. Let the agent read current recipe state and propose structured updates through backend logic.
3. Add React controls for direct UI edits to servings, ingredients, and notes.
4. Synchronize UI edits and agent updates through the same shared state shape so both sides collaborate on one recipe.
5. Render recent state changes as a small activity list to clarify whether a change came from user controls or the agent.
6. Register graph, runtime agent, example metadata, and route as example 40.

## SDK And State Notes

The shared recipe object is the source of truth for this example. React can stage text edits locally, but committed edits should update the shared state consumed by the agent on the next turn.

## Risks

- Conflicts can occur if the user edits while an agent run is streaming updates.
- State patch semantics must be clear enough to avoid overwriting unrelated recipe fields.
- CopilotKit shared state APIs may require adapter-specific wiring in the Vite runtime.

## Acceptance Criteria

- The Shared State Between Agent and UI AG-UI example appears as example 40 in the navigation.
- UI controls can update recipe state without sending a chat message.
- The agent can read the updated recipe state and reference it in a response.
- The agent can modify recipe state and the React panel updates.
- Concurrent or repeated updates do not erase unrelated fields.

---

## 한국어

# 40 에이전트와 UI AG-UI 간의 공유 상태

## 코딩 범위

- 그래프: `graphs/40_shared_state_agent_ui_ag_ui.py`는 공유 레시피 상태를 읽고 업데이트하는 Python 에이전트를 구현합니다.
- 프런트엔드: `src/examples/40-shared-state-agent-ui-ag-ui/`는 CopilotKit 채팅과 함께 편집 가능한 레시피 상태를 렌더링합니다.
- 런타임: 공유 AG-UI 런타임 및 스레드 지원 상태 흐름을 재사용합니다.

## 구현 계획

1. 레시피 제목, 분량, 재료, 지침 및 메모에 대한 상태 필드가 있는 `40_shared_state_agent_ui` 그래프를 추가합니다.
2. 에이전트가 현재 레시피 상태를 읽고 백엔드 로직을 통해 구조화된 업데이트를 제안하도록 합니다.
3. 제공량, 재료, 메모에 대한 직접적인 UI 편집을 위한 React 컨트롤을 추가합니다.
4. 동일한 공유 상태 형태를 통해 UI 편집 및 에이전트 업데이트를 동기화하여 양측이 하나의 레시피에 대해 공동 작업할 수 있도록 합니다.
5. 최근 상태 변경 사항을 작은 활동 목록으로 렌더링하여 변경 사항이 사용자 컨트롤에서 발생한 것인지 에이전트에서 발생한 것인지 명확히 합니다.
6. 그래프, 런타임 에이전트, 예제 메타데이터를 등록하고 예제 40으로 라우팅합니다.

## SDK 및 상태 참고 사항

공유 레시피 객체는 이 예의 기준 데이터입니다. React는 텍스트 편집을 로컬로 진행할 수 있지만 커밋된 편집은 다음 차례에 에이전트가 사용하는 공유 상태를 업데이트해야 합니다.

## 위험

- 에이전트 실행이 업데이트를 스트리밍하는 동안 사용자가 편집하면 충돌이 발생할 수 있습니다.
- 상태 패치 의미는 관련되지 않은 레시피 필드를 덮어쓰지 않도록 충분히 명확해야 합니다.
- CopilotKit 공유 상태 API는 Vite 런타임에서 어댑터별 연결이 필요할 수 있습니다.

## 승인 기준

- 에이전트와 UI AG-UI 간의 공유 상태 예시는 탐색에서 예시 40으로 나타납니다.
- UI 컨트롤은 채팅 메시지를 보내지 않고도 레시피 상태를 업데이트할 수 있습니다.
- 에이전트는 업데이트된 레시피 상태를 읽고 응답에서 이를 참조할 수 있습니다.
- 에이전트는 레시피 상태를 수정하고 React 패널을 업데이트할 수 있습니다.
- 동시 또는 반복 업데이트는 관련 없는 필드를 삭제하지 않습니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `SharedStateAgentUiAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `SharedStateAgentUiAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `useSharedStateAgentUiAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
| `useSharedStateAgentUiAgUiChatState.ts` | Local state and grouped transitions / 로컬 상태와 관련 상태 전환 |
