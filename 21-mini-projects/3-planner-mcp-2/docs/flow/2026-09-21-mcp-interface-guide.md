# AI MCP Interface 안내

- 날짜: 2026-09-21
- 요구 REQ-010: sidebar 하단 버튼으로 MCP 도구 소개 페이지 이동. 라이브러리를 이용해 현재 도구 스펙 자동 반영.
- 설계: `/mcp-guide` 동적 페이지에서 기존 MCP SDK Client와 InMemoryTransport로 실제 서버의 `tools/list`를 조회. 도구 이름·설명·필수 입력·전체 JSON Schema를 표시하며 별도 수기 도구 목록은 만들지 않음. 현재 실행 중인 배포 기준이며 코드 변경은 배포 후 반영.
- 화면: sidebar 하단 고정 진입부와 독립 스크롤 목록, 도구 검색, 입력 명세, 연결 경로 `/mcp` 안내. 도구 실행 기능은 포함하지 않음.
- 영향 stock: 비즈니스 REQ-010, 시스템 설계, ai-workflow.
- 검증 계획: 실제 HTTP MCP tools/list와 페이지 명세 일치, 이동·검색·모바일·sidebar 스크롤·Storybook. 기존 통합 테스트 회귀.
- 환경: graph MCP 도구가 제공되지 않아 정확한 파일 읽기로 탐색. 브라우저 MCP는 이전 연결 시 No browser is available이어서 standalone Playwright 사용.
- 상태: 구현·검증·4000번 서비스 반영 완료.
- 검증: `pnpm typecheck`, `pnpm lint` PASS. `pnpm test:e2e`에서 production/Storybook build, Bruno HTTP 20건, Playwright 16건 PASS. 실제 HTTP MCP의 22개 도구 입력 스키마와 페이지 명세 전체 일치 확인.
- 외부 확인: http://dodonet.iptime.org:14000/ 에서 하단 링크 이동, 22개 도구, 검색 및 expectedRevision 필수 표시 PASS. 브라우저 오류 없음. 테스트 입력은 검색만 수행하며 사용자 데이터 변경 없음.
- 산출물: playwright-report/index.html, test-results/mcp-guide-mobile.png, test-results/mcp-guide-deployed.png.
- 라이브러리: 설치된 @modelcontextprotocol/sdk 1.30.0 재사용. 추가 패키지/lockfile 변경 없음. [공식 v1 SDK](https://ts.sdk.modelcontextprotocol.io/) 및 설치된 타입 선언 기준.
- 스킬: apb-playwright-e2e (UI 확인·시나리오·실행). master-requirement.md와 사용자 원문은 수정하지 않음.
