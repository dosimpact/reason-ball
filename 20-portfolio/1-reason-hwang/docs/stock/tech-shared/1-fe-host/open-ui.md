# Generative UI Host

화면 진입점은 `/open-ui/*`이며 구현은 OpenUI Lang이다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md)를 따른다.

- 루트 `app/open-ui`는 FSD `_pages/generative-ui`의 화면을 export한다. `Demo.tsx`가 thread, 요청 취소, 이전 결과, 최신 action revision과 새 대화를 소유하고, 공통 `AgentConversation`에 대화 표시와 입력을 위임한다.
- `api/stream.ts`는 AG-UI CUSTOM ui.output을 읽고 현재 카탈로그로 검증하며 RUN_FINISHED 없는 연결 종료를 실패로 처리한다.
- `shared/ui/intelligent-ui/OutputView.tsx`가 OpenUI Renderer, BusinessAction, ToAssistant, OpenURL과 라이브러리 action을 처리한다. SEC Chat의 AnswerView도 이 컴포넌트를 사용한다. SEC 관리자 채팅은 공통 AgentChatFrame에 같은 library를 전달한다.
- `_app/api/generative-ui/[mode]/route.ts`가 same-origin 요청과 `dynamic`/`fixed` 모드를 검사하고 FastAPI로 스트리밍 중계한다. 브라우저 취소를 upstream에 전달한다. API 키와 모델 설정은 전달하지 않는다.
- `_pages/generative-ui/ui/catalog`은 기준 PoC Lib Story를 이관한 컴포넌트·함수·action 탐색기다. 검색·코드 편집·초기화·반응형 상태를 지원한다. 업무 action 예제는 서버 상태를 변경하지 않는다.
- `sec-ui:generate`가 공유 library에서 프롬프트·명세·Python 자산을 동기화한다. 이전 UI 프로토콜의 registry/schema/manifest는 사용하지 않는다.

검증은 `test:generative-ui`, `test:generative-ui:views`, `test:generative-ui:live`, 기존 `test:sec-chat:views`를 사용한다. live 테스트는 OPENUI_LIVE_BASE_URL의 소유한 서버를 사용하며 서버를 자동 시작하지 않는다. 서버/브라우저 정리까지 [검증 원칙](../../../validation/INDEX.md)을 적용한다.

## OPENUI-AGENT-001: 공통 에이전트 인터페이스

`shared/ui/agent-conversation/`은 `@openuidev/react-ui`의 `AgentInterface`를 사용하는 공통 채팅 UI다. `/chat`, `/sec-chat`, `/open-ui/dynamic`, `/open-ui/fixed`, `/examples/push-ui-message`에서 표준 Composer·메시지 목록·헤더를 사용한다. `/sec-api-agent`는 `fetchLLM`·`agUIAdapter` 전송을 공통 `AgentChatFrame`에 연결한다. 카탈로그와 대화가 아닌 화면은 전환 대상이 아니다.

`ChatLLM.send`는 기존 화면 controller의 전송 함수를 호출하고, 표준 중단 신호는 해당 controller의 AbortController로 연결한다. 기존 SDK/SSE 파서가 전송을 소비하므로 공통 adapter의 parser는 추가 이벤트를 만들지 않는다. `SyncMessages`는 domain controller가 관리하는 메시지를 OpenUI thread에 반영한다. OpenUI 내부 사이드바는 숨기고 호스트 내비게이션을 유지한다. Host 테마를 공유하며 첫 client mount 후 렌더링한다.

AssistantMessage 확장 렌더러는 화면별 검증 결과를 표시한다. SEC의 근거·추천 질문·실행 기록, 기술적 분석의 OpenUI 차트, 데모의 최신 revision action 제한, 학습 예제의 진행 단계는 각 domain controller와 renderer가 소유한다. 공통 UI 도입이 전송 형식이나 서버의 상태 소유권을 변경하지 않는다. 기존 화면의 메모리 보관·만료 정책도 유지한다.

변경과 검증은 [이관 기록](../../../flow/2026-11-14-agent-interface-migration.md)을 따른다.

화면 추천·선택 action처럼 SDK 밖에서 시작한 실행은 `busy`로 Composer 전송을 비활성화하고 별도 중단 버튼을 제공한다. SDK에서 시작한 실행은 표준 Cancel을 사용한다. 새 대화는 작성 중 입력도 초기화하며 실행 중에는 비활성화한다.


## OPENUI-CHAT-DS-001: 공통 채팅 디자인 시스템

`shared/ui/agent-conversation`은 모든 채팅이 공유하는 표현 계층이다. `/sec-api-agent`, `/sec-chat`, `/chat`, `/open-ui/{dynamic,fixed}` 및 Push UI 채팅은 동일한 프레임·토큰·반응형 배치·Welcome·메시지 목록·Composer·헤더 액션을 사용한다. 페이지별 CSS로 프레임이나 입력창을 다시 정의하지 않는다. 카탈로그와 비채팅 화면은 이 계약의 대상이 아니다.

- `AgentChatFrame`: OpenUI `AgentInterface`를 소유하는 공통 프레임. native `ChatLLM`, 선택적 `storage`, `componentLibrary`, `onAction`을 받는다. SEC API Agent는 기존 AG-UI adapter와 메모리 대화 보관을 이 프레임에 연결한다.
- `AgentConversation`: 기존 domain controller의 메시지·전송·AbortController를 공통 프레임에 연결하는 adapter. SEC Intelligent UI, 일반 Chat, 기술적 분석, Generative UI는 서버 계약을 바꾸지 않고 이 adapter를 사용한다.
- 표현 입력: `title`, `description`, `welcomeTitle`, `starters`, `placeholder`. 헤더의 새 대화·중단·선택적 대화 기록은 공통 액션이다. 새 대화는 SDK 상태와 입력 초안을 함께 초기화한다.
- 확장 슬롯: `toolbar`는 그래프 선택·기업 확인 등 화면 컨트롤, `status`는 진행·오류 안내, `footer`는 데이터 범위·출처 정책·선택 공시 메타데이터를 제공한다. `children`은 provider 내부에서 실행되는 저장·동기화 helper용이다.
- `ChatNotice`: info/error/status 표현을 공유하며 error는 alert, status는 status 역할로 전달한다.
- `ConversationText`: 일반 assistant 본문도 공유 OpenUI `Markdown` 카탈로그를 사용한다. 문자열을 JSON으로 이스케이프하고 DSL로 감싸며 원시 Markdown 기호를 별도 plain paragraph에 출력하지 않는다. 차트·근거·폼은 기존 renderer 확장으로 유지한다.
- `ChatPageLayout`: 추가 페이지 제목·설명·도구 모음이 필요한 경우의 공통 외부 레이아웃이다. 업무 컴포넌트는 대화 프레임 CSS를 소유하지 않는다.
- 디자인 CSS: 공통 `agent-conversation.css`가 화면 폭·높이·간격·테마·모바일·입력 영역과 헤더 액션을 관리한다. 각 페이지에는 근거·타임라인·기업 선택 등 도메인 요소의 CSS만 남긴다.

컨트롤러별 상태 소유권은 유지한다. 생성 UI의 최신 revision 제한, SEC의 근거·추천 질문·기업 확인·공시 준비, 기술적 분석의 검증된 차트, 관리자 채팅의 도구 타임라인과 대화 기록은 공통 프레임의 확장이다. 외부 action 실행 중 busy guard와 중단 연결도 공통 계층을 따른다.

[변경 및 검증 기록](../../../flow/2026-11-14-shared-chat-design-system.md)


## HOST-HEADER-001: 앱 헤더와 전체 높이

Host RootLayout은 공통 상단 헤더를 표시하지 않는다. AgentChatFrame의 제목·도구 모음·대화 액션이 채팅 화면의 헤더이며, 다른 앱은 필요한 헤더를 각 페이지에서 제공한다. Root 콘텐츠는 `min-h-svh`, 공통 채팅 프레임은 `100svh`를 사용한다. 이전 Host `h-14` 헤더를 위한 높이 차감이나 중복 여백을 추가하지 않는다.

호스트 테마 토글과 데스크톱 사이드바 접기 버튼은 사이드바 footer에 있다. 모바일은 Host 내비게이션 위젯의 왼쪽 아래 고정 버튼으로 사이드바를 연다. 이 내비게이션 버튼은 페이지별 채팅 헤더가 소유하지 않으며 모든 앱에서 유지된다. 테마 상태는 기존 HostThemeProvider를 공유한다.

[Host 레이아웃 계약](2-frontend-side-architecture.md#host-header-001-host-공통-헤더-제거) · [변경 및 검증](../../../flow/2026-11-14-host-header-removal.md)

## OPENUI-SEC-REMOVE-001: SEC 화면 범위

Generative UI 진입 화면은 매출 분석·항공편 선택·카탈로그를 제공한다.
SEC 전용 데모 경로와 메뉴는 제거했으며 회사·공시 업무는 `/sec-api-agent`와 `/sec-chat`에서 제공한다.
SEC 채팅이 공유하는 renderer·카탈로그·채팅 프레임은 유지한다.
