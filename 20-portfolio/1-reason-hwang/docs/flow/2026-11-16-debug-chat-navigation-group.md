# HOST-NAV-DEBUG-001: 디버깅 채팅 메뉴 분리

- 날짜: 2026-11-16
- 요청: LangGraph 개발 채팅과 FastAPI 채팅은 디버깅 용도이므로 AI Chat과 별도 그룹으로 구분.
- 변경: 두 기존 링크를 새 `Debugging` 그룹으로 이동. AI Chat에는 사용자용 에이전트 메뉴 유지.
  링크 URL·활성 경로 판정·모바일 메뉴 클릭 동작은 그대로 사용한다.
- Stock: [Host HOST-NAV-001](../stock/tech-shared/1-fe-host/2-frontend-side-architecture.md#host-nav-001-사이드바-그룹) 갱신.
- 기존 진행 중인 TA-Lib 메뉴 등 다른 변경은 보존하고 이번 커밋 범위에서 제외한다.

## 검증 및 정리

- VAL-VIEW-001: 기존 `Host/Navigation/Groups` Storybook Chromium play에서 Debugging 그룹의 링크가 정확히 2개인지,
  두 URL이 기존 값인지, AI Chat에 두 디버깅 메뉴가 없는지 및 기술적 분석 링크·활성 표시 회귀 확인. 1 PASS.
- 명령: `pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/widgets/host-navigation/ui/AppSidebar.stories.tsx`.
- 증거: `/tmp/debug-nav-storybook.log`. 변경 파일 ESLint와 diff check PASS.
- 정적 메뉴 그룹 재배치만으로 API·업무 흐름 변경 없음. 별도 API/MCP 실행 대상 아님.
- Vitest 세션83862 정상 종료(exit0), 소유 Storybook/Chromium 런타임 종료. 별도 앱 서버·MCP·DB 자원 생성 없음.
  사용자 서버·공유 브라우저는 변경하지 않았다.
