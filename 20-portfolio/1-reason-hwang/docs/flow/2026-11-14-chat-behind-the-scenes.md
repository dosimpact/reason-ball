# Chat Behind the scenes 실행 기록

날짜: 2026-11-14. 결정 ID: `CHAT-ACTIVITY-001`. 범위: Host `/chat`과 공통 AgentInterface 메시지 연결.

## 요청과 사전 확인

사용자는 AgentInterface의 Behind the scenes 표시를 `/chat`에서 활성화하도록 요청했다. 설치 SDK에 ToolCallTimeline·BehindTheScenes가 있으며 현재 공통 SyncMessages는 id/role/content만 전달한다. 실제 도구 실행과 상태를 기존 스트림에서 연결하고 비공개 추론을 만들거나 표시하지 않는다. 다른 화면의 동작을 불필요하게 넓히지 않는다.

관련 stock: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md), [기술적 분석 시스템](../stock/technical-analysis/system-design.md). 과거 flow는 수정하지 않는다.

## acceptance

- 실제 `/chat`에서 도구를 사용하는 요청을 보내면 실행·도구 progress와 완료 상태가 SDK Behind the scenes에 표시된다.
- 접기/펼치기, 답변 렌더링, Query 차트 및 새 대화 동작을 유지한다.
- 도구 없는 요청·실행 취소·새 대화는 오래된 실행을 현재 실행으로 표시하지 않는다.
- 공유 View 변경은 Storybook, business stream 연결은 MCP 실제 브라우저로 검증한다. API 계약 변경이 없으면 새 API E2E는 적용 대상이 아니다.
- 소유 isolated Host3183(`.next-chat-activity-validation`)·runtime3982·필요한 Storybook6106와 MCP 브라우저만 정리하며 사용자 개발 서버·공유 MCP·human-docs는 보존한다.

구현·검증 PASS. 최종 구현·runtime 제한을 stock에 동기화했다.

## 실행 검증과 범위

- FE extraction/state5 tests PASS, typecheck/lint PASS. View Storybook3/3 PASS(`chat-chatactivity--running`, `--completed`, `--no-tools`). 현재 turn 경계·id dedupe·도구 error·cancel·reset 후 늦은 완료/오류가 새 실행을 바꾸지 않는 회귀를 포함한다.
- MCP 실제 Host3183 `/chat` 기술적 분석 AAPL 일봉60 요청이 실제 모델·Yahoo·TA-Lib를 실행했다. `Behind the scenes` 버튼을 펼쳐 `get_price_ohlcv · 완료`, `analyze_ohlcv_with_talib · 완료` 확인. 차트19canvas·Query refresh 유지, alert 없음. PNG `.playwright-mcp/chat-behind-the-scenes.png` 보존(ignored 실행 증거).
- MCP starter_graph의 실제 `안녕` 응답에서 활동 패널0 확인. 새 대화에서 과거 이력 제거. 실행 직후 Cancel 후 새 대화에서 activity0·Ready 복구 확인.
- MCP Storybook Running fixture는 SDK `Working...`가 expanded 상태이며 `get_price_ohlcv · 실행 중` 확인. 실제 nested Deep Agent는 상위 values가 node 완료 후 전달되어 완료 이력이 먼저 보일 수 있다. 이번 변경은 별도 subgraph streaming을 추가하지 않으며 실제 per-tool 실시간 진행을 검증했다고 주장하지 않는다.
- Python narrow fix는 업무 tool payload error가 ToolMessage.status=error가 되도록 하여 공급자 실패를 완료로 오표시하지 않는다. HTTP API 계약은 변경하지 않는다.18 targeted tests 및 scoped Ruff PASS.

## 자원 소유

소유 Host3183(session10494, PID81833, `.next-chat-activity-validation`), runtime3982(session35083, PID81854/81861), Storybook6106(session81459, PID82683), MCP 전용 ChromePID82011. 사용자 개발 서비스·공유 MCP는 유지 대상이다.

- 실제 오류 브라우저 검증: 합성 invalid ticker는 모델이 조회를 거절하여 tray를 만들지 않았다. 실제 TWTR 조회 실패 후 펼친 panel에 `get_price_ohlcv · 오류`, `analyze_ohlcv_with_talib · 오류`를 확인했다. `.playwright-mcp/chat-behind-the-scenes-error.png` 보존. 최종 콘솔 오류0.

## 최종 판정과 정리

VAL-VIEW-001·VAL-BROWSER-001 PASS. 실제 완료·오류 이력과 도구 없는 응답·Cancel→새 대화 초기화를 검증했다. live 진행은 runtime values 전달 여부에 의존하며 별도 중첩 스트림 추가는 이번 범위 밖이다.

VAL-CLEANUP-001 PASS: 소유 세 서버 tool session에 Ctrl-C 정상 종료, MCP browser_close로 두 탭·전용 Chrome 종료. `ps -p 81833,81854,81861,82011,82683 -o pid,ppid,state,command` 결과 header만, `lsof -nP -iTCP:3183 -iTCP:3982 -iTCP:6106 -sTCP:LISTEN` 결과 없음. `.next-chat-activity-validation`과 자동 tsconfig include/next-env 참조를 제거했다. PNG·MCP 증거와 사용자 서비스·공유 MCP는 보존했다. human-docs·기존 flow·사전 사용자 변경은 쓰지 않았다.
