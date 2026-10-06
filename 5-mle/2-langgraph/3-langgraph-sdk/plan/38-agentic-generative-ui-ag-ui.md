# 38 Agentic Generative UI AG-UI

## Coding Scope

- Graph: `graphs/38_agentic_generative_ui_ag_ui.py` implements a Python agent that performs a long-running task and emits structured UI/progress state.
- Frontend: `src/examples/38-agentic-generative-ui-ag-ui/` renders a generated task workspace with progress, partial outputs, and final artifact.
- Runtime: reuse the shared CopilotKit runtime and AG-UI wiring.

## Implementation Plan

1. Add an `38_agentic_generative_ui` graph that decomposes a user request into steps and streams progress updates while producing an artifact.
2. Model the artifact as structured data such as task title, checklist, generated sections, status, and final summary.
3. Emit UI-oriented state updates from the backend so React can render the evolving task surface without parsing prose.
4. Add a React example that pairs `CopilotChat` with a generated UI panel for the current task.
5. Render step progress, currently active step, partial artifact content, completion state, and error state.
6. Register the graph, runtime agent, example metadata, and app route as example 38.

## SDK And State Notes

The backend owns task progress and artifact content. The frontend renders state snapshots and streamed updates, with local state only for transient UI selection such as expanded sections.

## Risks

- Long-running examples need deterministic progress for tests and should not depend on slow external tools.
- Streaming payloads must remain compact enough for the chat UI.
- Generated UI state should be versioned or typed enough to avoid renderer crashes when fields are missing.

## Acceptance Criteria

- The Agentic Generative UI AG-UI example appears as example 38 in the navigation.
- Submitting a long-running task shows progress before the final answer.
- The generated UI panel updates as steps complete.
- The final artifact remains visible after the chat response completes.
- Errors render in the task panel rather than only in raw logs.

---

## 한국어

# 38 에이전트 생성 UI AG-UI

## 코딩 범위

- 그래프: `graphs/38_agentic_generative_ui_ag_ui.py`는 장기 실행 작업을 수행하고 구조화된 UI/진행 상태를 내보내는 Python 에이전트를 구현합니다.
- 프런트엔드: `src/examples/38-agentic-generative-ui-ag-ui/`는 진행률, 부분 출력 및 최종 아티팩트가 포함된 생성된 작업 작업 공간을 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임 및 AG-UI 배선을 재사용합니다.

## 구현 계획

1. 사용자 요청을 단계로 분해하고 아티팩트를 생성하는 동안 진행률 업데이트를 스트리밍하는 `38_agentic_generative_ui` 그래프를 추가합니다.
2. 작업 제목, 체크리스트, 생성된 섹션, 상태 및 최종 요약과 같은 구조화된 데이터로 이슈를 모델링합니다.
3. React가 구문 분석 없이 진화하는 작업 표면을 렌더링할 수 있도록 백엔드에서 UI 지향 상태 업데이트를 내보냅니다.
4. 현재 작업에 대해 생성된 UI 패널과 `CopilotChat`를 쌍으로 연결하는 React 예제를 추가합니다.
5. 렌더링 단계 진행 상황, 현재 활성 단계, 부분적인 아티팩트 콘텐츠, 완료 상태 및 오류 상태.
6. 그래프, 런타임 에이전트, 예제 메타데이터 및 앱 경로를 예제 38로 등록합니다.

## SDK 및 상태 참고 사항

백엔드는 작업 진행 상황과 아티팩트 콘텐츠를 소유합니다. 프런트엔드는 확장된 섹션과 같은 임시 UI 선택에 대해서만 로컬 상태를 사용하여 상태 스냅샷 및 스트리밍 업데이트를 렌더링합니다.

## 위험

- 장기 실행 예제는 테스트를 위해 결정적인 진행이 필요하며 느린 외부 도구에 의존해서는 안 됩니다.
- 스트리밍 페이로드는 채팅 UI에 맞게 컴팩트하게 유지되어야 합니다.
- 생성된 UI 상태는 필드가 누락되었을 때 렌더러 충돌을 방지할 수 있도록 버전이 지정되거나 유형이 지정되어야 합니다.

## 승인 기준

- Agentic Generative UI AG-UI 예제는 탐색에서 예제 38로 나타납니다.
- 장기 실행 작업을 제출하면 최종 답변 이전에 진행 상황이 표시됩니다.
- 단계가 완료되면 생성된 UI 패널이 업데이트됩니다.
- 채팅 응답이 완료된 후에도 최종 아티팩트가 계속 표시됩니다.
- 원시 로그에서만 오류가 렌더링되지 않고 작업 패널에서 오류가 렌더링됩니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `AgenticGenerativeUiAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `AgenticGenerativeUiAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `useAgenticGenerativeUiAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
