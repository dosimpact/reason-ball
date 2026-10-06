# 33 Chat UI Preview

## Coding Scope

- Graph: `graphs/33_chat_ui_preview.py` models a UI generation assistant with tool approval and artifact versions.
- Frontend: `src/examples/33-chat-ui-preview/` provides chat, code, live preview, and diff controls.

## Implementation Plan

1. Store generated React component code as an artifact.
2. Render code and live preview in a sandboxed preview frame.
3. Show proposed diffs and allow apply/revert.
4. Track artifact versions and execution errors.

## SDK And State Notes

Never execute arbitrary code outside the preview sandbox. Keep generated code, preview status, and errors structured.

## Risks

- Preview execution must be isolated from the main app.
- Generated UI can fail to compile; errors should stay inside the preview workflow.

## Acceptance Criteria

- Chat requests produce previewable UI changes.
- Diffs can be applied or reverted.
- Preview errors are shown without breaking the main app.

---

## 한국어

# 33 채팅 UI 미리보기

## 코딩 범위

- 그래프: `graphs/33_chat_ui_preview.py`는 도구 승인 및 아티팩트 버전을 사용하여 UI 생성 도우미를 모델링합니다.
- 프런트엔드: `src/examples/33-chat-ui-preview/`는 채팅, 코드, 실시간 미리보기 및 차이점 제어 기능을 제공합니다.

## 구현 계획

1. 생성된 React 구성 요소 코드를 아티팩트로 저장합니다.
2. 샌드박스 미리보기 프레임에서 코드와 실시간 미리보기를 렌더링합니다.
3. 제안된 차이점을 표시하고 적용/되돌리기를 허용합니다.
4. 아티팩트 버전 및 실행 오류를 추적합니다.

## SDK 및 상태 참고 사항

미리보기 샌드박스 외부에서 임의 코드를 실행하지 마십시오. 생성된 코드, 미리보기 상태 및 오류를 체계적으로 유지하세요.

## 위험

- 미리보기 실행은 메인 앱과 분리되어야 합니다.
- 생성된 UI가 컴파일되지 않을 수 있습니다. 오류는 미리보기 워크플로 내에 있어야 합니다.

## 승인 기준

- 채팅 요청은 미리보기 가능한 UI 변경을 생성합니다.
- Diff를 적용하거나 되돌릴 수 있습니다.
- 메인 앱을 깨뜨리지 않고 미리보기 오류가 표시됩니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `ApprovalControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ChatTranscript.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ChatUiPreviewExample.tsx` | Screen composition / 화면 구성 |
| `ComponentCode.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ComponentTree.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `DiffPreview.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `LivePreview.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `PreviewEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `PreviewStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `StyleControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `VersionHistory.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useChatUiPreview.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useChatUiPreviewState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
