# 모바일 UX 전면 개편

- 날짜: 2026-09-22
- 요청: 모바일 경험을 항상 우선하고, 고정 sidebar를 drawer로 바꾸는 수준의 전면 UX 개편.
- 영향 stock: `stock/tech-shared/design-system.md`, `stock/tech-shared/planner-mcp-2/implementation.md`, `stock/project-management/INDEX.md`, `validation/INDEX.md`.

## 감사와 결정

- 서브에이전트가 390×844 Playwright 증거와 정확한 UI 소스를 독립 감사했습니다. 기존 화면은 2행 topbar와 26dvh sidebar가 첫 화면의 약 38%를 점유했고, 1000px 이하에서 캔버스와 상세를 단순 적층해 문서 선택 뒤 편집기까지 긴 스크롤이 필요했습니다.
- codebase-memory graph MCP가 현재 세션에 노출되지 않아 generation/index coverage는 확인하지 못했습니다. `workspace.tsx`, `workspace-panels.tsx`, `globals.css`, 기존 E2E와 stock 문서를 직접 읽어 범위를 확인했습니다.
- 1000px 이하 프로젝트 탐색은 Radix Dialog 기반 왼쪽 drawer로 통합합니다. 데스크톱 sidebar와 drawer는 같은 렌더 함수를 사용해 기능 차이를 방지합니다.
- 1000px 이하 작업 공간은 `문서 목록 / 문서 상세` 단일 패널로 전환합니다. 두 패널은 mount 상태를 유지해 반응형 전환과 탭 이동 중 저장 전 입력을 보존하고, 문서가 바뀌면 상세 탭을 자동 선택합니다.
- 720px 이하 주요 메뉴는 safe-area 하단 내비게이션으로 옮깁니다. 입력은 16px, 주요 터치 대상은 44px 이상, 편집 toolbar는 가로 스크롤 방식으로 표시합니다.

## 구현

- `Workspace`에 프로젝트 drawer trigger·focus 복귀·공용 프로젝트 탐색 콘텐츠를 추가했습니다. 프로젝트 선택·생성·설정·MCP 안내 동선을 drawer에서 그대로 사용할 수 있습니다.
- `WorkspacePanels`에 모바일 단일 패널 탭을 추가하고 기존 데스크톱 resizable/상세 접기 동작을 유지했습니다.
- 390px은 단일 app bar와 하단 내비게이션, 큰 모바일 Dialog, safe-area 여백을 사용합니다. 768px에서도 sidebar 대신 drawer와 단일 패널을 사용합니다.
- Playwright에 MOBILE-01과 390/768 반응형·초안 보존·drawer 회귀를 추가하고 기존 MCP 안내 모바일 검증을 drawer 동선에 맞췄습니다.

## 검증

- `pnpm --filter planner-mcp-2 test`: 34/34 PASS.
- `pnpm --filter planner-mcp-2 typecheck`: PASS.
- `pnpm --filter planner-mcp-2 lint`: PASS.
- 생산 build와 Storybook build: PASS. 기존 Storybook Vite module directive/chunk size 경고는 유지.
- Bruno 실제 HTTP: 41/41 PASS.
- 첫 Playwright 전체 실행: 38개 중 36 PASS, 새 drawer Esc 포커스 복귀 검증 2건 FAIL. 제어형 Dialog의 호출 버튼 ref가 없던 원인을 수정했습니다.
- 수정 후 소유 서버·임시 DB에서 영향 범위 `layout.spec.ts`, `mcp-guide.spec.ts`: 8/8 PASS. 390px drawer·하단 내비게이션·단일 패널·가로 overflow, 768px drawer·단일 패널, 1440px sidebar/resizable/초안 보존 회귀를 포함합니다.
- 최종 전체 재실행: 생산 build·Storybook build PASS, Bruno 41/41 PASS, Playwright 38/38 PASS. 소유 서버와 임시 DB를 사용하고 종료 시 정리했습니다.
- 외부 배포 URL은 변경 전 화면만 확인했으며 현재 코드 재배포는 이번 작업 범위에서 수행하지 않았습니다.
