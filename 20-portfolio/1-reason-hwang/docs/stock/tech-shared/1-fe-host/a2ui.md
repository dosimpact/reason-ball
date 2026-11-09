# Generative UI Host

과거 문서 경로와 `/a2ui/*` URL을 유지하며 구현은 OpenUI다. 공통 계약은 [OpenUI 통합 설계](../openui-migration.md)를 따른다.

- 루트 `app/a2ui`는 FSD `_pages/generative-ui`의 화면을 export한다. `Demo.tsx`가 thread, 요청 취소, 이전 결과, 최신 action revision과 새 대화를 소유한다.
- `api/stream.ts`는 AG-UI CUSTOM ui.output을 읽고 현재 카탈로그로 검증하며 RUN_FINISHED 없는 연결 종료를 실패로 처리한다.
- `shared/ui/intelligent-ui/OutputView.tsx`가 OpenUI Renderer, BusinessAction, ToAssistant, OpenURL과 라이브러리 action을 처리한다. SEC Chat의 AnswerView도 이 컴포넌트를 사용한다. 기존 SEC 관리자 AgentInterface는 같은 library를 전달받는다.
- `_app/api/generative-ui/[mode]/route.ts`가 same-origin 요청과 모드를 검사하고 FastAPI로 스트리밍 중계한다. 브라우저 취소를 upstream에 전달한다. API 키와 모델 설정은 전달하지 않는다.
- `_pages/generative-ui/ui/catalog`은 기준 PoC Lib Story를 이관한 컴포넌트·함수·action 탐색기다. 검색·코드 편집·초기화·반응형 상태를 지원한다. 업무 action 예제는 서버 상태를 변경하지 않는다.
- `sec-ui:generate`가 공유 library에서 프롬프트·명세·Python 자산을 동기화한다. 별도의 A2UI registry/schema/manifest는 없다.

검증은 `test:generative-ui`, `test:generative-ui:views`, `test:generative-ui:live`, 기존 `test:sec-chat:views`를 사용한다. live 테스트는 OPENUI_LIVE_BASE_URL의 소유한 서버를 사용하며 서버를 자동 시작하지 않는다. 서버/브라우저 정리까지 [검증 원칙](../../../validation/INDEX.md)을 적용한다.
