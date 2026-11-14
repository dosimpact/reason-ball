# Host 공통 헤더 제거

- 날짜: 2026-11-14
- 결정 ID: HOST-HEADER-001
- 배경: Host 상단 공통 헤더와 앱/채팅 헤더가 중복되고, 공통 헤더 높이가 콘텐츠 영역을 차지했다.
- 변경: Root SidebarInset의 `h-14` 공통 헤더를 제거하고 `min-h-svh` 콘텐츠에 페이지를 직접 렌더링한다. 화면 헤더는 각 앱 또는 AgentChatFrame이 소유한다. 공통 채팅 높이는 `100svh`로 설정한다.
- 내비게이션: 테마와 데스크톱 사이드바 trigger는 sidebar footer로 이동한다. 모바일은 `widgets/host-navigation`의 MobileSidebarTrigger가 왼쪽 아래 고정 버튼을 제공하며 md 이상에서 숨긴다.
- 이유: 공통 Host 장식과 앱 UI의 중복을 없애고 페이지가 전체 화면 높이를 사용하도록 한다. 내비게이션·테마 접근은 보존한다.
- 영향 stock: [Host 아키텍처](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#host-header-001-host-공통-헤더-제거), [공통 채팅 설계](../stock/tech-shared/1-fe-host/open-ui.md#host-header-001-앱-헤더와-전체-높이).
- 범위: Host 조립·내비게이션 UI·공통 채팅 viewport. 업무 controller와 API 계약은 변경하지 않는다.

## 검증 및 후속 상태

HOST-HEADER-001 시나리오: SidebarInset 직계 공통 header가 없어야 하며, 각 앱 제목/입력창과 메뉴/테마 접근이 유지되어야 한다.

- 타입 검사: `pnpm -C 1-fe-host typecheck` PASS. 최초 실행은 실행 중 Next 생성 타입의 stale 경로 오류가 있었으나 재실행 통과했다.
- `pnpm -C 1-fe-host lint`: PASS, Steiger0문제. 기존 media.tsx img 경고1개 유지.
- Storybook AppSidebar/AgentConversation: 2파일 **4/4 PASS**.
- `SEC_LIVE_BASE_URL=http://127.0.0.1:3280 pnpm -C 1-fe-host test:e2e tests/e2e/host-shell.spec.ts tests/e2e/host-theme.spec.ts tests/e2e/shared-chat-design.spec.ts --workers=1`: **8/8 PASS** (16.3s).
- 신규 shell2개는 4개 채팅 앱의 Host header 부재·앱 title/input 보존, desktop footer collapse/expand, mobile menu open/theme/명시적 close를 검증했다. 기존 theme2개와 shared chat4개도 통과했다.
- MCP 화면: desktop Host 직계 header0개, 앱 frame top0/height1000(1000px viewport). mobile viewport390/scrollWidth390/frame top0 확인. [데스크톱](evidence/host-header-removal-2026-11-14/desktop.png), [모바일](evidence/host-header-removal-2026-11-14/mobile.png) PNG 저장.
- 모바일 고정 버튼은 입력창과 겹치지 않도록 bottom-24 위치에 둔다. 상단 공간을 예약하지 않는다.
- 첫 cold isolated build에서 navigation30s timeout이 발생했다. 다중 페이지 검사 예산90s 및 모바일 준비 상태 동기화를 적용하고 warm 서버에서 최종 통과했다.
- 별도 탐색에서 모바일 Sheet가 Escape로 닫히지 않는 동작을 관찰했다. 이번 지원 경로는 footer Toggle Sidebar 버튼으로 닫기이며 이를 성공 검증했다. 공통 Sheet 키보드 동작은 이번 헤더 제거 범위에서 수정하지 않았고 별도 후속 관찰로 남긴다.
- E2E 네트워크는 fixture 응답이다. 실제 모델·외부 API 호출은 수행하지 않았다. API 계약 변경 없음. VAL-VIEW-001은 Storybook, VAL-BROWSER-001은 MCP/E2E로 검증했다.

## 자원 정리

- 작업 소유 검증 서버3280(PID49426)은 별도 `NEXT_DIST_DIR=.next-header-layout`로 기존 사용자 FE2983과 빌드 출력을 분리했다. 작업 종료 시 실행 세션 종료 신호로 정상 종료 후 ps/lsof 잔존 없음 확인.
- 작업 Chrome PID49786은 공식 browser_close 후 ps 잔존 없음 확인. E2E/Storybook runner 및 headless Chrome도 종료·잔존 없음 확인.
- 임시 `.next-header-layout` 출력물을 삭제하고 Next가 자동 변경한 next-env.d.ts/tsconfig.json의 검증 디렉터리 참조만 원래 상태로 복구했다. 사용자 환경파일과 기존 출력물은 유지했다.
- 사용자 확인용 FE2983(PID46609)과 기존 앱·인프라·공유 MCP는 계속 유지한다. 사용자 AGENTS/human-docs 변경도 보존한다.
