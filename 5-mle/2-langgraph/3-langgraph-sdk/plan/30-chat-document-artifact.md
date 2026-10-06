# 30 Chat Document Artifact

## Coding Scope

- Graph: `graphs/30_chat_document_artifact.py` combines document editing with reflection, evaluator loop, and structured output.
- Frontend: `src/examples/30-chat-document-artifact/` renders a document canvas with chat controls.

## Implementation Plan

1. Represent document sections as structured artifact state.
2. Add chat commands for tone, length, grammar, section edits, and AI comments.
3. Run evaluator passes for quality checks.
4. Render an editable document canvas where users can directly change title, summary, and section text.
5. Support `save_user_edit` and `ai_revise` actions so user edits and AI revisions both update the same artifact state before approval.
6. Render version history and section-level changes.

## SDK And State Notes

Keep document content, comments, suggested edits, direct user edits, AI revisions, and accepted versions separate. Approval requests send the current canvas payload so unsaved local edits are not dropped.

## Risks

- Long document edits can obscure exact changes without section-level diffs.
- Evaluator output should guide edits without overwriting user-approved text.

## Acceptance Criteria

- Users can request tone or grammar changes from chat.
- Users can directly edit the document canvas and save those edits into graph state.
- AI can revise the current user-edited canvas on the same thread.
- Section-level edits are visible before acceptance.
- Document versions can be compared.

---

## 한국어

#30 채팅문서 아티팩트

## 코딩 범위

- 그래프: `graphs/30_chat_document_artifact.py`는 문서 편집과 반사, 평가자 루프 및 구조화된 출력을 결합합니다.
- 프런트엔드: `src/examples/30-chat-document-artifact/`는 채팅 컨트롤을 사용하여 문서 캔버스를 렌더링합니다.

## 구현 계획

1. 문서 섹션을 구조화된 아티팩트 상태로 표현합니다.
2. 어조, 길이, 문법, 섹션 편집, AI 댓글에 대한 채팅 명령을 추가하세요.
3. 품질 확인을 위해 평가자 패스를 실행합니다.
4. 사용자가 제목, 요약, 섹션 텍스트를 직접 변경할 수 있는 편집 가능한 문서 캔버스를 렌더링합니다.
5. `save_user_edit` 및 `ai_revise` 작업을 지원하므로 사용자 편집 및 AI 개정 모두 승인 전에 동일한 아티팩트 상태를 업데이트합니다.
6. 버전 기록 및 섹션 수준 변경 사항을 렌더링합니다.

## SDK 및 상태 참고 사항

문서 콘텐츠, 댓글, 제안된 편집, 직접 사용자 편집, AI 개정 및 승인된 버전을 별도로 유지하세요. 승인 요청은 현재 캔버스 페이로드를 전송하므로 저장되지 않은 로컬 편집 내용이 삭제되지 않습니다.

## 위험

- 긴 문서 편집으로 인해 섹션 수준 차이 없이 정확한 변경 사항이 모호해질 수 있습니다.
- 평가자 출력은 사용자가 승인한 텍스트를 덮어쓰지 않고 편집 내용을 안내해야 합니다.

## 승인 기준

- 사용자는 채팅에서 어조나 문법 변경을 요청할 수 있습니다.
- 사용자는 문서 캔버스를 직접 편집하고 해당 편집 내용을 그래프 상태로 저장할 수 있습니다.
- AI는 동일한 스레드에서 현재 사용자가 편집한 캔버스를 수정할 수 있습니다.
- 섹션 수준 편집 내용은 승인 전에 표시됩니다.
- 문서 버전을 비교할 수 있습니다.


## EXAMPLES-LAYERS-06: Independent frontend modules / 독립적인 프런트엔드 모듈

The entry composes local layers; request payloads, graph IDs, stream modes, state replacement/merge rules, DOM selectors, and user interactions are preserved. No new sibling-example imports.

진입 화면은 예제 내부 계층을 조합한다. 요청값·그래프 ID·스트림 모드·상태 교체/병합·DOM 선택자·사용자 동작을 보존하고 다른 예제에 대한 새 의존성을 만들지 않는다.

| Module / 모듈 | Role / 역할 |
|---|---|
| `AIComments.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ApprovalControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ArtifactCanvas.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `ChatDocumentArtifactExample.tsx` | Screen composition / 화면 구성 |
| `ChatTranscript.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `DocumentArtifactStatus.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `DocumentEvents.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `QualityReview.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RuntimeControls.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `SectionChanges.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `RunDiagnostics.tsx` | Final state and raw stream diagnostics / 최종 상태와 원시 스트림 진단 |
| `VersionHistory.tsx` | Focused presentation panel / 책임별 표시 패널 |
| `model.ts` | Pure types, fixtures, parsing and selectors / 순수 타입·자료·파싱·선택 |
| `useChatDocumentArtifact.ts` | SDK requests and stream orchestration / SDK 요청과 스트림 처리 |
| `useChatDocumentArtifactState.ts` | Local state and transitions / 로컬 상태와 전환 |

State hooks group startRun/failRun while retaining independent field updates. Controllers expose only view-used values/actions. Runtime controls bind form/file events, and example 31 translates drag DOM events into a moveStep command in its board view.
상태 훅은 startRun/failRun을 묶고 개별 필드 갱신은 유지한다. 요청 훅은 화면에서 쓰는 값과 동작만 공개한다. 컨트롤은 폼·파일 이벤트를 연결하며 31번 보드 화면은 드래그 DOM 이벤트를 moveStep 명령으로 변환한다.

Checks: scoped TypeScript lint passes. Static source comparison confirms unchanged SDK calls/payloads/modes, static DOM selectors and pure parsing helper bodies. Production build is integrated by the parent agent. No new tests or live-provider browser checks were performed.
검증: 범위 내 TypeScript 검사 통과. 소스 비교로 SDK 호출·요청값·모드, 고정 DOM 선택자, 순수 파싱 함수 본문을 보존했음을 확인했다. 프로덕션 빌드는 상위 에이전트가 통합한다. 테스트 추가 및 실제 provider 브라우저 검증은 수행하지 않았다.
