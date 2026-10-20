# SEC Intelligent UI 구현 및 실제 10개 기업 검증

- 날짜: 2026-10-21 (Asia/Seoul)
- 범위: us-corporate-filings / 1-fe-host / 3-langgraph-fast / 기존 BFF 조회 옵션
- 요구사항: SEC-IUI-001~003, VAL-API-001, VAL-VIEW-001, VAL-BROWSER-001, VAL-CLEANUP-001
- 결정: A2UI를 새 기능에 사용하지 않는다. OpenUI가 화면을 렌더링하고 AG-UI SSE가 검증된 프로그램을 전달한다.

## 구현과 원본 경계

6-2의 SEC 문서·근거 경계와 6-3의 Intelligent UI를 참고했다. 6-3의 컴포넌트/함수/스타일 카탈로그는 `1-fe-host/src/features/sec-chat/intelligent-ui/`에 복사했으며 형제 프로젝트 런타임 의존성은 없다. 회사 선택·동기화·채팅·전송·근거 검증·LangGraph는 새 구현이다. 모델이 구조화된 소제목/요약/근거 ID를 만들고 서버가 OpenUI 프로그램을 조합한다. 모델이 임의 DSL 레이아웃을 설계하는 구현은 아니다.

Python StateGraph는 의도 해석 → Item 근거 선택 → 답변/인용 검증을 수행한다. 후속 질문에 직전 답변과 질문을 전달한다. 원문 구절 ID를 모델이 선택하면 서버가 인용을 복원하고 같은 Item의 원문과 대조한다. 프런트는 현재 OpenUI 카탈로그로 parser 오류·미해결 참조를 확인한 뒤 렌더링한다. 정상 종료 없는 SSE, 잘못된 공시, 저장 문서의 미확인 최신성을 성공으로 표시하지 않는다.

## 발견과 수정

- OpenUI의 Zod 4 요구사항 때문에 기존 A2UI 계약은 Zod 3 별칭으로 보존했다. 기존 A2UI 카탈로그/생성 결과는 변경하지 않았다. 신규 SEC UI에는 A2UI import가 없다.
- Microsoft의 반복 Item 페이지 머리글이 본문을 잘라내는 문제를 수정했다.
- META 정확한 티커가 이름 검색의 Metals 회사들에 가려지는 문제를 수정했다.
- 모델이 인용문을 조금 바꾸어 검증에 실패하던 경로를 원문 evidence_id 선택 방식으로 변경했다.
- NVIDIA Item 8은 실제 연결재무제표가 Item 15에 있다. JPMorgan Item 7·8은 같은 파일의 인쇄 페이지를 참조한다. XOM은 별도 Financial Section을 참조한다. 이 참조 본문을 포함하도록 수정했다. 렌더링 성공만으로는 실적/재무 답변의 충분성을 입증하지 못하므로 최종 E2E에 기간·수치·단위 검사도 추가했다.
- XOM의 새 법인 CIK 0002115436은 자체 10-K가 없었다. [SEC의 2026년 2분기 공시](https://www.sec.gov/Archives/edgar/data/34088/000003408826000093/xom-20260630.htm)로 확인한 이전 법인 0000034088의 최신 10-K를 연결한다. 실제 원문 CIK/접수번호와 법인 재편 설명을 답변에 표시한다. 새 법인 자체 10-K가 생기면 우선한다.
- BFF의 기존 ticker 기본 조회 범위를 보존하면서 `includeFormerRegistrants=true` + 명시적 CIK로 과거 법인 공시를 조회하도록 했다. CIK 없는 옵션 요청은 400이다. 스키마·migration·기존 원문은 변경하지 않았다.
- Chromium CDP가 긴 SSE body를 회수하지 못하는 테스트 수집 오류는 실제 fetch 응답의 clone을 읽어 해결했다. 테스트가 응답이나 모델을 가짜로 대체하지 않는다.

## 실제 기업별 증거

환경: 작업 소유 FE production 12800, LangGraph 18000, BFF 2801. 사용자 Docker의 PostgreSQL/Neo4j 및 OAuth proxy 2890을 사용했다. 실제 provider는 `gpt-5.6-luna`였다. 최신 다운로드 버튼은 기존 SEC 수집 SSE completed와 실패 0건을 확인하고 최신 10-K의 실제 저장 본문을 읽는다. 아래 확인 시각은 UTC다.

| 기업 | 실제 CIK | 최신 10-K 접수번호 | 보고 기간 / 제출일 | SEC 확인 시각 (UTC) | 결과 |
| --- | --- | --- | --- | --- | --- |
| AAPL | 0000320193 | 0000320193-25-000079 | 2025-09-27 / 2025-10-31 | 2026-10-20T17:31:56.708445+00:00 | 7/7 PASS |
| MSFT | 0000789019 | 0001193125-26-323660 | 2026-06-30 / 2026-07-29 | 2026-10-20T17:31:56.538403+00:00 | 7/7 PASS |
| NVDA | 0001045810 | 0001045810-26-000021 | 2026-01-25 / 2026-02-25 | 2026-10-20T17:31:56.996268+00:00 | 7/7 PASS |
| AMZN | 0001018724 | 0001018724-26-000004 | 2025-12-31 / 2026-02-06 | 2026-10-20T17:33:54.324839+00:00 | 7/7 PASS |
| GOOGL | 0001652044 | 0001652044-26-000018 | 2025-12-31 / 2026-02-05 | 2026-10-20T17:34:04.240241+00:00 | 7/7 PASS |
| META | 0001326801 | 0001628280-26-003942 | 2025-12-31 / 2026-01-29 | 2026-10-20T17:34:08.209611+00:00 | 7/7 PASS |
| TSLA | 0001318605 | 0001628280-26-003952 | 2025-12-31 / 2026-01-29 | 2026-10-20T17:35:53.328068+00:00 | 7/7 PASS |
| JPM | 0000019617 | 0001628280-26-008131 | 2025-12-31 / 2026-02-13 | 2026-10-20T17:44:36.617635+00:00 | 7/7 PASS |
| WMT | 0000104169 | 0000104169-26-000055 | 2026-01-31 / 2026-03-13 | 2026-10-20T17:36:38.424566+00:00 | 7/7 PASS |
| XOM | 0000034088 | 0000034088-26-000045 | 2025-12-31 / 2026-02-18 | 2026-10-20T17:38:09.517320+00:00 | 7/7 PASS |

각 기업은 Q1 Item 1 원문 소제목 → Q2 직전 소제목별 제품/서비스·고객·공급망 요약 → Q3 Item 1A → Q4 Item 3 → Q5 Item 7 실적/목표/방침/불확실성 → Q6 Item 8 수치/기간/단위/회계 주석 → Q7 전체 가치평가 기반 보고서를 같은 대화에서 수행했다. 원문 링크·접수번호·요청 Item·인용 토글·렌더링 오류 없음·모바일 가로 넘침 없음도 확인했다.

소제목 추출/후속 요약 항목 수: AAPL 21/21, MSFT 31/31, NVDA 22/22, AMZN 14/14, GOOGL 16/16, META 17/17, TSLA 59/49, JPM 36/36, WMT 26/26, XOM 1/3. Tesla는 중복 상위 제목을 계층별 하위 요약에 통합했으며 IRA/OBBBA 내용도 Programs and Incentives에서 확인했다. XOM은 원문 Item 1에 명시적 하위 소제목이 없다고 밝힌 뒤 제품·고객·공급망을 구분해 요약했다. 없는 원문 소제목을 만들지 않았다.

JPMorgan 수정 후 Item 7에서 2025년 실적과 실제 공시된 2026년 순이자수익 전망 약 1,030억 달러/Markets 제외 약 950억 달러를 확인했고, Item 8의 연결재무제표 수치·기간·단위 및 통합 보고서까지 확인했다. NVIDIA와 XOM도 참조 안내에 머무르지 않고 실제 재무 수치를 출력했다.

본실행은 9개 기업 성공, JPMorgan의 마지막 통합 답변에서 RUN_ERROR 1건이었다. 같은 대화 이력을 재생하여 Item 8 finding이 Item 7 근거 ID를 선택하는 오류를 두 번 확인했다. 검증을 완화하지 않고 재생성 요청에 이전 draft와 모든 ID의 요청/실제 Item 불일치를 넣었다. 회귀 테스트와 JPMorgan 전체 7턴 브라우저 재실행을 통과했다. 나머지 9기업의 통과 결과와 합쳐 10기업/70질문을 검증했으며 실패 실행을 성공으로 계산하지 않았다. 재실행 명령은 `SEC_LIVE_BASE_URL=http://127.0.0.1:12800 pnpm test:sec-chat:live --grep JPM: --workers=1`이다.

## 검증 결과와 재현 명령

| 검증 | 결과 | 명령/증거 |
| --- | --- | --- |
| 실제 SEC/provider/UI | 10기업 / 70질문 PASS (본실행 9기업 + 수정 후 JPM 전체 재실행) | `SEC_LIVE_BASE_URL=http://127.0.0.1:12800 pnpm test:sec-chat:live --workers=3` |
| LangGraph Bruno | 6 requests / 6 tests / 6 assertions PASS | `pnpm test:sec-chat:api --env-var baseUrl=http://127.0.0.1:18000`; `/tmp/sec-chat-final-bruno.json` |
| BFF Bruno | 3 requests / 3 tests / 3 assertions PASS | `05-sec-intelligent-ui`; `/tmp/sec-chat-bff-bruno.json` |
| Storybook | 1 PASS | `pnpm test:sec-chat:views`, 실제 Renderer의 인용 표시/숨김과 오류 callback 없음 |
| Python | 16 PASS + 기존 SecClient 7 PASS + SEC hybrid 12 PASS | `uv run pytest tests/test_sec_intelligent_ui.py tests/test_app.py -q`, `tests/domains/tenk/test_sec_client.py`, `tests/test_sec_hybrid.py` |
| BFF | build + 18 tests + type check PASS | `pnpm test`, `pnpm lint` |
| FE | production build + type check + lint PASS (기존 복사 media img warning 1건) | `NEXT_DIST_DIR=.next-sec-chat-prod pnpm build`, `pnpm typecheck`, `pnpm lint` |
| Python 변경 범위 | Ruff/Pyright 0 errors, wheel build PASS | sec_chat, sec_intelligent_ui, 변경 SecClient, 관련 테스트; `pnpm build` |
| 기존 A2UI 회귀 | 69 tests PASS, 계약 검사 PASS | `pnpm test:a2ui`, `pnpm a2ui:check` (61 sources / 66 adapters / 4 catalogs) |
| MCP 브라우저 | PASS | 실제 META 검색/다운로드/자유 재무 질문/인용 토글, XOM 최신 공시/실적·순이익/이전 법인 표시; 모바일 가로 넘침 없음 |
| 비밀정보 | PASS, 발견 0건 | staged diff에 `gitleaks stdin --redact` |
| 문서 | PASS | stock 동기화, 상대 링크 존재, `git diff --cached --check` |

실행 산출물은 [Playwright HTML](../../1-fe-host/playwright-report/index.html), `1-fe-host/test-results/sec-chat-report.json`(JPM 최종), `sec-chat-main-report.json`(본실행), `sec-chat-verified-companies.json`(10기업 통합 판정)의 latest-filing·70개 성공 AG-UI·70개 visible answer·재무/전체 보고서 screenshot 첨부다. 본실행 HTML은 `/tmp/sec-chat-nine-company-final-playwright-report/index.html`에 보존했다. MCP 스크린샷은 repository root `.playwright-mcp/sec-chat-meta-financial.png`, `sec-chat-xom-financial.png`, `sec-chat-xom-summary.png`에 있다. 원본 실패 기록은 `/tmp/sec-chat-before-incorporated-*` 등에 보존했다. 이 초기 실행의 green 결과를 최종 본문 충분성 검증으로 계산하지 않는다.

전체 workspace `pnpm lint`/`pnpm typecheck`는 기존 Python 파일들의 Ruff 52건/Pyright 32건 때문에 실패했다. 진단 파일 집합과 이번 변경 파일의 교집합은 0이었다. 전체 workspace green으로 보고하지 않는다. 해당 오류를 고치는 범위 밖 변경은 하지 않았다. `/tmp/sec-chat-ruff-final.json`, `/tmp/sec-chat-pyright-final.json`, `/tmp/sec-chat-root-lint.log`, `/tmp/sec-chat-root-types.log`에 상세 증거가 있다.

## 자원 정리

작업 소유 FE PID 13482(부모 13481), BFF PID 16750(부모 16739), 최종 LangGraph PID 18357(부모 18347)을 명령·cwd로 재확인하고 TERM 종료했다. `ps`에서 해당 PID/부모 및 이전 작업 서버 PID가 모두 사라졌고, `lsof`에서 12800/18000/2801 LISTEN 없음으로 확인했다. Playwright worker 18394 및 이전 17085/17086/17087도 종료됐다.

MCP의 공식 browser_close로 작업 브라우저 PID 10646과 자식들을 종료했다. PID 부재, Playwright browser 프로세스 잔존 0, 전용 임시 프로필 `playwright_chromiumdev_profile-DDpDhz` 삭제를 확인했다. 공유 MCP 서버는 종료하지 않았다. 작업 전용 `.next-sec-chat`/`.next-sec-chat-prod` 빌드 디렉터리는 서버 종료 후 제거했고, Next가 자동 변경한 next-env.d.ts/tsconfig.json은 작업 전 내용으로 복구했다. 검증 보고서·스크린샷·로그는 보존했다.

사용자가 시작한 Docker 10개 컨테이너(PostgreSQL, Neo4j, OAuth proxy 및 모니터링)는 실행 상태로 보존했다. 실제 다운로드한 SEC 공시는 사용자 요청 결과이므로 DB에 보존했다. 관련 없는 서버·사용자 브라우저·인증정보·DB 볼륨은 변경/삭제하지 않았다. 정리 미완료 자원 없음.

## 현재 한계와 stock 동기화

대화는 로컬 단일 사용자 메모리 세션이며 새로고침/서버 재시작으로 복원되지 않는다. 서버 세션 상한은 30개이고 준비 요청 시 2시간 미사용 세션을 정리한다. 모델 입력은 약 18만 자 예산으로 큰 Item을 발췌하며 답변에 전체 대비 처리 길이를 표시한다. 원문 인용 일치 검사는 요약의 모든 의미·숫자를 자동 검증하는 장치가 아니다. 모델 생성 결과는 실행별로 달라질 수 있다. 원문 밖의 수치/전망은 만들지 않도록 지시하며 부재와 발췌 범위 밖을 구분한다. 모든 SEC 문서 서식이나 별도 외부 첨부의 참조를 해석하는 범용 parser를 구현한 것은 아니다.

현재 상태는 [도메인 계약](../stock/us-corporate-filings/intelligent-ui.md), [도메인 시스템](../stock/us-corporate-filings/system-design.md), [공통 시스템](../stock/tech-shared/system-design.md), [호스트](../stock/tech-shared/1-fe-host/sec-intelligent-ui.md), [LangGraph](../stock/tech-shared/3-langgraph-fast/sec-intelligent-ui.md), BFF API 명세에 반영했다. 구현 시작 당시 기록은 수정하지 않고 이 flow로 검증 상태를 갱신한다.

스킬: apb-bruno-api-tests(API 시나리오/HTTP E2E), apb-playwright-e2e(실제 MCP 탐색/브라우저 시나리오/실행 증거). 기존 정적 검사 실패는 위와 같이 분리했으며 신규 기능의 필수 API·View·MCP·실제 10개 기업 검증 및 자원 정리 결과가 완료 판단의 근거다.
