# 32 Chat Graph Execution Canvas

## Coding Scope

- Graph: `graphs/32_chat_graph_execution_canvas.py` combines streaming, subgraphs, checkpoints, and time travel.
- Frontend: `src/examples/32-chat-graph-execution-canvas/` provides chat plus debugger canvas.

## Implementation Plan

1. Reuse timeline, nested execution, checkpoint, and replay primitives.
2. Render chat, node graph, state diff, checkpoint list, and stream log in coordinated panels.
3. Link each chat message to relevant graph events when possible.
4. Support selecting a run event to inspect state at that point.

## SDK And State Notes

Normalize events once in shared code so multiple panels read the same event store.

## Risks

- Combining many debugger panels can create inconsistent selected state.
- Large event logs need filtering and virtualization if they grow.

## Acceptance Criteria

- One run can be inspected from chat, graph, state, and event perspectives.
- Selecting events updates detail panels.
- Checkpoints and time travel remain available in the combined view.

---

## 한국어

# 32 채팅 그래프 실행 캔버스

## 코딩 범위

- 그래프: `graphs/32_chat_graph_execution_canvas.py`는 스트리밍, 하위 그래프, 체크포인트 및 시간 여행을 결합합니다.
- 프런트엔드: `src/examples/32-chat-graph-execution-canvas/`는 채팅과 디버거 캔버스를 제공합니다.

## 구현 계획

1. 타임라인, 중첩 실행, 체크포인트 및 재생 기본 요소를 재사용합니다.
2. 조정된 패널에서 채팅, 노드 그래프, 상태 차이, 체크포인트 목록 및 스트림 로그를 렌더링합니다.
3. 가능하다면 각 채팅 메시지를 관련 그래프 이벤트에 연결하세요.
4. 해당 시점의 상태를 검사하기 위한 실행 이벤트 선택을 지원합니다.

## SDK 및 상태 참고 사항

여러 패널이 동일한 이벤트 저장소를 읽을 수 있도록 공유 코드에서 이벤트를 한 번 정규화합니다.

## 위험

- 많은 디버거 패널을 결합하면 일관되지 않은 선택 상태가 생성될 수 있습니다.
- 대규모 이벤트 로그가 커지면 필터링과 가상화가 필요합니다.

## 승인 기준

- 한번의 실행을 채팅, 그래프, 상태, 이벤트 관점에서 확인할 수 있습니다.
- 이벤트를 선택하면 세부정보 패널이 업데이트됩니다.
- 체크포인트와 시간여행은 통합보기에서 계속 이용 가능합니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `ChatTranscript.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `GraphCanvas.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `CheckpointTimeline.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `CanvasEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ArtifactInspector.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ChatGraphExecutionCanvasExample.tsx` | Screen composition / 화면 구성 |
| `DebuggerStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `StateDiff.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `TimeTravelReplay.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VersionHistory.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useChatGraphExecutionCanvas.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useChatGraphExecutionCanvasState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
