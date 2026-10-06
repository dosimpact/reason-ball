# 23 Thinking Renderer

## Coding Scope

- Graph: `graphs/23_thinking_renderer.py` emits public reasoning summaries or status events only.
- Frontend: `src/examples/23-thinking-renderer/` renders collapsible thinking summaries.

## Implementation Plan

1. Use provider-supported reasoning summary or graph-authored status messages.
2. Separate public thinking/status content from final answer content.
3. Render collapsible blocks with step labels and timestamps.
4. Add guardrails so hidden chain-of-thought is never requested or displayed.

## SDK And State Notes

Use explicit `reasoning_summary` or `status` fields. Do not store private model reasoning.

## Risks

- The UI must not request, infer, or expose hidden chain-of-thought.
- Provider support for reasoning summaries can vary by model.

## Acceptance Criteria

- Users see useful progress context before the final answer.
- Final answer remains separate from thinking/status blocks.
- The implementation does not expose hidden chain-of-thought.

---

## 한국어

# 23 생각하는 렌더러

## 코딩 범위

- 그래프: `graphs/23_thinking_renderer.py`는 공개 추론 요약 또는 상태 이벤트만 내보냅니다.
- 프런트엔드: `src/examples/23-thinking-renderer/`는 축소 가능한 사고 요약을 렌더링합니다.

## 구현 계획

1. 공급자가 지원하는 추론 요약 또는 그래프로 작성된 상태 메시지를 사용합니다.
2. 최종 답변 내용과 대중의 생각/상태 내용을 분리합니다.
3. 단계 라벨과 타임스탬프를 사용하여 축소 가능한 블록을 렌더링합니다.
4. 숨겨진 사고방식이 요청되거나 표시되지 않도록 가드레일을 추가하세요.

## SDK 및 상태 참고 사항

명시적인 `reasoning_summary` 또는 `status` 필드를 사용하세요. 비공개 모델 추론을 저장하지 마세요.

## 위험

- UI는 숨겨진 사고방식을 요청, 추론, 노출해서는 안 됩니다.
- 추론 요약에 대한 공급자 지원은 모델에 따라 다를 수 있습니다.

## 승인 기준

- 사용자는 최종 답변 전에 유용한 진행 상황을 볼 수 있습니다.
- 최종 답변은 사고/상태 블록과 별도로 유지됩니다.
- 구현 시 숨겨진 사고방식이 노출되지 않습니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `ThinkingRendererExample.tsx`: screen composition.
- `useThinkingRenderer.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useThinkingRendererState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed ThinkingStatusPanel, ThinkingTimelinePanel, PublicReasoningSummaryPanel, SafetyGuardrailsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `ThinkingRendererExample.tsx`: 화면 조합.
- `useThinkingRenderer.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useThinkingRendererState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
