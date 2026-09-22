# SEC-A2UI-10: 대화 의도와 A2UI 도구 선택

- 날짜: 2026-09-22
- 범위: SEC A2UI, `3-langgraph-fast`, `1-fe-host`
- 배경: “뭐가 가능해?”까지 회사 검색어로 처리했다. LangGraph를 사용하지만 채팅의 검색/분석 분기는 코드로 고정되어 있었다.
- 결정: 모델 판단 → 서버 도구 → 모델 후속 판단 루프를 사용한다. 일반 안내는 텍스트로 끝내고 조회/선택/분석 및 Fixed/Dynamic 렌더링을 별도 도구로 제공한다. Fixed는 현재 단계의 서버 템플릿, Dynamic은 검증된 보고서 항목·순서·카드/표/접이식 구성을 선택한다. 원문 식별자와 인용은 서버가 검증한다. 버튼 action의 revision 검증과 thread 격리를 유지한다.
- stock 동기화 대상: [SEC](../stock/tech-shared/a2ui-system/sec.md), [LangGraph](../stock/tech-shared/a2ui-system/langgraph.md), [공통 설계](../stock/tech-shared/a2ui-system/a2ui-system.md), [운영](../stock/tech-shared/a2ui-system/operations-and-validation.md), [업무 범위](../stock/us-corporate-filings/a2ui-system.md).

## 검증 계획

| Given / When | Then |
| --- | --- |
| 새 대화 / “뭐가 가능해?” | 기능 설명, 회사 조회·A2UI 생성 없음 |
| 회사 목록 표시 / 도움말 질문 | 기존 회사·surface·revision 보존, 새 검색 없음 |
| 새 대화 / “쿠팡(CPNG) 찾아줘” | 검색 도구와 Fixed 화면 도구, 실제 CPNG 결과 |
| 회사 조회 후 / 공시 조회·선택 | 실제 조회 결과의 식별자만 허용 |
| 선택 공시 / “위험 요인만 표로” | 분석·Dynamic 도구, 해당 항목과 실제 인용 표시 |
| 선택 공시 / 도움말 또는 회사 변경 | 무조건 분석하지 않음; 새 회사 검색은 이전 선택 초기화 |
| 결과 있음 / 검색 결과 없음 / 다시 검색 | 빈 결과와 이전 회사 표가 섞이지 않음 |
| 오래된 action / 잘못된 식별자 / 상위 실패 | 거절 및 상태 보존, 복구 가능 |

VAL-API-001: 기존 Bruno 컬렉션에 에이전트 시나리오 추가 후 실제 HTTP 실행.
VAL-BROWSER-001: Playwright MCP에서 `http://localhost:2820/a2ui/sec`의 실제 OAuth/BFF 연동 검증 및 회귀 spec 실행.
순수 화면 전환 변경 시 Storybook도 검증한다. 실행 결과는 후속 항목에 기록한다.

## 자원 소유

기존 사용자 확인용 서비스: Next.js 2820(PID 3547), FastAPI 8000(reloader 559/worker 568), BFF 2801(PID 581), DB와 OAuth 프록시. 변경 후에도 유지한다. Playwright MCP는 공유 도구 서버이며 최초 탭은 about:blank였다. 이번 작업의 격리 브라우저는 검증 후 browser_close로 종료하고 프로세스를 확인한다. 임시 검증 서버/프로필을 추가하면 PID와 종료 결과를 별도 기록한다.


## 구현 및 1차 검증

- `workflow.py`: 강제 검색/분석 분기를 제거하고 모델의 실제 tool_calls를 실행하는 agent/ToolNode 루프로 교체.
- `agent_tools.py`: 조회/선택/분석과 Fixed/Dynamic 렌더링 6개 도구. 렌더링 검증 후 상태를 함께 반영하며 취소된 미완성 호출을 다음 모델 입력에서 제외.
- 검색 회사 표와 빈 결과에 서로 다른 ID를 부여. 기존 A2UI renderer가 같은 ID의 컴포넌트 속성을 합치는 상황에서도 이전 표가 남지 않도록 수정.
- UI 안내와 채팅 placeholder를 일반 질문·회사 검색·분석 요청에 맞게 갱신.
- 실제 서비스 첫 브라우저 시도는 모델 환경 변수가 없는 기존 FastAPI 실행 때문에 실패했다. `.env`를 읽는 문서의 uvicorn 명령으로8000을 재시작한 뒤 도움말과 CPNG 검색이 통과했다. 기존2820과2801은 유지.
- 단위/회귀: SEC27개 PASS. 초기 전체 Python182 PASS/13 SKIP(옵트인 검증). 상태 반영/취소 보강 후 추가 전체 실행 결과는 아래 최종 증거에 기록.
- Storybook: 검색 있음→없음→복구 전환을 포함하여85 PASS. 새 story의 테스트 타입 인자에서 발견한 `exact`를 제거했으며 최종 재검증 예정.
- Bruno16-sec-agent: 실제 OAuth 모델 및 BFF8000→2801, 7요청/7테스트/7assertion PASS(47.392초). 도움말 도구0개, 검색 `search_companies → render_fixed_ui`, 공시 목록 `list_filings → render_fixed_ui`, 도움말 시 상태/화면 보존, 빈 검색/복구 검증.
- 정적 검사: FE lint 및 타입검사 PASS. Python 변경 범위 lint PASS. 전체 lint48개 기존 오류와 전체 타입검사의 기존 preview 테스트 오류는 변경 범위와 분리해 최종 기록한다.
- 증거: `3-langgraph-fast/bruno-api-tests/reports/2026-09-22-sec-agent.{log,json}`. 런타임 보고서는 Git 제외 대상으로 추가했다.

## 실서비스 API 및 MCP 브라우저 증거

- 기존 SEC Bruno14: 13요청/13테스트/13assertion PASS, 227.754초. 실제 Apple 원문 `0000320193-25-000079`의 전체 보고서, 요약 카드, 위험 표 및 stale/cross-thread/과대 입력/숨겨진 action 거절 검증.
- 위험 표의 실제 SSE 도구: `analyze_filing → ReportPlan → FilingReport`(인용 검증 재시도1회) `→ render_dynamic_ui`. 서버 보고서 계획은 `risks/table` 한 항목이었다.
- Playwright MCP URL: `http://localhost:2820/a2ui/sec`, 실제 BFF2801, FastAPI8000, OAuth2890/gpt-5.6-luna.
- 새 대화에서 “뭐가 가능해?”: 기능 설명만 표시하고 회사 검색 UI 없음.
- “쿠팡(CPNG)의 원문이 저장된 10-K 공시 목록을 보여줘”: `search_companies → list_filings → render_fixed_ui`, 실제 쿠팡10-K5건 표시.
- 버튼으로 `0001834584-26-000024` 선택 후 “이제 뭐가 가능해?”: 도구0개, fieldset 내용과 선택 그대로 보존.
- “선택한 공시의 위험 요인만 표로 보여줘”: `analyze_filing → ReportPlan → FilingReport → render_dynamic_ui`; 위험 요인 표와 실제 인용 E1/E3/E7/E12 표시. 문서 정규화449,892자 중24,000자 발췌 및 SHA-256 표시.
- 보고서 후 “다시 CPNG 회사만 찾아줘”: 검색/Fixed 도구 호출, 보고서·공시 선택 초기화.
- 화면 검색 버튼으로 `NO_MATCH_SEC_AGENT_20260922` → CPNG: 빈 결과에서 이전 표/공시 선택 버튼 없음, 복구 후 현재 surface에 빈 결과 문구 없음.
- 최종 위7개 흐름의 HTTP200/RUN_FINISHED 및 RUN_ERROR0 확인. 브라우저 console error0. 개발 모드 Lit, CopilotKit의 비표시 도구 renderer/메시지 ID 병합 경고는 남아 있으나 A2UI activity 렌더링과 사용 동작은 통과했다. 중간 SDK 송신 버튼 활성화 전 Enter로 입력이 남아 타임아웃한 탐색은 실제 송신 버튼으로 재실행했다. 자동화 spec은 MCP에서 확인한 `copilot-send-button`을 사용한다.
- [실제 쿠팡 위험 표 스크린샷](evidence/2026-09-22-sec-agent/mcp-risk-table.png).
- MCP 격리 Chrome PID5323 / 부모99635 / 임시 profile `playwright_chromiumdev_profile-imqh09`: `browser_close` 후 PID와 profile 제거 확인. 공유 MCP 서버99635는 유지. 이후 별도 Playwright CLI 회귀를 순차 실행.

## 후속 출력 정책 및 최종 회귀

사용자가 과거 채팅 UI의 자동 갱신을 원하지 않고 별도 Canvas를 요청하여 [SEC-A2UI-11 후속 기록](2026-09-22-sec-inline-canvas.md)에서 정책을 변경했다. 최종 구현은 Inline render마다 새 surface를 만들며, Canvas만 동일 ID를 재사용한다. 두 흐름은 본 기록의 같은 SEC agent와 도구를 공유한다. 앞의 단일 surface 표현은 초기 단계 증거이며 현재 상태는 후속 기록과 Stock을 따른다.

에이전트 작업의 최종 회귀는 Python192 PASS/13 opt-in SKIP, Storybook86 PASS, 카탈로그 계약69 PASS, Bruno16의12요청 PASS, 실제2820 Playwright4 PASS다. 기존14-sec-a2ui의13요청 검증은 본 작업 초기 단계의 증거로 구분한다. 실제 공시 분석/인용의 최종 브라우저 회귀도 통과했다. 상세 실행·오류 복구·자원 정리는 위 후속 기록에 연결한다.
