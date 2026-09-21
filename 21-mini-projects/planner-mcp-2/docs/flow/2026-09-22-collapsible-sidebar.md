# 사이드바 접기

- 요청: 프로젝트 sidebar를 접어서 작업 공간을 넓힌다.
- 설계: 1001px 이상에서 240px 탐색 패널을 52px 버튼 영역으로 접는다. 동일 버튼으로 다시 펼치며 aria-expanded/controls와 접근 가능한 이름을 제공한다.
- 탐색/본문을 unmount하지 않아 검색과 작성 중인 내용은 유지한다. 접힘 상태는 현재 화면 세션의 UI 상태이며 새로고침 후 기본 펼침이다.
- 모바일은 기존 프로젝트 drawer를 사용한다.
- 영향 stock: tech-shared/design-system.md. 검증: Storybook 접기/펼치기·키보드·초안 보존, 실제 앱 데스크톱 및 모바일 회귀.
- 진행: 구현 후 검증 중.

## 검증 결과

- pnpm build, build-storybook, lint, typecheck PASS.
- Storybook Chromium: Enter/Space 토글, 포커스 유지, aria-expanded, 작업 영역 +188px, 검색·본문 초안 보존 PASS.
- 소유 임시 서버 실제 앱 Chromium: 데스크톱 접기/펼치기, 1000px/390px 프로젝트 drawer, Esc 포커스 복귀, 가로 넘침 없음·pageerror 없음 PASS.
- 기존 Playwright layout.spec.ts의 UI-01/02/03, narrow layout, MOBILE-01 총 3/3 PASS (8.8초). 임시 DB에서 실행.
- 브라우저 MCP 미제공으로 Playwright 라이브러리의 실제 Chromium을 사용했다. apb-playwright-e2e 스킬의 접근성 기반 탐색·실행 원칙을 적용했다.
- 상태: 구현·검증 완료. 운영 빌드 갱신 및 4000번 재시작으로 반영.
