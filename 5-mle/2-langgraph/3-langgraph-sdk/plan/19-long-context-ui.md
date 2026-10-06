# 19 Long Context UI

## Coding Scope

- Graph: `graphs/19_long_context.py` adapts `21_long_context`.
- Frontend: `src/examples/19-long-context-ui/` shows recent messages and summarized history.

## Implementation Plan

1. Build a chat graph that summarizes older context after a threshold.
2. Store summary metadata and retained message ids.
3. Render recent messages, summarized past context, removed messages, and summary creation time.
4. Provide a seed conversation action for faster testing.

## SDK And State Notes

Expose summary, source message range, retained message count, and last compaction run id.

## Risks

- Context compaction thresholds can be hard to trigger manually; include a seed action.
- Summaries should not replace recent messages in the UI unexpectedly.

## Acceptance Criteria

- The UI shows when context compaction happens.
- Summary and recent messages are visually separate.
- Removed or summarized messages are traceable.

---

## 한국어

# 19 긴 컨텍스트 UI

## 코딩 범위

- 그래프: `graphs/19_long_context.py`는 `21_long_context`를 적용합니다.
- 프론트엔드: `src/examples/19-long-context-ui/`는 최근 메시지와 요약된 기록을 보여줍니다.

## 구현 계획

1. 임계값 이후의 이전 컨텍스트를 요약하는 채팅 그래프를 구축합니다.
2. 요약 메타데이터와 보관된 메시지 ID를 저장합니다.
3. 최근 메시지, 요약된 과거 컨텍스트, 제거된 메시지 및 요약 생성 시간을 렌더링합니다.
4. 더 빠른 테스트를 위해 시드 대화 작업을 제공합니다.

## SDK 및 상태 참고 사항

요약, 소스 메시지 범위, 보관된 메시지 수 및 마지막 압축 실행 ID를 노출합니다.

## 위험

- 컨텍스트 압축 임계값은 수동으로 트리거하기 어려울 수 있습니다. 시드 작업을 포함합니다.
- 요약이 UI의 최근 메시지를 예기치 않게 대체해서는 안 됩니다.

## 승인 기준

- 컨텍스트 압축이 발생하면 UI에 표시됩니다.
- 요약 메시지와 최근 메시지는 시각적으로 구분됩니다.
- 삭제되거나 요약된 메시지는 추적 가능합니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `LongContextExample.tsx`: screen composition.
- `useLongContext.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useLongContextState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed ContextBudgetPanel, SummaryOfEarlierContextPanel, RecentMessagesPanel, SummarizedMessagesPanel, CompactionEventsPanel, AssistantAnswerPanel, LatestSummaryRecordPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `LongContextExample.tsx`: 화면 조합.
- `useLongContext.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useLongContextState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
