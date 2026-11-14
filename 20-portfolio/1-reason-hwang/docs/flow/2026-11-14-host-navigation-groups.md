# Host 내비게이션 그룹 정리

- 날짜: 2026-11-14
- 결정: HOST-NAV-001
- 배경: Remote Apps와 여러 채팅·UI 기능이 단일 Navigation 목록에 섞여 있었다.
- 변경: Overview / Remote Apps / AI Chat / Generative UI 네 그룹으로 분리. Chat은 LangGraph Chat, SEC Intelligent UI는 SEC Research Chat으로 표시한다. Push UI Chat과 Component Catalog 바로가기를 추가했다.
- 이유: 용도별 탐색을 쉽게 하고 채팅과 컴포넌트 탐색을 구분한다. 기존 URL은 유지한다.
- 활성화: 경로 구간 경계를 검사하고 가장 긴 일치 경로 하나만 선택하여 Catalog와 UI Demos의 동시 활성화를 방지한다.
- 영향 stock: [Host 아키텍처 HOST-NAV-001](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#host-nav-001-사이드바-그룹).

## 검증

- VAL-VIEW-001: Storybook Host/Navigation/Groups. 네 그룹 표시, Todo 링크, Catalog 활성화와 UI Demos 비활성화를 실제 Chromium에서 검증한다. 모바일 Sheet가 닫힌 초기 상태에 의존하지 않도록 이 스토리는 collapsible=none으로 목록을 표시한다.
- 타입 검사 `pnpm -C 1-fe-host typecheck`: PASS.
- lint `pnpm -C 1-fe-host lint`: PASS. 기존 media.tsx img 경고 1개 유지.
- 초기 Storybook 실행은 Vite 최초 의존성 최적화에 따른 reload로 실패했다. 재실행 후 테스트의 모바일 초기 상태 및 Base UI data-active의 속성 존재 방식에 맞춰 assertion을 수정했다.
- API·업무 로직 변경은 없으므로 서버 API E2E와 업무 브라우저 검증은 적용 대상이 아니다.
- 검증은 테스트 소유 headless Chromium과 Vitest 서버만 사용한다. 종료 후 프로세스 잔존을 확인하며 기존 사용자 Chrome/서버는 유지한다.

최종 Storybook: **1/1 PASS**. 테스트 종료 후 `chrome-headless-shell` 및 Playwright runner 잔존 없음 확인. 별도 개발 서버나 MCP Chrome은 시작하지 않았다.
