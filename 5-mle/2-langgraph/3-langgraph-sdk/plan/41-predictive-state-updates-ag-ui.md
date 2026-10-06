# 41 Predictive State Updates AG-UI

## Coding Scope

- Graph: `graphs/41_predictive_state_updates_ag_ui.py` implements a Python agent that edits document state and streams confirmed patches.
- Frontend: `src/examples/41-predictive-state-updates-ag-ui/` renders a document editor with optimistic updates and backend-confirmed state.
- Runtime: reuse the shared CopilotKit runtime and AG-UI state wiring.

## Implementation Plan

1. Add a `41_predictive_state_updates` graph with document state fields for title, body, revision, and last operation.
2. Support backend edit operations such as rewrite title, improve paragraph, shorten text, and append summary.
3. Add a React document editor that applies user-requested or agent-predicted edits optimistically.
4. Stream confirmed backend state patches and reconcile them with optimistic UI state.
5. Show pending, confirmed, and reverted edit states so users can understand predictive updates.
6. Register graph, runtime agent, example metadata, and route as example 41.

## SDK And State Notes

React may predict the visual result of an edit, but the Python graph remains authoritative. Reconciliation should use a revision number or operation id to avoid applying stale patches.

## Risks

- Optimistic edits can diverge from final model output.
- Patch ordering matters when multiple edits run close together.
- E2E tests need deterministic prompts and seeded document content.

## Acceptance Criteria

- The Predictive State Updates AG-UI example appears as example 41 in the navigation.
- A document edit request updates the UI immediately with a pending marker.
- Backend confirmation replaces or confirms the predicted edit.
- Failed edits revert or show an error without losing the previous document.
- Revision or operation status is visible in the UI.

---

## 한국어

# 41 예측 상태 업데이트 AG-UI

## 코딩 범위

- 그래프: `graphs/41_predictive_state_updates_ag_ui.py`는 문서 상태를 편집하고 확인된 패치를 스트리밍하는 Python 에이전트를 구현합니다.
- 프런트엔드: `src/examples/41-predictive-state-updates-ag-ui/`는 낙관적인 업데이트와 백엔드 확인 상태로 문서 편집기를 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임 및 AG-UI 상태 연결을 재사용합니다.

## 구현 계획

1. 제목, 본문, 개정판 및 마지막 작업에 대한 문서 상태 필드가 있는 `41_predictive_state_updates` 그래프를 추가합니다.
2. 제목 다시 쓰기, 단락 개선, 텍스트 단축, 요약 추가와 같은 백엔드 편집 작업을 지원합니다.
3. 사용자가 요청했거나 에이전트가 예측한 편집 내용을 낙관적으로 적용하는 React 문서 편집기를 추가합니다.
4. 확인된 백엔드 상태 패치를 스트리밍하고 이를 낙관적인 UI 상태로 조정합니다.
5. 사용자가 예측 업데이트를 이해할 수 있도록 보류, 확인 및 되돌린 편집 상태를 표시합니다.
6. 예제 41과 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

React는 편집의 시각적 결과를 예측할 수 있지만 Python 그래프는 여전히 신뢰할 수 있습니다. 조정에서는 오래된 패치 적용을 방지하기 위해 개정 번호 또는 작업 ID를 사용해야 합니다.

## 위험

- 낙관적인 편집은 최종 모델 출력과 다를 수 있습니다.
- 여러 편집 내용이 서로 가깝게 실행될 때 패치 순서가 중요합니다.
- E2E 테스트에는 결정론적 프롬프트와 시드된 문서 콘텐츠가 필요합니다.

## 승인 기준

- 예측 상태 업데이트 AG-UI 예는 탐색에서 예 41로 나타납니다.
- 문서 편집 요청은 보류 중인 마커로 UI를 즉시 업데이트합니다.
- 백엔드 확인은 예상 편집을 대체하거나 확인합니다.
- 실패한 편집 내용은 이전 문서를 잃지 않고 되돌리거나 오류를 표시합니다.
- 개정이나 작업 상태를 UI에서 볼 수 있습니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `PredictiveStateUpdatesAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `PredictiveStateUpdatesAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `usePredictiveStateUpdatesAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
| `usePredictiveStateUpdatesAgUiChatState.ts` | Local state and grouped transitions / 로컬 상태와 관련 상태 전환 |
