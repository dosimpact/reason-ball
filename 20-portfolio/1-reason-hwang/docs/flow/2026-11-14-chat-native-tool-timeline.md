# /chat SDK 기본 Behind the scenes 정합성

날짜: 2026-11-14. 결정 ID: `CHAT-ACTIVITY-002`. 이전 flow와 사용자·동시 작업·human-docs를 보존한다.

## 요청과 계획

기존 도구 현황을 별도 ChatActivity로 그리지 않고 SDK ToolCallTimeline/BehindTheScenes 경로에 안전한 tool-call/result 데이터를 연결한다. 타임라인은 assistant 본문 위에 turn별 한 번만 표시하고, 중복된 agent-conversation__status 실행 띠는 제거한다. 도구 인자·원문 결과·비공개 추론은 노출하지 않는다.

검증 시나리오: running/completed/error/interrupted, 도구 없는 turn, 복수 turn과 중복 id, 기록 복원·새 대화·reset, 실제 TA 도구와 기존 차트/Query refresh를 확인한다. 별도 idle/running status bar 부재와 오류 안내 유지, 전체 graph 선택/JSON 입력 회귀를 확인한다. 모바일390/desktop1440 및 실제 theme 버튼으로 light/dark를 캡처한다. runtime이 완료 snapshot만 보내면 실시간 진행으로 주장하지 않는다.

적용 게이트는 VAL-VIEW-001(Storybook), VAL-BROWSER-001(브라우저), 관련 unit/typecheck/lint와 VAL-CLEANUP-001이다. 서버 endpoint 계약 변경은 계획하지 않는다. 소유 Host3183 `.next-native-tools-validation`, fixture3984, 필요 시 runtime3982와 소유 browser만 사용하고 사용자 개발 서버·공유 MCP를 종료하지 않는다. 구현·검증은 진행 중이다.

## 구현과 fixture 검증

기본 SDK Thread가 안전한 toolCalls/role=tool 결과를 받아 본문 위에 native 타임라인을 렌더링한다. 공개 ToolCallTimeline 슬롯은 instance ref의 pending id를 native executing 상태로 보정해 동일 SDK 컴포넌트에 전달한다. private store mutation·CSS 순서 변경은 없다. 정상 idle/running 상태 띠와 ChatActivity는 제거하고 실제 오류 안내는 유지한다. chat은 기존 한 번의 stream에서 configured 모드를 보존하면서 values를 보장하며 JSON 실행과 기존 OutputView/Query는 유지한다.

- unit22개, Storybook19개, typecheck/lint PASS(각 담당 에이전트). Story는 native pending 펼침 상태의 완료 후 유지, 본문 앞 DOM 순서와 오류 detail을 포함한다.
- `SEC_LIVE_BASE_URL=http://127.0.0.1:3183 pnpm -C 1-fe-host test:e2e tests/e2e/chat-native-tools.spec.ts --project=chromium`: 2/2 PASS(7.8초). 두 turn의 타임라인 각1개, 본문 앞 배치, 일반 실패·중단 detail, 기록 복원, 새 대화, 도구 없는 turn, SECRET_ARGUMENT/SECRET_TOOL_RESULT 미노출을 확인했다.
- Playwright MCP navigate/run_code로 fixture running 상태를 실제 클릭했고 정상 stripe0·native working1을 확인했다. `.playwright-mcp/chat-native-fixture-running.png`. SDK static Working loader는 rect0x0의 숨김 요소이며 화면의 중복 도구 타임라인으로 계산하지 않는다. 초기 단순 DOM count2를 geometry로 확인해 보정했다.
- fixture는 외부 모델/SEC/DB가 없는 기존3984 서버를 확장했다. 이전 flow는 변경하지 않았다. 반복 실행 시 동일 제목의 기록이 여러 개 생기는 harness locator와 native detail row의 빈 accessible name에 맞춰 selector를 수정한 후 최종 PASS했다.

실제 TA 첫 두 bounded 요청은 `No generations found in stream.`로 실패했고 runtime status=error와 화면 오류를 확인했다. 이를 도구 실행 성공으로 기록하지 않는다. 원인 검토에서 이번 작업이 강제로 추가한 messages-tuple 모드가 LangGraph의 모델 자동 streaming을 켜 기존 provider 경로를 바꾸는 회귀를 발견했다. 기존 configured 모드를 보존하면서 values를 보장하도록 수정하고 영향 테스트 뒤 한 번의 bounded 검증을 다시 수행하기로 했다. 이를 외부 provider 장애로 단정한 초기 해석은 철회한다.

## 실제 TA 및 회귀 수정 결과

강제 token streaming을 제거하고 기존 configured 모드를 보존해 TA는 values-only로 유지했다. 수정 후 승인된 한 번의 bounded AAPL60 실제 요청이 성공했다. native 타임라인1개에 get_price_ohlcv/analyze_ohlcv_with_talib 두 도구가 각각 한 번 표시되며 본문 위(y158 vs279)에 위치했다. 정상 상태 stripe0, 실제 Yahoo/TA-Lib 차트19canvas와 Query refresh HTTP200, refresh 중 model runs0을 확인했다. 새 대화 후 기록을 열어 native 타임라인1개/도구2개/차트1개 복원도 MCP로 확인했다.

실제 `.playwright-mcp/chat-native-real-{desktop,mobile}-{light,dark}.png`는1440x1000/390x844이며 Host theme 버튼으로 전환했다. desktop light/mobile dark를 시각 확인했다. provider 실패 상태 desktop/mobile 캡처도 `chat-native-real-error-{desktop,mobile}.png`에 보존한다. 실제 도구는 상위 완료 snapshot에서 묶여 도착했으므로 per-tool live 진행을 검증했다고 주장하지 않는다. fixture running과 실제 완료 이력을 구분한다. 모델/전송 회귀를 포함한 최종 unit23개 및 typecheck/scoped lint PASS; view19개 PASS.

## 최종 재검증·정리

전송 회귀 수정 후 동일 fixture E2E2개를 다시 실행하여 2/2 PASS(15.8초)를 확인했다. 소유 Host3183/runtime3982/fixture3984를 exact tool session의 정상 종료로 정리했고 세 포트 LISTEN 부재를 확인했다. CLI 테스트 Chromium PID65970/65971/65972/66070 부재를 ps로 확인했다. MCP browser_close는 No open tabs를 반환했고 공유 MCP 서버와 사용자 브라우저는 종료하지 않았다. 작업 전용 `.next-native-tools-validation` 및 자동 tsconfig include를 제거하고 next-env는 기존 `.next/types/routes.d.ts`로 복원했다. 사용자 서비스와 동시 modeling/문서/human-docs 변경은 유지했다.

Stock은 [Host OpenUI CHAT-ACTIVITY-002](../stock/tech-shared/1-fe-host/open-ui.md#chat-activity-002-chat-sdk-기본-도구-타임라인)에 동기화했다. 과거 flow는 수정하지 않았다. 서버 endpoint/API 계약 변경은 없으므로 신규 Bruno endpoint 테스트는 적용하지 않았다. HTML 보고서는 ignored `1-fe-host/playwright-report/index.html`, 스크린샷은 ignored `.playwright-mcp/`에 보존한다. 필수 검증과 정리 완료.
