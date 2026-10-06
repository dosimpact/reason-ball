# 29 Chat Code Editor

## Coding Scope

- Graph: `graphs/29_chat_code_editor.py` models a coding assistant with tool calls, approval, streaming, and checkpoints.
- Frontend: `src/examples/29-chat-code-editor/` provides chat plus code artifact canvas.

## Implementation Plan

1. Define artifact state for files, proposed diffs, test logs, and approval status.
2. Build chat flow that proposes code changes before applying them.
3. Render editor, diff viewer, execution log, and approve/reject controls.
4. Checkpoint artifact versions after accepted changes.

## SDK And State Notes

Treat file edits as proposed artifacts until approval. Use deterministic sample files for tests.

## Risks

- Generated code must not be applied without explicit approval.
- Running arbitrary code requires sandboxing and strict fixture scope.

## Acceptance Criteria

- Chat requests produce visible diff proposals.
- User approval is required before applying changes.
- Test output and artifact version history are visible.

---

## 한국어

# 29 채팅 코드 편집기

## 코딩 범위

- 그래프: `graphs/29_chat_code_editor.py`는 도구 호출, 승인, 스트리밍 및 체크포인트를 갖춘 코딩 도우미를 모델링합니다.
- 프런트엔드: `src/examples/29-chat-code-editor/`는 채팅과 코드 아티팩트 캔버스를 제공합니다.

## 구현 계획

1. 파일, 제안된 차이점, 테스트 로그 및 승인 상태에 대한 아티팩트 상태를 정의합니다.
2. 코드 변경 사항을 적용하기 전에 제안하는 채팅 흐름을 구축하세요.
3. 렌더 편집기, 차이점 뷰어, 실행 로그 및 승인/거부 제어.
4. 변경 사항이 승인된 후 체크포인트 아티팩트 버전.

## SDK 및 상태 참고 사항

승인될 때까지 파일 편집을 제안된 아티팩트로 처리합니다. 테스트에는 결정론적 샘플 파일을 사용하십시오.

## 위험

- 생성된 코드는 명시적인 승인 없이 적용되어서는 안 됩니다.
- 임의의 코드를 실행하려면 샌드박싱과 엄격한 고정 범위가 필요합니다.

## 승인 기준

- 채팅 요청은 눈에 띄는 차이점 제안을 생성합니다.
- 변경 사항을 적용하기 전에 사용자 승인이 필요합니다.
- 테스트 출력 및 아티팩트 버전 기록이 표시됩니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `ApprovalControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ChatCodeEditorExample.tsx` | Screen composition / 화면 구성 |
| `ChatTranscript.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `CodeArtifact.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `CodeEditorEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `CodeEditorStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `DiffProposal.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `TestLog.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VersionHistory.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useChatCodeEditor.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useChatCodeEditorState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
