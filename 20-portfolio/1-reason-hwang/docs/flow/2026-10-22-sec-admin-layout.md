# 2026-10-22 · SEC 관리자 채팅 레이아웃 개선

- 맥락: 사용자가 호스트 안에 삽입한 OpenUI 기본 레이아웃의 어색함을 지적했다.
- 변경: 중복 내부 사이드바를 제거하고 새 대화·기록을 상단으로 이동했다. OpenUI ThreadList와 대화 컴포넌트는 유지한다. 중첩 카드 테두리, 설명 크기, 시작 질문 카드 폭을 조정했다.
- 범위: 관리자 페이지의 UI/CSS만 변경. API와 에이전트 실행 계약은 유지한다.
- Stock: [관리자 채팅 레이아웃](../stock/sec-chat.md#관리자-채팅-레이아웃).
- 검증: 아래 최종 결과 참조.
- 대화 전환 후 메시지 복원이 되지 않는 기본 동작을 발견해 페이지 수명의 ThreadStorage 어댑터를 추가했다. 새로고침 시 초기화되며 서버/영구 저장은 추가하지 않았다.
- 최종 TypeScript, ESLint(기존 img 경고 1), Steiger PASS. Storybook 1 test PASS. Playwright 2 tests PASS: DSL·타임라인·새 대화·이전 대화 복귀·1280/390px 가로 넘침·오류 표시.
- MCP에서 데스크톱 3열 시작 질문/설명 크기를 확인하고, 유효한 Col 기반 응답 fixture로 대화 전환·복귀와 모바일 가로 넘침 없음을 확인했다. 초기 직접 Markdown root fixture는 표시되지 않아 실제 카탈로그의 Col 구성으로 수정했다. provider 정확성 재검증은 이번 레이아웃 검증 범위가 아니다.
- 증거: `/tmp/sec-layout-{typecheck,lint,stories,e2e-final}.txt`, 저장소 루트 `.playwright-mcp/sec-layout-desktop-final.png`, `.playwright-mcp/sec-layout-mobile-final.png`.
- 자원 정리: MCP 브라우저를 닫고 테스트 runner/브라우저 자식 잔존 없음을 확인했다. 사용자 서비스와 공유 MCP 호스트는 유지했다. staged 7개 파일 범위·diff 검사 및 gitleaks 유출 0건 확인.
