# 44 Subgraphs AG-UI

## Coding Scope

- Graph: `graphs/44_subgraphs_ag_ui.py` implements a Python LangGraph parent graph with worker subgraphs for multi-agent task execution.
- Frontend: `src/examples/44-subgraphs-ag-ui/` renders CopilotKit chat plus subgraph execution progress.
- Runtime: reuse the shared CopilotKit runtime and LangGraph server.

## Implementation Plan

1. Add a `44_subgraphs_ag_ui` parent graph that routes a task to at least two named worker subgraphs.
2. Stream or expose subgraph progress with worker name, task, status, partial result, and final result.
3. Add a React example that renders a multi-agent progress panel beside the chat.
4. Show parent graph state separately from worker/subgraph state.
5. Include a prompt that reliably exercises multiple workers and aggregates their outputs.
6. Register graph, runtime agent, example metadata, and route as example 44.

## SDK And State Notes

Subgraph execution state should use stable worker ids so the frontend can update the correct row as streamed events arrive. The final assistant message should summarize aggregated worker results.

## Risks

- Nested LangGraph stream events can be difficult to associate with the correct subgraph without explicit metadata.
- Multi-agent examples can become slow if each worker performs real model calls.
- The UI must avoid confusing skipped, pending, and completed worker states.

## Acceptance Criteria

- The Subgraphs AG-UI example appears as example 44 in the navigation.
- A representative task runs through multiple worker/subgraph steps.
- The frontend shows each worker's status and result.
- The parent aggregation result is visible in the final answer.
- Failed worker state is rendered without breaking the whole progress panel.

---

## 한국어

# 44 하위 그래프 AG-UI

## 코딩 범위

- 그래프: `graphs/44_subgraphs_ag_ui.py`는 다중 에이전트 작업 실행을 위해 작업자 하위 그래프가 있는 Python LangGraph 상위 그래프를 구현합니다.
- 프런트엔드: `src/examples/44-subgraphs-ag-ui/`는 CopilotKit 채팅과 하위 그래프 실행 진행 상황을 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임 및 LangGraph 서버를 재사용합니다.

## 구현 계획

1. 작업을 명명된 작업자 하위 그래프 두 개 이상으로 라우팅하는 `44_subgraphs_ag_ui` 상위 그래프를 추가합니다.
2. 작업자 이름, 작업, 상태, 부분 결과 및 최종 결과와 함께 하위 그래프 진행 상황을 스트리밍하거나 노출합니다.
3. 채팅 옆에 다중 에이전트 진행률 패널을 렌더링하는 React 예제를 추가합니다.
4. 작업자/하위 그래프 상태와 별도로 상위 그래프 상태를 표시합니다.
5. 여러 작업자를 안정적으로 실행하고 해당 출력을 집계하는 프롬프트를 포함합니다.
6. 예제 44와 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

하위 그래프 실행 상태는 스트리밍 이벤트가 도착할 때 프런트엔드가 올바른 행을 업데이트할 수 있도록 안정적인 작업자 ID를 사용해야 합니다. 최종 보조 메시지는 집계된 작업자 결과를 요약해야 합니다.

## 위험

- 중첩된 LangGraph 스트림 이벤트는 명시적인 메타데이터 없이 올바른 하위 그래프와 연결하기 어려울 수 있습니다.
- 각 작업자가 실제 모델 호출을 수행하는 경우 다중 에이전트 예제가 느려질 수 있습니다.
- UI는 건너뛰기, 보류 중, 완료 작업자 상태를 혼동하지 않아야 합니다.

## 승인 기준

- Subgraphs AG-UI 예제는 탐색에서 예제 44로 나타납니다.
- 대표 작업은 여러 작업자/하위 그래프 단계를 통해 실행됩니다.
- 프론트엔드는 각 작업자의 상태와 결과를 보여줍니다.
- 상위 집계 결과는 최종 답변에 표시됩니다.
- 전체 진행률 패널을 중단하지 않고 실패한 작업자 상태가 렌더링됩니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `SubgraphsAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `SubgraphsAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `useSubgraphsAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
