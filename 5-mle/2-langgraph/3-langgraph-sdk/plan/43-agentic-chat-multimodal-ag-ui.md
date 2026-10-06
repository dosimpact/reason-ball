# 43 Agentic Chat Multimodal AG-UI

## Coding Scope

- Graph: `graphs/43_agentic_chat_multimodal_ag_ui.py` implements a Python multimodal chat agent that can reason over image input.
- Frontend: `src/examples/43-agentic-chat-multimodal-ag-ui/` renders CopilotKit chat with image attachment, preview, and analysis results.
- Runtime: reuse the shared CopilotKit runtime and Python LangGraph server.

## Implementation Plan

1. Add an `43_agentic_chat_multimodal` graph with message handling for text plus image/media content.
2. Use the shared model factory with a multimodal-capable model configuration when available.
3. Add React image upload/preview controls and pass the selected image into the CopilotKit/LangGraph message flow.
4. Render upload state, thumbnail preview, assistant analysis, and any structured observations.
5. Provide a deterministic sample image or fixture path for E2E planning.
6. Register graph, runtime agent, example metadata, and route as example 43.

## SDK And State Notes

Keep binary image data out of persistent app state when possible. Use data URLs or uploaded references consistently with the existing multimodal image example and the CopilotKit transport constraints.

## Risks

- Runtime payload size limits can reject large images.
- The configured default model may not support multimodal input.
- Browser file input behavior requires a fixture-based E2E path.

## Acceptance Criteria

- The Agentic Chat Multimodal AG-UI example appears as example 43 in the navigation.
- Users can attach an image and see a preview before sending.
- The graph receives the image content and returns an image-aware response.
- Upload errors or unsupported file types show a visible error.
- A text-only message still works in the same chat.

---

## 한국어

# 43 에이전트 채팅 멀티모달 AG-UI

## 코딩 범위

- 그래프: `graphs/43_agentic_chat_multimodal_ag_ui.py`는 이미지 입력을 추론할 수 있는 Python 다중 모드 채팅 에이전트를 구현합니다.
- 프런트엔드: `src/examples/43-agentic-chat-multimodal-ag-ui/`는 이미지 첨부, 미리보기 및 분석 결과가 포함된 CopilotKit 채팅을 렌더링합니다.
- 런타임: 공유 CopilotKit 런타임 및 Python LangGraph 서버를 재사용합니다.

## 구현 계획

1. 텍스트와 이미지/미디어 콘텐츠에 대한 메시지 처리 기능이 있는 `43_agentic_chat_multimodal` 그래프를 추가합니다.
2. 가능한 경우 다중 모드 지원 모델 구성과 함께 공유 모델 팩토리를 사용합니다.
3. React 이미지 업로드/미리 보기 컨트롤을 추가하고 선택한 이미지를 CopilotKit/LangGraph 메시지 흐름에 전달합니다.
4. 업로드 상태, 썸네일 미리보기, 보조 분석 및 구조화된 관찰을 렌더링합니다.
5. E2E 계획을 위한 결정론적 샘플 이미지 또는 고정 경로를 제공합니다.
6. 예제 43과 같이 그래프, 런타임 에이전트, 예제 메타데이터 및 경로를 등록합니다.

## SDK 및 상태 참고 사항

가능하면 이진 이미지 데이터를 영구 앱 상태에서 제외하세요. 기존 다중 모드 이미지 예제 및 CopilotKit 전송 제약 조건과 일관되게 데이터 URL 또는 업로드된 참조를 사용하십시오.

## 위험

- 런타임 페이로드 크기 제한으로 인해 큰 이미지가 거부될 수 있습니다.
- 구성된 기본 모델은 다중 모드 입력을 지원하지 않을 수 있습니다.
- 브라우저 파일 입력 동작에는 테스트 픽스처 기반 E2E 경로가 필요합니다.

## 승인 기준

- Agentic Chat Multimodal AG-UI 예는 탐색에서 예 43으로 나타납니다.
- 사용자는 이미지를 첨부하고 보내기 전에 미리보기를 볼 수 있습니다.
- 그래프는 이미지 콘텐츠를 수신하고 이미지 인식 응답을 반환합니다.
- 업로드 오류 또는 지원되지 않는 파일 형식이 눈에 보이는 오류로 표시됩니다.
- 문자 전용 메시지는 동일한 채팅에서 계속 작동합니다.

## EXAMPLES-LAYERS-06: local module ownership / 로컬 모듈 책임

The public entry keeps the same provider and agent ID. All extracted code remains local to this example. Hooks run inside the original provider boundary; tool names, schemas, hook order and UI selectors are preserved. No sibling example import is added.

공개 진입점과 provider·agent ID를 유지한다. 분리한 코드는 모두 현재 예제 폴더 안에 두고 기존 provider 내부에서 훅을 실행한다. 도구 이름·스키마·훅 순서·화면 선택자를 유지하며 다른 예제 폴더를 가져오지 않는다.

| Module / 모듈 | Responsibility / 책임 |
|---|---|
| `AgenticChatMultimodalAgUiChat.tsx` | Chat view and DOM event binding / 채팅 화면과 DOM 이벤트 연결 |
| `AgenticChatMultimodalAgUiExample.tsx` | Public provider entry / 공개 provider 진입점 |
| `ToolRenderers.tsx` | Tool payload presentation / 도구 결과 표시 컴포넌트 |
| `media.ts` | Browser file and canvas adapters / 파일·캔버스 브라우저 처리 |
| `model.ts` | Types, schemas and pure parsing / 타입·스키마·순수 변환 |
| `styles.ts` | Local presentation styles / 로컬 표시 스타일 |
| `useAgenticChatMultimodalAgUiChat.tsx` | CopilotKit registration and interaction flow / 도구·컨텍스트 등록과 동작 흐름 |
| `useAgenticChatMultimodalAgUiChatState.ts` | Local state and grouped transitions / 로컬 상태와 관련 상태 전환 |
