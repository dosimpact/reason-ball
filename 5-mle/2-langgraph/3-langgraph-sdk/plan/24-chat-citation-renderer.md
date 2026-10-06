# 24 Chat Citation Renderer

## Coding Scope

- Graph: `graphs/24_chat_citation_renderer.py` adapts `10_rag` and `24_qa_pipeline`.
- Frontend: `src/examples/24-chat-citation-renderer/` renders citations inside chat answers.

## Implementation Plan

1. Return answer spans or citation markers linked to source ids.
2. Render citation chips inline with hover or side-panel preview.
3. Highlight the matching document card when a citation is selected.
4. Support external links and local document snippets.

## SDK And State Notes

Keep citation metadata separate from answer text so rendering does not depend on brittle string parsing.

## Risks

- Citation spans can drift if answer text is regenerated after metadata is built.
- External links need safe rendering and should open predictably.

## Acceptance Criteria

- Each citation chip opens or highlights its source.
- The source list includes title, URL or id, and snippet.
- Missing citation metadata degrades to plain answer text.

---

## 한국어

# 24 채팅 인용 렌더러

## 코딩 범위

- 그래프: `graphs/24_chat_citation_renderer.py`는 `10_rag` 및 `24_qa_pipeline`를 적용합니다.
- 프런트엔드: `src/examples/24-chat-citation-renderer/`는 채팅 답변 내에서 인용을 렌더링합니다.

## 구현 계획

1. 소스 ID에 연결된 답변 범위 또는 인용 표시를 반환합니다.
2. 호버나 측면 패널 미리보기를 사용하여 인용 칩을 인라인으로 렌더링합니다.
3. 인용이 선택되면 일치하는 문서 카드를 강조 표시합니다.
4. 외부 링크 및 로컬 문서 조각을 지원합니다.

## SDK 및 상태 참고 사항

렌더링이 깨지기 쉬운 문자열 구문 분석에 의존하지 않도록 인용 메타데이터를 답변 텍스트와 별도로 유지하세요.

## 위험

- 메타데이터가 구축된 후 답변 텍스트가 다시 생성되면 인용 범위가 표류할 수 있습니다.
- 외부 링크는 안전한 렌더링이 필요하며 예측 가능하게 열려야 합니다.

## 승인 기준

- 각 인용 칩은 출처를 열거나 강조 표시합니다.
- 소스 목록에는 제목, URL 또는 ID, 스니펫이 포함됩니다.
- 인용 메타데이터가 누락되면 일반 답변 텍스트로 저하됩니다.


## EXAMPLES-LAYERS-06: frontend responsibilities

- `ChatCitationRendererExample.tsx`: screen composition and citation DOM navigation.
- `useChatCitationRenderer.ts`: SDK requests, thread lifecycle, stream routing and final-state reconciliation; accepts no DOM event.
- `useChatCitationRendererState.ts`: local React state, derived selectors, update application and named preparation/reset transitions.
- `data.ts`: example-local fixtures, payload types, normalization, merge rules and formatting; no React dependency.
- `RuntimeControls.tsx`: inputs, action controls and form event binding.
- `ResultPanels.tsx`: typed CitationStatusPanel, ChatAnswerWithCitationsPanel, CitationPreviewPanel, SourceDocumentsPanel, CitationMapPanel, FinalAnswerPanel presentation panels.
- `RunDiagnostics.tsx`: final-state and raw-event inspection.

Public entry, graph IDs, payloads, stream modes, UI text, selectors and existing shared helpers remain. No sibling-example imports are introduced.

### 한국어: 프런트엔드 책임 분리

- `ChatCitationRendererExample.tsx`: 화면 조합과 인용 문서로 이동하는 DOM 처리.
- `useChatCitationRenderer.ts`: SDK 요청, 스레드 생성·재사용, 스트림 분기와 최종 상태 조회. DOM 이벤트를 받지 않는다.
- `useChatCitationRendererState.ts`: React 상태, 파생값, 서버 업데이트 반영과 준비·초기화 상태 전환.
- `data.ts`: 예제 내부 자료·타입·정규화·병합·표시용 변환. React를 가져오지 않는다.
- `RuntimeControls.tsx`: 입력·버튼과 폼 이벤트 연결.
- `ResultPanels.tsx`: 각 결과 영역을 필요한 props만 받는 표시 컴포넌트로 분리.
- `RunDiagnostics.tsx`: 최종 상태와 원본 이벤트 표시.

진입 컴포넌트, 그래프 ID, 요청값, 스트림 모드, 화면 문구와 선택자는 보존한다. 다른 예제에 대한 의존성은 추가하지 않는다.
