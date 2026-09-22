# SEC Inline / Canvas 출력 수명 분리

날짜: 2026-09-22. 범위: SEC-A2UI-11, FE host / LangGraph SEC.

## 변경 전 결정

사용자가 기존 채팅 메시지의 UI까지 바뀌는 기본 동작을 거부하고, 채팅 이력과 고정 Canvas 두 흐름을 하나의 LangGraph로 관리하도록 요청했다. [SEC 도구 작업](2026-09-22-sec-agent-tools.md)을 이어서 수행한다.

- Fixed/Dynamic은 UI 구성 방식, Inline/Canvas는 출력 위치와 surface 수명이다. 동일 graph와 분석/조회 도구를 재사용한다.
- 기본 Inline: 각 render 도구 호출은 새 서버 발급 surfaceId와 createSurface를 반환한다. 이전 메시지는 보존한다. 최신 Inline 화면의 버튼은 그 surface를 갱신한다. 지난 Inline 화면은 읽기 전용이며 서버도 action을 거절한다.
- Canvas: 대화 내 하나의 서버 발급 ID를 재사용한다. 채팅 메시지에는 화면을 중복 마운트하지 않고 별도 고정 영역에서 갱신한다. 사용자가 출력 위치를 전환해도 기존 Canvas는 남는다.
- 요청의 `a2uiOutputTarget`은 inline/canvas enum만 허용한다. 임의 surfaceId를 클라이언트가 지정하지 않는다. 버튼 action은 화면 ID의 저장 상태/위치를 사용하여 현재 출력 선택값과 무관하게 해당 화면을 갱신한다.
- 공유 대화 SEC context 외에 최신 Inline / Canvas별 SEC snapshot을 보존한다. Canvas 버튼은 나중의 Inline 조회와 섞이지 않도록 자신의 context에서 실행한다. 마지막으로 사용한 화면/채팅 결과가 다음 자연어 요청의 context가 된다.
- 모든 surface의 이벤트는 첫 실행 전 마운트한 상위 구독자가 받아 전달한다. 실행 도중 마운트한 activity 컴포넌트의 구독은 SDK가 실행 시작 시 캡처한 구독자 목록에 포함되지 않아 동일 실행 후속 render를 놓칠 수 있다.

## 검증 계획

1. 서버 fixture: Inline 두 render는 다른 ID, Canvas 연속 render는 같은 ID; 위치 전환/버튼 context/오래된 Inline action/잘못된 target 검증.
2. Storybook: 실행 전에 등록한 구독으로 늦게 마운트한 surface 갱신, Inline 이전 데이터 보존, Canvas 중복 없음.
3. Bruno: 실제 HTTP로 Inline 새 ID, Canvas 재사용, 두 출력 상태 격리 및 invalid enum 422.
4. 실제 2820 MCP/Playwright: 새 질문마다 Inline 추가, 기존 UI 보존, Canvas 조회/변경/다시 Inline, 도움말 무도구와 실제 인용 보고서 회귀.
5. 작업 소유 브라우저와 테스트 프로세스 정리. 사용자 서비스 2820/2801/8000 유지.

## 갱신할 Stock

[SEC](../stock/tech-shared/a2ui-system/sec.md), [FE](../stock/tech-shared/a2ui-system/frontend.md), [LangGraph](../stock/tech-shared/a2ui-system/langgraph.md), [운영/검증](../stock/tech-shared/a2ui-system/operations-and-validation.md), [업무 A2UI](../stock/us-corporate-filings/a2ui-system.md).

구현 및 실행 증거는 아래에 추가한다.

## 구현 및 실행 결과

- `agent_tools.surface_update`: Inline마다 새 createSurface, Canvas 동일 ID update; 활성 Inline/Canvas 두 개의 server context만 보존.
- `workflow` action 경로: 발신 surface의 SEC context에서 실행. 자연어 agent/ToolNode 루프와 분석/인용 파이프라인은 두 출력이 공유.
- `router.prepare_input`: `a2uiOutputTarget` enum을 검증하고 클라이언트 state 대신 checkpoint 기반 값을 사용.
- `SurfaceStreamProvider`: 실행 시작 전의 상위 구독으로 후속 도구 이벤트를 수집. toolCallId로 tool/activity 중복을 제거하고 기존 화면에 순서대로 반영.
- `OutputWorkspace`: 기본 Inline과 독립 Canvas 영역. 과거 Inline read-only, Canvas activity의 채팅 중복 렌더링 방지. 새 대화는 두 화면과 선택 초기화.

| 검증 | 실행 증거 | 결과 |
| --- | --- | --- |
| Python 전체 | `pnpm --filter reason-hwang-langgraph-fast test` | 192 PASS / 13 opt-in SKIP, 4.42초 |
| 출력 수명 단위/graph/입력 검증 | `uv run pytest tests/test_sec_output_targets.py -q` | 7 PASS (최종 타입 수정 후 재검증) |
| 변경 Python 정적 검사 | ruff + pyright, SEC graph/router/관련 tests 8파일 | PASS, 0오류 |
| Frontend 정적 검사 | FE `typecheck`, `lint` | PASS |
| 카탈로그/계약 | `pnpm a2ui:check`, FE `test:a2ui` | 61source/66adapter/4catalog, 69 PASS |
| Storybook | FE `test:a2ui:views` | 9파일 / 86 PASS, 최종 순차 실행9.88초 |
| Bruno 실제 HTTP | `pnpm --filter reason-hwang-langgraph-fast test:sec-agent:api` | 12요청/12테스트/12assertion PASS,81.612초 |
| 2820 실제 브라우저 CLI | `pnpm --filter reason-hwang-fe-host test:e2e:sec-agent` | 4 PASS,1.9분, 실제 OAuth/BFF/저장 원문 |
| Playwright MCP | 아래 사용자 관점 검증 | PASS |

브라우저 CLI 4시나리오: 무도구 도움말/검색, 빈 검색→복구 버튼, 공시 선택→도움말→실제 인용 위험 표, 같은 실행 두 render의 Inline 이력→Canvas 순차 갱신→AAPL Inline→CPNG Canvas 버튼→MSFT Canvas 갱신→새 대화 초기화. 마지막 시나리오에서 출력 선택값이 Inline이어도 Canvas 버튼은 기존 CPNG 공시를 선택했고 AAPL 결과는 바뀌지 않았다.

MCP 최종 실행(2820): Canvas에서 `search_companies → render_fixed_ui → list_filings → render_fixed_ui`, 쿠팡 저장10-K5건. Inline으로 전환해 AAPL 검색 후 Canvas의 쿠팡 공시 선택 버튼 실행. `sec-canvas-ed1c799d1a544aa28b9e04441b44ff3d` 유지, Canvas 선택은 `0001834584-26-000024`, Inline 회사는 Apple Inc. 유지, RUN_ERROR0/브라우저 console error0. 공유 렌더러 회귀로 `/a2ui/fixed`에서 ICN→NRT 화면 생성 후 항공편 선택 버튼이 같은 화면을 “선택 완료”로 갱신함을 확인했다.

스크린샷: [Inline/Canvas viewport](evidence/2026-09-22-sec-agent/mcp-inline-canvas.png), [이력 보존 전체 화면](evidence/2026-09-22-sec-agent/sec-inline-canvas.png), [최종 실제 위험 표](evidence/2026-09-22-sec-agent/sec-dynamic-risk-table.png). 실행 로그는 Git 제외 `3-langgraph-fast/bruno-api-tests/reports/2026-09-22-inline-canvas-{e2e,bruno,storybook}.log`에 보관했다.

## 발견과 복구

- 최초 renderer는 실행 도중 화면이 마운트되면 같은 실행의 후속 ToolMessage를 놓쳤다. 상위 journal 구독으로 고쳤으며 실제 두 render와 late-mount Storybook으로 재현/해결 검증했다.
- Storybook 첫 실행은 새 `@ag-ui/client` Vite 의존성 최적화 재시작으로 실패/대기했다. 작업 소유 테스트를 정상 중지하고 재실행했으며 이후86/86 통과. 최종 실행은 API/CLI 종료 후 단독 순차 검증했다.
- MCP 탐색 중 Python 테스트 파일 저장이 uvicorn reload를 유발하여 InMemorySaver가 초기화됐다. 기존 Canvas action422를 받았으며 새 대화로 재실행한 최종 MCP에서 같은 요청이 통과했다. 프로세스 재시작 복구는 기존 데모 범위 밖이며 Stock에 명시했다.
- 기존 전체 Python lint48개 오류와 preview 테스트 pyright3개 오류는 별도 기존 이슈다. 변경한8파일의 ruff/pyright는 통과했으며 관련 없는 파일은 수정하지 않았다. SDK 개발 경고와 telemetry/번들 경고는 오류와 구분한다.

## 검증 자원 정리

- MCP Chrome PID9478 / 부모99635, 자식9491/9492/9493/9498/9499/9500, profile `playwright_chromiumdev_profile-vWhnN3`를 기록했다. 공식 `browser_close` 후 위 PID 전부 종료와 profile 디렉터리 삭제를 확인했다. 공유 MCP99635는 유지.
- 중지된 초기 Storybook10886과 CLI11029 잔존 없음. 후속 Storybook/CLI는 정상 종료했다. 기존 다른 프로젝트의 Playwright test-server6962는 건드리지 않았다.
- 사용자 서비스 Next2820 PID3547, BFF2801 PID581, FastAPI8000 reloader5942/worker11729 리스닝 유지. 기존18083/DB/OAuth 및 사용자 브라우저는 유지.
- 최종 frontend production build PASS: `NEXT_DIST_DIR=.next-sec-validation pnpm --filter reason-hwang-fe-host build`. 사용자 `.next`와 분리된 빌드 출력만 사용했다. 빌드가 자동 추가한 tsconfig include/format 변경을 원래 내용으로 복원하고 소유한 `.next-sec-validation` 디렉터리를 삭제했다. build 종료0, 생성 출력 잔존 없음.

최종 판정: SEC-A2UI-10/11의 이번 범위 구현·필수 API/View/사용자 브라우저 검증과 검증 자원 정리 완료. 현재 상태를 관련 Stock 및 문서 맵에 동기화했다.
