# 15 Reflection Evaluator Loop UI

## Coding Scope

- Graph: `graphs/15_reflection_evaluator_loop.py` adapts `12_1_reflection`, `12_2_reflection`, `22_evaluator_loop`, and `23_verification_flow`.
- Frontend: `src/examples/15-reflection-evaluator-loop-ui/` renders iteration history.

## Implementation Plan

1. Create a bounded loop with draft, critique, rewrite, and evaluation nodes.
2. Store each iteration as structured state.
3. Render draft text, evaluator score, feedback, retry count, and final pass/fail.
4. Provide prompts that trigger at least one retry.

## SDK And State Notes

Expose max retries and stop reason. Do not hide rejected drafts.

## Risks

- Looping graphs can run longer than expected; enforce max iterations.
- Evaluation scores may be subjective, so show feedback and stop reason together.

## Acceptance Criteria

- Iterations appear in chronological order.
- Feedback explains why a draft was retried.
- Final pass/fail condition is explicit.

---

## 한국어

# 15 반사 평가기 루프 UI

## 코딩 범위

- 그래프: `graphs/15_reflection_evaluator_loop.py`는 `12_1_reflection`, `12_2_reflection`, `22_evaluator_loop` 및 `23_verification_flow`를 적용합니다.
- 프런트엔드: `src/examples/15-reflection-evaluator-loop-ui/`는 반복 기록을 렌더링합니다.

## 구현 계획

1. 초안, 비평, 재작성 및 평가 노드를 사용하여 제한된 루프를 만듭니다.
2. 각 반복을 구조화된 상태로 저장합니다.
3. 초안 텍스트, 평가자 점수, 피드백, 재시도 횟수 및 최종 통과/실패를 렌더링합니다.
4. 한 번 이상의 재시도를 트리거하는 프롬프트를 제공합니다.

## SDK 및 상태 참고 사항

최대 재시도 횟수와 중지 이유를 공개합니다. 거부된 초안을 숨기지 마세요.

## 위험

- 루프 그래프가 예상보다 오래 실행될 수 있습니다. 최대 반복을 시행합니다.
- 평가점수는 주관적일 수 있으니 피드백과 정지사유를 함께 보여주세요.

## 승인 기준

- 반복은 시간순으로 나타납니다.
- 피드백에서는 초안을 다시 시도한 이유를 설명합니다.
- 최종 합격/불합격 조건이 명시되어 있습니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `ReflectionEvaluatorLoopExample.tsx`: screen composition.
- `useReflectionEvaluatorLoop.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useReflectionEvaluatorLoopState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed LoopStatusPanel, EvaluatorFeedbackPanel, IterationHistoryPanel, DraftComparisonPanel, LoopEventsPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `ReflectionEvaluatorLoopExample.tsx`: 화면 조합.
- `useReflectionEvaluatorLoop.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useReflectionEvaluatorLoopState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
