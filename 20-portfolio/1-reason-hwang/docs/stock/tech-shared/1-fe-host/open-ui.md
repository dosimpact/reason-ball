# Generative UI Host

화면 진입점은 `/open-ui/*`이며 구현은 OpenUI Lang이다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md)를 따른다.

- 루트 `app/open-ui`는 FSD `_pages/generative-ui`의 화면을 export한다. `Demo.tsx`가 thread, 요청 취소, 이전 결과, 최신 action revision과 새 대화를 소유하고, 공통 `AgentConversation`에 대화 표시와 입력을 위임한다.
- `api/stream.ts`는 AG-UI CUSTOM ui.output을 읽고 현재 카탈로그로 검증하며 RUN_FINISHED 없는 연결 종료를 실패로 처리한다.
- `shared/ui/intelligent-ui/OutputView.tsx`가 OpenUI Renderer, BusinessAction, ToAssistant, OpenURL과 라이브러리 action을 처리한다. SEC Chat의 AnswerView도 이 컴포넌트를 사용한다. 기존 SEC 관리자 AgentInterface는 같은 library를 전달받는다.
- `_app/api/generative-ui/[mode]/route.ts`가 same-origin 요청과 모드를 검사하고 FastAPI로 스트리밍 중계한다. 브라우저 취소를 upstream에 전달한다. API 키와 모델 설정은 전달하지 않는다.
- `_pages/generative-ui/ui/catalog`은 기준 PoC Lib Story를 이관한 컴포넌트·함수·action 탐색기다. 검색·코드 편집·초기화·반응형 상태를 지원한다. 업무 action 예제는 서버 상태를 변경하지 않는다.
- `sec-ui:generate`가 공유 library에서 프롬프트·명세·Python 자산을 동기화한다. 이전 UI 프로토콜의 registry/schema/manifest는 사용하지 않는다.

검증은 `test:generative-ui`, `test:generative-ui:views`, `test:generative-ui:live`, 기존 `test:sec-chat:views`를 사용한다. live 테스트는 OPENUI_LIVE_BASE_URL의 소유한 서버를 사용하며 서버를 자동 시작하지 않는다. 서버/브라우저 정리까지 [검증 원칙](../../../validation/INDEX.md)을 적용한다.

## OPENUI-AGENT-001: 공통 에이전트 인터페이스

`shared/ui/agent-conversation/`은 `@openuidev/react-ui`의 `AgentInterface`를 사용하는 공통 채팅 UI다. `/chat`, `/sec-chat`, `/open-ui/dynamic`, `/open-ui/fixed`, `/open-ui/sec`, `/examples/push-ui-message`에서 표준 Composer·메시지 목록·헤더를 사용한다. `/sec-api-agent`는 기존 `fetchLLM`·`agUIAdapter` 기반 AgentInterface를 유지한다. 카탈로그와 대화가 아닌 화면은 전환 대상이 아니다.

`ChatLLM.send`는 기존 화면 controller의 전송 함수를 호출하고, 표준 중단 신호는 해당 controller의 AbortController로 연결한다. 기존 SDK/SSE 파서가 전송을 소비하므로 공통 adapter의 parser는 추가 이벤트를 만들지 않는다. `SyncMessages`는 domain controller가 관리하는 메시지를 OpenUI thread에 반영한다. OpenUI 내부 사이드바는 숨기고 호스트 내비게이션을 유지한다. Host 테마를 공유하며 첫 client mount 후 렌더링한다.

AssistantMessage 확장 렌더러는 화면별 검증 결과를 표시한다. SEC의 근거·추천 질문·실행 기록, 기술적 분석의 OpenUI 차트, 데모의 최신 revision action 제한, 학습 예제의 진행 단계는 각 domain controller와 renderer가 소유한다. 공통 UI 도입이 전송 형식이나 서버의 상태 소유권을 변경하지 않는다. 기존 화면의 메모리 보관·만료 정책도 유지한다.

변경과 검증은 [이관 기록](../../../flow/2026-11-14-agent-interface-migration.md)을 따른다.

화면 추천·선택 action처럼 SDK 밖에서 시작한 실행은 `busy`로 Composer 전송을 비활성화하고 별도 중단 버튼을 제공한다. SDK에서 시작한 실행은 표준 Cancel을 사용한다. 새 대화는 작성 중 입력도 초기화하며 실행 중에는 비활성화한다.
