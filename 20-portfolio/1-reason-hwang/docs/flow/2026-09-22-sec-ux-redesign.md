# SEC 조회 흐름 UX 재설계

날짜: 2026-09-22. 요구사항: SEC-A2UI-12. 사용자가 UX Review agent의 독립 리뷰와 재설계, 실제2820 브라우저 검증을 요청했다. [독립 리뷰](2026-09-22-sec-ux-review.md)를 병행한다.

## 변경 전 관찰과 설계

실제2820 첫 화면에는 출력 위치 선택과 비어 있는 Canvas가 먼저 노출되어 기본 Inline 채팅의 폭을 절반으로 줄였다. CPNG 조회 후에는 회사 표/드롭다운/제출이 중복되었다. 회사 선택 후75개 전체 공시의 첫 페이지가 나타났고10-K는9번째였다. 사용자는 긴 접수번호를 읽고 같은 공시를 드롭다운에서 다시 찾아야 했다.

1. 기본 Inline은 넓은 단일 열. Canvas는 선택했거나 이미 결과가 있을 때만 표시. 출력 위치는 “다음 답변”의 정책으로 명시하며 이미 열린 결과의 위치를 바꾸지 않는다.
2. 최초 화면은 회사 찾기 시작 버튼과 짧은3단계 안내. 일반 질문도 기존 agent로 보낸다. 검색을 강제하는 별도 채팅 라우팅은 만들지 않는다.
3. 회사/공시 결과 각각에 직접 선택 버튼. 중복 Table+Select 제거. 결과 이름/기간/날짜를 버튼과 연결하고 기술 식별자는 상세로 이동.
4. 공시 탐색은 기본 분석 가능한 연간보고서. 연간/분기/전체 바로가기와 명시적 현재 조건; 추가 조건은 접을 수 있는 영역에 유지. 원본/수정본 구분, 저장 안 된 공시의 선택/분석 불가 안내 보존.
5. 선택 후 문서명/보고기간/제출일을 먼저 표시. “핵심 요약”, “위험 요인”, “전체 분석” 바로가기와 자유 요청. 보고서가 생기면 결과를 먼저, 재분석/문서 변경은 아래로 배치. 출처·원문 인용은 유지하고 긴 출처 식별값은 상세로 접는다.
6. 이전 Inline 결과는 제목으로 접어 이력을 보존하고 열어 읽을 수 있게 한다. 최신 결과와 Canvas만 작업 가능. 진행 상태는 한 줄로 보여주며 내부 단계 반복 나열 제거(SEC만).
7. 기존 한 graph, 모델 도구 선택, Inline 새 ID/Canvas 고정 ID 및 서버 action 검증을 보존한다. 도구 계약에 필요한 목록 기본조건만 명시적으로 변경한다.

## 검증 계획

- 회사 시작 → 직접 선택 → 연간보고서 선택 → 핵심 요약/위험 분석, 실제 출처/인용 표시.
- 기능 질문은 검색0회, 빈 검색 복구, 다른 회사로 변경, 분기/전체/추가 필터, 저장 안 된 문서 안내.
- Inline 새 결과/과거 펼침, Canvas 열림·같은ID 갱신·독립 선택, 새 대화 초기화.
- 390px 모바일과 데스크톱에서 주 행동 노출/가로 넘침 확인.
- Python graph/직접 action fixture, catalog검증, Bruno HTTP, Storybook, Playwright MCP 실서비스+CLI 회귀를 순차 검증한다.

## 자원 소유

사용자 Next2820 PID3547, BFF2801 PID581, FastAPI8000 reloader5942/worker11729를 유지한다. 공유 Playwright MCP 서버와 사용자 브라우저는 종료하지 않는다. 이번 작업 브라우저/테스트 산출물 정리 결과는 아래에 추가한다.

## 구현 및 리뷰 반영

회사/공시 표+Select를 직접 action 카드로 바꾸고 저장된 연간보고서를 기본 조회한다. 현재 필터와 결과 건수, 연간/분기/전체 전환과 추가 조건을 제공한다. 분석 바로가기와 직접 요청, 보고서 우선 배치, 접힌 출처 상세를 구현했다. 신규 어댑터 없이 기존 Collapsible을 SEC 카탈로그에 허용하고 생성물을 동기화했다. 채팅은 기존 에이전트/도구 경로를 유지한다.

기본 Inline 단일 열, 조건부 Canvas, 읽기 전용 이력 접기, 회사 시작 버튼, SEC 한 줄 진행 상태를 구현했다. 늦게 마운트된 surface가 실행 종료를 놓쳐 비활성 상태에 머무르는 문제는 상위 구독자의 running context로 수정했다.

독립 리뷰 R1~R3에 따라 보고서 위 공시 종류/보고기간/제출일을 유지하고, 버튼 완료 텍스트를 과거형으로 바꾸며, Canvas 제목을 최신 전체 스냅샷에서 계산했다. R4 추가 검토에서 과거 fieldset의 전체 비활성화가 출처 펼침을 막음을 발견했다. SEC read-only context로 업무 Button/Input/Select만 잠그고 열람용 Accordion/Collapsible을 허용했다. 과거 action의 클라이언트 가드와 서버 검증은 유지한다. Storybook은 실제 SEC fixture의 접힌 이력을 펼쳐 문서 상세를 읽고 업무 입력/버튼이 잠긴 상태임을 검사한다.

## 검증 중간 결과

- Python 전체195 PASS / opt-in13 SKIP. 변경7파일 ruff/pyright PASS. pyright의 formType 추론 오류는 문자열 정규화로 수정했다.
- Storybook10파일94 PASS(과거 상세 펼침 회귀 포함). 계약/제목70 PASS, 카탈로그61소스/66어댑터/4카탈로그 drift 없음.
- 실제 FastAPI8000+BFF2801+OAuth2890: 신규 Bruno17 SEC UX8요청/8테스트/8assertion PASS(33.809초), 기존 Bruno16 에이전트12/12/12 PASS(80.589초). 직접 선택·기본 필터·전체 범위 전환·분석 바로가기·고정 요청 변조422 검증.
- 검증에서 fixture의 오래된 Table 기대/필터 query 키/숨김 DOM 판정을 실제 계약에 맞게 수정했다. 실패와 수정 후 재실행을 구분하며 최종 브라우저/빌드 결과는 아래에 기록한다.

추가 확인: 정적 검사 후 변경된 surface 문자열 정규화에 대해 UX 단위3개를 다시 실행해 PASS했다. Ruff는 패키지 기본 실행환경에 설치되어 있지 않아 단순 `uv run ruff`가 실행되지 않았고, 기존 방식인 `uv run --with ruff ruff check`로 변경7파일 PASS를 확인했다. FE typecheck/lint도 read-only 수정 후 PASS했다. 이 검증은 변경 범위 Python 정적 검사이며 기존 전체 프로젝트 lint 오류를 해결했다는 의미가 아니다.

## 모바일 검증에서 발견한 초기 연결 경합

첫 live E2E는 데스크톱4 PASS, 모바일1 FAIL이었다. 모바일에서 빠른 시작의 SSE는 성공했으나 화면은 환영 상태에 남아 CPNG 선택 버튼이 나타나지 않았다. MCP에서 연결 후 동일 버튼은 정상 동작했다. 설치된 SDK `useAgent` 구현에서 런타임 연결 전 호출자별 provisional agent를 제공하고 `isReady=false`를 반환함을 확인했다. 빠른 시작이 이 임시 agent에 메시지를 보낸 것이 원인이므로 `isReady`까지 버튼 비활성화/실행 가드에 포함했다. 임의 대기 시간을 테스트에 추가하지 않는다. 모바일 회귀는 SSE 완료뿐 아니라 결과 버튼이 활성화되었는지 명시적으로 확인한다. 재검증 결과는 아래에 기록한다.

## MCP 실서비스 확인

수정 후 모바일 CLI 단독 재검증1 PASS(38.8초). Playwright MCP는 실제2820에서 아래를 순서대로 직접 조작했다.

| 시나리오 | 확인 결과 |
| --- | --- |
| 초기 단일 열 | 빈 Canvas 없음, 세 단계 안내/회사 시작/일반 질문 입력 |
| 키보드 회사 시작 | 쿠팡 버튼에 focus+Enter → 실제 search_companies/render_fixed_ui 및 결과 표시 |
| 직접 회사/공시 선택 | 저장된10-K 5건 →2026-02-26 공시 버튼 focus+Enter →보고기간2025-12-31 확인 |
| 직접 요청 펼침 | Collapsible focus+Enter →레이블이 연결된 분석 입력 표시 |
| 실제 핵심 요약 | 저장 CPNG 원문에서 카드 보고서 생성, RUN_FINISHED 및 RUN_ERROR 없음 |
| 출처 키보드 열람 | Accordion focus+Enter →CIK/접수번호/조회시각/SHA-256/분석범위 표시 |
| 모바일 보고서 |390×844, scrollWidth=390/innerWidth=390, 페이지 가로 넘침 없음 |

MCP 최종 navigation 콘솔 오류0개. SDK 개발 경고30개(중복 message ID 병합 및 일반 tool renderer 미등록)는 남으며 실제 A2UI activity 표시/후속 갱신은 위와 CLI에서 확인했다. OAuth 모델과 저장 BFF 원문을 사용했고 API-key 제공자 검증이나 새 SEC 다운로드는 실행하지 않았다.

화면 증거: [시작](evidence/2026-09-22-sec-ux/mcp-start.png), [직접 공시 선택](evidence/2026-09-22-sec-ux/mcp-filings.png), [분석 선택](evidence/2026-09-22-sec-ux/mcp-analysis-choices.png), [실제 요약/출처](evidence/2026-09-22-sec-ux/mcp-summary-source.png), [모바일 요약](evidence/2026-09-22-sec-ux/mcp-mobile-summary.png), [위험 보고서](evidence/2026-09-22-sec-ux/sec-ux-risk-report.png), [Inline/Canvas](evidence/2026-09-22-sec-ux/sec-ux-inline-canvas.png), [모바일 필터 복구 후](evidence/2026-09-22-sec-ux/sec-ux-mobile.png).

독립 UX agent는 소스와 최종 데스크톱/Canvas/모바일 캡처를 재리뷰해 추가 차단 문제 없음을 기록했다. 반복 필터 조작의 완료 문장이 세로로 누적되는 것은 비차단 후속 개선점으로 남긴다.

MCP `browser_close` 후 owned Chrome PID12681 및 자식12692/12693/12702/12703 부재, 임시 profile `playwright_chromiumdev_profile-BwgYyJ` 삭제 확인. 공유 MCP 서버나 사용자 브라우저는 종료하지 않았다. 최종 CLI와 빌드 정리는 아래에 추가한다.

## 최종 브라우저 회귀

`pnpm --filter reason-hwang-fe-host test:e2e:sec-agent` 전체 재실행5 PASS(2.2분). 일반 안내/회사 선택21.3초, 빈 검색 복구9.3초, 위험 분석/표현 변경/과거 출처43.2초, Inline/Canvas/새 대화46.8초, 모바일 빠른 시작/필터 복구12.8초. 모바일 초기 실패를 숨기지 않고 위 원인/수정 및 재실행과 함께 기록한다. [최종 CLI 로그](evidence/2026-09-22-sec-ux/playwright-final.txt). HTML 보고서는 로컬 `1-fe-host/playwright-report/index.html`에 생성되었으며 실행 결과 JSON/스크린샷은 `1-fe-host/test-results/`에 있다. 재현 가능한 핵심 화면은 위 evidence에 보존한다.

API 로그: [새 UX8요청](evidence/2026-09-22-sec-ux/bruno-ux.txt), [에이전트12요청](evidence/2026-09-22-sec-ux/bruno-agent.txt). 명령은 `test:sec-ux:api`, `test:sec-agent:api`를 reason-hwang-langgraph-fast filter로 실행했다. 전체 Python은 `pnpm --filter reason-hwang-langgraph-fast test`, Storybook은 `pnpm --filter reason-hwang-fe-host test:a2ui:views`, 계약/제목은 `test:a2ui`와 `pnpm a2ui:check`로 검증했다.

## 최종 판정과 정리

| 검증 | 최종 결과 |
| --- | --- |
| 독립 UX 리뷰 | 초기 진단, R1~R4 수정, 데스크톱/Canvas/모바일 최종 캡처 검토 완료 |
| 실서비스 API | 신규8/8 + 기존12/12 PASS |
| 실서비스 Playwright | 최종5/5 PASS, MCP 직접 조작/키보드/보고서/출처 PASS |
| Storybook |94/94 PASS |
| 프런트 계약/제목 |70/70 PASS, 카탈로그 drift 없음 |
| Python |195 PASS /13 opt-in SKIP, 최종 문자열 정규화 후 UX3개 재검증 PASS |
| 정적 검사 |FE typecheck/lint PASS, Python 변경7파일 ruff/pyright PASS |
| 생산 빌드 |별도 `.next-sec-ux-validation`로 PASS,16페이지 생성 및 타입 확인 |
| 문서 |SEC/Host/LangGraph/카탈로그/운영/수용/도메인 stock 및 INDEX 동기화, 변경 Markdown 상대 링크 검사 PASS |
| 정리 |작업 브라우저/CLI/빌드 프로세스 종료, 임시 profile/build 제거, 사용자 서비스 유지 |

[정적·단위·View 검사 로그](evidence/2026-09-22-sec-ux/checks.txt), [빌드 로그](evidence/2026-09-22-sec-ux/build.txt), [초기 실패 원본](evidence/2026-09-22-sec-ux/playwright-initial-failure.txt). 빌드의 기존 AI SDK 동적 dependency 경고 및 여러 lockfile 경고는 남지만 build는0으로 종료했다. 전체 Python 기존 lint 문제 및 API-key 미검증은 이 작업에서 해소했다고 주장하지 않는다.

빌드가 추가한 tsconfig/next-env 임시 경로는 작업 전 사본과 비교해 원복했고 두 파일 git diff가 없음을 확인했다. `.next-sec-ux-validation`을 제거했다. 브라우저PID12681과 자식, 최종 CLI worker17577/모바일17103, build17989는 부재다. 공유 MCP99635는 유지했다. 사용자 Next2820 PID3547, BFF2801 PID581, FastAPI8000 reloader5942/worker15463, OAuth2890 listener가 유지됨을 재확인했고 정리 후 SEC URL HTTP200을 확인했다. 로컬 HTML/test-results는 검증 보고서로 남기며 커밋하지 않는다.

SEC-A2UI-12의 요청 범위 구현·재설계·필수 검증 및 자원 정리를 완료했다. 추가 기능인 여러 Canvas, 대화 영구 저장, SEC 신규 수집은 추가하지 않았다.
