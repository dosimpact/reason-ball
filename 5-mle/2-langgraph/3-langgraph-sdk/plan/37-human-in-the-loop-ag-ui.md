# 37 Human in the Loop AG-UI

## Coding Scope

- Graph: `graphs/37_human_in_the_loop_ag_ui.py` implements a Python LangGraph workflow that interrupts for user approval before completing a task plan.
- Frontend: `src/examples/37-human-in-the-loop-ag-ui/` renders a CopilotKit chat surface plus approval, edit, and reject controls.
- Runtime: reuse the shared CopilotKit runtime and Python LangGraph server.

## Implementation Plan

1. Add a `37_human_in_the_loop_ag_ui` graph with a planning node, an interrupt/approval node, and an execution node.
2. Use LangGraph interrupt/resume semantics so the graph pauses with a structured payload containing task title, proposed steps, risk note, and allowed actions.
3. Register the graph in `langgraph.json` and expose it to CopilotKit with agent name `37_human_in_the_loop_ag_ui`.
4. Add a React example that renders the interrupt payload as an approval panel inside or beside the chat.
5. Implement approve, reject, and edit-and-approve actions that resume the same thread with the selected decision payload.
6. Preserve pending approval state across refresh by reading the active thread/run state when the example mounts.

## SDK And State Notes

The authoritative approval state is in the LangGraph thread. React may keep draft edits locally, but must send the final resume payload back to the same thread instead of starting a new run.

## Risks

- CopilotKit chat abstractions may hide pending LangGraph interrupts unless the runtime exposes enough run/thread state.
- Resume payload shape must match the Python graph exactly.
- Refresh recovery can fail if the frontend tracks pending state only in component memory.

## Acceptance Criteria

- The Human in the Loop AG-UI example appears as example 37 in the navigation.
- A representative prompt pauses the graph and shows a structured approval UI.
- Approve resumes the same thread and completes the task.
- Edit-and-approve resumes with the edited steps visible in the final answer.
- Reject ends the run with a clear rejected/cancelled state.

---

## 한국어

# 37 루프 속 인간 AG-UI

## 코딩 범위

- 그래프: `graphs/37_human_in_the_loop_ag_ui.py`는 작업 계획을 완료하기 전에 사용자 승인을 위해 중단하는 Python LangGraph 워크플로를 구현합니다.
- 프런트엔드: `src/examples/37-human-in-the-loop-ag-ui/`는 CopilotKit 채팅 화면과 승인, 편집 및 거부 제어 기능을 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임 및 Python LangGraph 서버를 재사용합니다.

## 구현 계획

1. 계획 노드, 인터럽트/승인 노드 및 실행 노드가 있는 `37_human_in_the_loop_ag_ui` 그래프를 추가합니다.
2. LangGraph 인터럽트/재개 의미론을 사용하여 작업 제목, 제안된 단계, 위험 참고 사항 및 허용된 작업이 포함된 구조화된 페이로드로 그래프가 일시 중지되도록 합니다.
3. `langgraph.json`에 그래프를 등록하고 에이전트 이름 `37_human_in_the_loop_ag_ui`를 사용하여 CopilotKit에 노출합니다.
4. 채팅 내부 또는 옆에 승인 패널로 인터럽트 페이로드를 렌더링하는 React 예제를 추가합니다.
5. 선택한 결정 페이로드와 동일한 스레드를 재개하는 승인, 거부, 편집 및 승인 작업을 구현합니다.
6. 예제가 탑재될 때 활성 스레드/실행 상태를 읽어 새로 고침 시 승인 보류 상태를 유지합니다.

## SDK 및 상태 참고 사항

정식 승인 상태는 LangGraph 스레드에 있습니다. React는 초안 편집 내용을 로컬로 유지할 수 있지만 새 실행을 시작하는 대신 최종 이력서 페이로드를 동일한 스레드로 다시 보내야 합니다.

## 위험

- CopilotKit 채팅 추상화는 런타임이 충분한 실행/스레드 상태를 노출하지 않는 한 보류 중인 LangGraph 인터럽트를 숨길 수 있습니다.
- 이력서 페이로드 형태는 Python 그래프와 정확히 일치해야 합니다.
- 프런트엔드가 구성 요소 메모리에서만 보류 상태를 추적하는 경우 새로 고침 복구가 실패할 수 있습니다.

## 승인 기준

- Human in the Loop AG-UI 예시는 탐색에서 예시 37로 나타납니다.
- 대표 프롬프트는 그래프를 일시 중지하고 구조화된 승인 UI를 보여줍니다.
- 승인은 동일한 스레드를 재개하고 작업을 완료합니다.
- 최종 답변에 편집된 단계가 표시되면서 편집 및 승인이 다시 시작됩니다.
- 거부는 명확한 거부/취소 상태로 실행을 종료합니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `HumanInTheLoopAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `HumanInTheLoopAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `useHumanInTheLoopAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
| `useHumanInTheLoopAgUiChatState.ts` | Local state and grouped transitions / 로컬 상태와 관련 상태 전환 |
