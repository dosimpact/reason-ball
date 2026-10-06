# 31 Chat Plan Board

## Coding Scope

- Graph: `graphs/31_chat_plan_board.py` combines plan-and-execute with streaming updates and checkpoints.
- Frontend: `src/examples/31-chat-plan-board/` renders chat plus plan board.

## Implementation Plan

1. Convert user goals into structured plan steps.
2. Stream execution updates into a board with step statuses.
3. Allow user edits through direct board drag/drop and replan requests through chat.
4. Checkpoint plan state before and after major changes.

## SDK And State Notes

Use step ids for stable board rendering. Persist direct board moves through the same LangGraph thread with a `move_step` action, version history, custom board-edit events, and execution log entries.

## Risks

- Replanning can invalidate running steps; require clear state transitions.
- User edits must be preserved when the graph continues.

## Acceptance Criteria

- Chat can create and revise a plan.
- Users can drag plan cards between status columns and persist the edit.
- The board shows active, completed, failed, and pending steps.
- Execution can continue after a user revision.

---

## 한국어

# 31 채팅 계획 게시판

## 코딩 범위

- 그래프: `graphs/31_chat_plan_board.py`는 계획 및 실행을 스트리밍 업데이트 및 체크포인트와 결합합니다.
- 프런트엔드: `src/examples/31-chat-plan-board/`는 채팅과 계획 보드를 렌더링합니다.

## 구현 계획

1. 사용자 목표를 구조화된 계획 단계로 변환합니다.
2. 실행 업데이트를 단계 상태와 함께 보드로 스트리밍합니다.
3. 직접 보드 드래그/드롭을 통해 사용자 편집을 허용하고 채팅을 통해 재계획 요청을 허용합니다.
4. 주요 변경 전/후 체크포인트 계획 상태.

## SDK 및 상태 참고 사항

안정적인 보드 렌더링을 위해 단계 ID를 사용하세요. Persist 다이렉트 보드는 `move_step` 작업, 버전 기록, 사용자 정의 보드 편집 이벤트 및 실행 로그 항목을 사용하여 동일한 LangGraph 스레드를 통해 이동합니다.

## 위험

- 재계획은 실행 중인 단계를 무효화할 수 있습니다. 명확한 상태 전환이 필요합니다.
- 그래프가 계속 진행되면 사용자 편집 내용이 유지되어야 합니다.

## 승인 기준

- 채팅으로 계획을 작성하고 수정할 수 있습니다.
- 사용자는 상태 열 사이에 계획 카드를 끌어서 편집 내용을 유지할 수 있습니다.
- 보드에는 활성, 완료, 실패 및 보류 중인 단계가 표시됩니다.
- 사용자 수정 후에도 실행을 계속할 수 있습니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `ArtifactCanvas.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `BoardActions.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ChatPlanBoardExample.tsx` | Screen composition / 화면 구성 |
| `ChatTranscript.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ExecutionLog.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `PlanBoardStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `PlanEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `VersionHistory.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useChatPlanBoard.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useChatPlanBoardState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
