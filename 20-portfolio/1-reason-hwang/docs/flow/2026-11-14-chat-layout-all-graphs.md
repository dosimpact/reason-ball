# Chat 레이아웃과 전체 LangGraph 선택

날짜: 2026-11-14. 결정 ID: `CHAT-LAYOUT-002`, `CHAT-GRAPHS-001`. 기존 사용자·동시 작업·human-docs·과거 flow는 보존한다.

## 요청과 기존 증거

사용자는 현재 /chat 디자인의 캡처 후 개선과 모든 등록 LangGraph 에이전트 선택·테스트를 승인했다. 초기1440x1000/390x844 캡처는 `.playwright-mcp/chat-design-before-{desktop,mobile}.png`. 빈 대화에서 분리된 toolbar/Ready/Chat header, 중복설명, 모바일 상단268px 점유를 확인했다. 가로넘침·JS예외는 없었다. 개발overlay의 composer겹침은 제품레이아웃과 구분한다.

## acceptance

- 통합상단·History/new/cancel·한글welcome·하단composer를desktop/mobile·light/dark·대화있는상태에서 확인한다.
- 고정whitelist없이 runtime 등록graph전부검색·표시한다. 모든graph가messages입력이라고 가정하지 않고 schema계약에 맞춰채팅/구조화JSON입력·결과를 제공한다.
- fixture의 모든등록graph/schema·JSON문법/유효성·오류·전환격리검증, 실제대표일반chat·TA·boundednonchat검증. 실제SECbulk·대량수집없음.
- history/new/cancel/BehindTheScenes/Queryrefresh와 공통레이아웃영향SECchat/pushUI를회귀검증한다. 실패/불완전실행을성공으로표시하지않는다.
- View Storybook·MCP가능시실브라우저(점유시공유브라우저종료하지않고소유CLIfallback사유기록)와적절한unit/static검증을수행한다. 서버API변경시BrunoE2E추가.

소유isolatedHost3183(`.next-chat-layout-validation`)·runtime3982·Storybook6106·브라우저만생성정리하고사용자2983서비스·공유MCP는유지한다. 구현·검증진행중이며stock은확정구현에동기화한다.

## 구현과 확인된 증거

등록 assistant를 100개 offset pagination하고 schema 실패/알 수 없는 graph도 유지한다. 현재 runtime 등록9개는 chat4(starter_graph/simple_llm/technical_analysis_agent/sec_deep_agent), JSON5(main_graph/price_agent/technical_analysis_graph/tenk_subgraph/simple_push_ui_message)로 노출된다. JSON은 입력 원문 객체를 새 thread에 전송하며 metadata run_id의 최종 runs.get success까지 확인한다. 결과 미리보기100,000자 제한과 전체 복사를 구분한다. API endpoint/schema 변경은 없다.

- 모델/API 단위16개, 최종 view20개, typecheck와 lint는 담당 에이전트 실행 PASS. view에는 populated header geometry, 입력/결과, shared send/reset/cancel이 포함된다.
- 소유 runtime3982+Host3183 실제 browser에서 등록9개를 확인했다. starter 실제 답변, TA 실제 Yahoo/TA-Lib 차트와 Query 수동 refresh, price_agent count2 실제 Yahoo OHLCV 최종 결과와 tool success/완료를 확인했다. price 결과 캡처 `.playwright-mcp/chat-layout-price-final-desktop.png`.
- 실제 price JSON stream은 end 이벤트 없이 EOF로 끝나므로 values 수신만으로 성공 판단하지 않고 runs.get success를 확인한다. 초기 중간snapshot을 최종성공 증거로 사용하지 않았다.
- `/sec-chat`와 `/examples/push-ui-message`를 전송 없이 열어 기존 welcome/header/composer가 유지됨을 확인했다. 실제 SEC 수집·bulk 요청은 하지 않았다.
- populated 상태에서 SDK absolute header가 모바일 첫 메시지를 가리는 문제를 실제 캡처로 발견했다. compact scope에서 정상 flow header로 수정했고 최종 실제 모바일 header bottom99px 아래 첫 user bubble111px, desktop header bottom72px로 확인했다.
- 최종 `.playwright-mcp/chat-layout-after-{empty,populated}-{desktop,mobile}-{light,dark}.png`는1440x1000/390x844이며 dark는 실제 Host theme 버튼으로 전환했다. 직접 DOM class 변경으로 얻은 초기 hybrid-theme/열린 sidebar 캡처는 폐기하고 동일 경로를 재캡처했다. 최종 populated browser JS예외0, 가로너비390/1440.

공유 Playwright MCP는 다른 세션이 profile을 사용 중이라고 거부했다. 공유 MCP/브라우저를 종료하지 않고 소유 CLI Chromium을 각 try/finally에서 닫아 실제 브라우저로 검증했다. fixture3984는 네트워크/모델/DB가 없는11graph 테스트 전용이며 실제9graph와 unknown/schema-error를 포함한다. fixture 통합 마지막 반복실행 검증과 자원 정리는 아직 진행 중이다.

실제 runtime에서 생성한 starter thread를 대화 기록에서 다시 열어 assistant 답변이 복원되는 것과 새 대화가 한글 welcome으로 돌아가는 것을 browser에서 확인했다. 추가 모델 호출 없이 기존 상태를 조회했다. 초기 empty screenshot도 열린 sidebar 없이 최종8개 조합으로 다시 캡처했고 모바일 light를 시각 확인했다.

## 최종 통합 결과

fixture browser E2E 3/3 PASS(26.0초): 등록11개(실제9종+unknown/schema-error)의 선택과 각 입력 모드 실행, schema 실패 안내, 잘못된 JSON 무전송, 서버 오류 표시, 진행 중 JSON 연결 중단 후 다른 graph 실행 및 지연된 과거 결과 미혼입을 검증했다. 실행 명령은 `SEC_LIVE_BASE_URL=http://127.0.0.1:3185 pnpm -C 1-fe-host test:e2e tests/e2e/chat-graphs.spec.ts --project=chromium`. HTML 보고서는 ignored `1-fe-host/playwright-report/index.html`이다.

이 반복 검증에서 SDK 기본 동시성4 queue를 native AbortError의 메시지 기반 retry가 점유하는 실제 전환 정지를 발견했다. Host fetch 경계에서 취소를 표준 AbortError 메시지로 정규화하여 재시도를 끝내며 일반 네트워크 retry는 유지한다. 실제 SDK의 취소된4요청 뒤 새 thread 생성 회귀를 포함한 단위18개 PASS, 최종 view20개 PASS, typecheck/lint PASS. fixture end/GET route 및 Markdown 표시 비교의 초기 harness 오류는 수정 후 재실행했고 최종3개 모두 통과했다.

Stock 반영: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md)의 CHAT-LAYOUT-002/CHAT-GRAPHS-001/history label, [기술적 분석 system](../stock/technical-analysis/system-design.md)의 whitelist 제거 및 입력 모드. 실제9개는 discovery를 확인했고 실제 실행은 starter/TA/price 대표만 bounded로 수행했다. 나머지 graph 실행은 fixture 증거이며 실제 SEC/DB 실행을 주장하지 않는다.

## 정리와 완료

소유3183 Host/3982 runtime/3984 fixture/6106 Storybook 및 backend 소유3185 debug Host는 종료했고 다섯 포트의 LISTEN 부재를 확인했다. 모든 소유 Chromium은 finally에서 닫혔다. `.next-chat-layout-validation`/`.next-chat-debug`와 각 자동 tsconfig include를 제거하고 next-env 참조는 기존 `.next/types/routes.d.ts`로 복원했다. 사용자2983 서비스·공유 MCP/브라우저·다른 작업 파일은 종료/수정하지 않았다. 이전 flow와 human-docs는 보존했다. 필수 검증과 정리 완료, scoped cached diff에서 package의 view script 한 줄/sidebar의 /chat trigger 분기/docs map의 새 flow 링크만 선택하고 동시 SEC modeling 변경을 제외했다.
