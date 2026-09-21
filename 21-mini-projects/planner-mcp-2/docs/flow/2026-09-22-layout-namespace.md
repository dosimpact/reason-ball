# Layout namespace 추출

- 요청: 주요 React 레이아웃 컴포넌트를 layout.tsx에 namespace 패턴으로 추출.
- 위치: src/widgets/workspace/layout.tsx. Next.js 라우트의 src/app/layout.tsx와 구분한다.
- 계약: Layout.Root/Header/Shell/Sidebar/Main/Panels/Canvas/Detail. ES module의 객체 기반 compound component 패턴을 사용한다.
- 기존 WorkspaceShell/WorkspacePanels 구현을 이동하고 화면 조합부 및 Storybook 사용처를 Layout으로 통일한다. DOM 태그·CSS 클래스·스크롤·접기·리사이즈 동작은 유지한다.
- 레이아웃은 표시와 UI 상태만 담당한다. 프로젝트 조회·라우팅·문서 편집은 기존 소비자에 남긴다.
- 검증: 타입 검사, lint, 생산/Storybook 빌드, 기존 브라우저 레이아웃 회귀 수행 중.

## 완료

- typecheck, lint, 생산 빌드, Storybook 빌드 PASS.
- 소유 임시 서버/DB에서 레이아웃·모바일·독립 스크롤·상세 패널 복원 7/7 PASS(16초).
- 별도 Chromium smoke에서 Layout.Shell의 접기/펼치기·aria-expanded·188px 작업 영역 확장 PASS.
- 기존 DOM 구조를 보존하여 CSS 변경 없음. 과거 Storybook story ID도 유지.
- 4000번 운영 서버에 동일 새 빌드를 반영. 사용 스킬: 이전에 읽은 apb-playwright-e2e의 기존 회귀 실행 원칙. 브라우저 MCP 부재로 Playwright Chromium 사용.
