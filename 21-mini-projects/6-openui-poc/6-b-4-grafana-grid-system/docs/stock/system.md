# 시스템 설계 — SEC Chat + Canvas

## SYS-01 실행과 데이터 소유

- Python 3.12 / uv: `backend-langgraph`, 포트 2041. LangGraph custom Starlette app을 사용한다.
- Next.js / npm: `frontend`, 포트 3049. `/`는 새 헤드리스 workspace이며 `/comparison`은 승계한 비교 화면이다.
- `agent/settings.py`: 외부 환경변수, 루트 `.env`, 백엔드 `.env` 순으로 설정한다. 키는 브라우저 번들에 포함하지 않는다.
- 데이터 기본 경로는 backend의 `data/`. `documents.sqlite`는 기존 PDF 벡터, `sec.sqlite`는 SEC 원문·섹션·벡터·캐시, `conversations.sqlite`는 대화·Canvas·명령 기록을 저장한다.
- 형제 프로젝트를 런타임에 import하지 않는다. 서비스 간 연결은 HTTP다.

## SYS-02 요청 흐름

`ChatProvider → fetchLLM → Next /api/dashboard/chat → Python /dashboard/chat → build_dashboard_graph`.

요청마다 현재 패널 선택·목록과 최근 대화로 Canvas 작업 종류를 먼저 구조화한다. Deep Agent는 기존 PDF `search_documents`, SEC 도구, 대화별 Canvas 도구를 가진다. SEC 수집 subagent는 기업 CIK를 확인하고 `collection_graph(discover_filings → download_originals)`를 호출한다. 서브에이전트 및 도구 결과를 바탕으로 최종 OpenUI 응답을 만든다.

서버에 저장한 대화 이력과 마지막 사용자 질문, 현재 Canvas 선택·패널 메타데이터를 모델에 전달한다. `CanvasExecutionGuard`는 이번 사용자 턴에서 성공한 도구 결과만 작업 증거로 인정한다. 재사용 가능한 채팅 결과의 artifact_publish도 별도 작업으로 검사하며 서버가 반환한 artifact_id가 있어야 성공으로 인정한다. 요청한 작업 종류가 빠지면 해당 종류만 최대 두 번 재시도하고, 남으면 미완료 답변을 반환한다. 과거 턴의 성공이나 직접 UI 조작의 revision 증가는 증거로 사용하지 않는다. 삭제한 잘못된 중간 답변과 내부 재시도 system 지시는 최종 대화 이력에 남기지 않는다.

실행 계획은 작업 종류와 기존 대상 ID 목록을 가진다. 같은 작업으로 여러 패널을 바꾸면 각 대상의 성공 도구 결과를 요구하고, layout 배치의 각 ID와 tab 명령의 대상 ID도 검사한다. 신규 패널 생성 개수나 모든 필드의 의미적 정확성까지 증명하지는 못한다. 요청 분류는 모델 호출 한 번을 추가하며, 분류 실패는 실행 오류로 처리한다. Canvas 변경이 계획된 턴은 도구/상태 이벤트를 즉시 보내되 텍스트 답변은 실행 검사 후 최종본만 전송한다. 일반 분석 대화는 기존 텍스트 스트리밍을 유지한다. 브라우저가 임의로 보낸 과거 system/tool 메시지는 사용하지 않는다. 같은 대화의 모델 실행은 동시에 하나만 허용한다. 완료 또는 취소 시 메시지를 저장하며 정상 완료 시 저장 후 RUN_FINISHED를 보낸다. 취소/실패는 부분 메시지 뒤에 명시적 상태 Callout을 저장하고 실행 잠금을 해제한다. 프런트는 스트림 종료 후 같은 대화가 여전히 선택돼 있을 때 서버 최종 이력을 다시 읽어 수정 전 초안을 제거한다. 대화 전환이나 새 실행이 시작되면 늦은 이력 응답을 적용하지 않는다.

## SYS-03 AG-UI와 Canvas 상태

Python 스트림은 RUN_STARTED, TEXT_MESSAGE_*, TOOL_CALL_*, STATE_SNAPSHOT, STATE_DELTA, RUN_FINISHED/RUN_ERROR를 전송한다. STATE_SNAPSHOT의 `dashboard`는 서버 상태 전체이며 STATE_DELTA는 `/dashboard`를 교체하는 원자적 JSON Patch다. 표준 상태 이벤트를 사용하지만 변경 필드만 보내는 최적화는 아직 하지 않는다.

프런트 transport는 응답별 소유 thread를 기억하고 해당 store에만 상태를 적용한다. 낮은 revision의 늦은 snapshot은 무시한다. UI 조작은 `/api/dashboard/state/{thread_id}`를 통해 동일한 서버 명령 처리기를 사용한다.

이는 Agent의 서버 도구 → AG-UI 상태 → 화면 갱신 구조다. 임의 DOM 스크립트 실행이나 모든 frontend tool의 일반적인 일시중단/재개 런타임은 제공하지 않는다. 다운로드는 명시적인 브라우저 컨트롤로 실행한다.

## SYS-04 공통 명령과 충돌 처리

`agent/dashboard/models.py`의 Panel/Layout/DashboardCommand가 서버 계약이며 frontend entity에는 수신 검증용 Zod 스키마가 있다.

명령은 operation_id, base_revision, action, panel_id, payload를 가진다. add/update/remove/layout/pin/select/ui_state, tab_add/tab_select/tab_rename/tab_remove, artifact_add, export/import를 지원한다. 같은 에이전트 실행의 저장·상태 읽기·갱신은 asyncio lock으로 순서를 보장하여 병렬 도구가 같은 revision으로 경쟁하지 않게 한다. 사용자 등 외부 변경은 기존 409 경계로 감지한다. SQLite BEGIN IMMEDIATE로 원자적으로 변경한다. operation ID 재전송은 중복 적용하지 않으며 revision 불일치는 409다.

배치는 24열, 패널 너비 4~24, 높이 4~40행이다. 고정 패널을 먼저 배치하고 충돌한 이동 가능 패널을 아래로 밀어 겹침을 없앤다. 동일 artifact 추가는 기존 패널 선택으로 처리한다. JSON 가져오기는 스키마·프로그램 검증 후 새로운 탭/패널 ID로 복사하며 실패 시 기존 상태를 보존한다.

## SYS-05 OpenUI 계약과 검증

`src/shared/ui/openui`는 승계한 기본 UI, 함수, 액션이다. `src/entities/dashboard/ui/library.tsx`는 DashboardArtifact 및 YearOverYear/FocusPanel을 확장한다. `src/app/config/library.ts`가 생성 진입점이다.

```bash
# frontend
npm run generate
cp src/shared/ui/openui/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
```

생성 spec/prompt와 백엔드 자산을 함께 갱신한다. 모델은 publish 도구의 artifact ID를 사용해야 하며 브라우저는 저장된 artifact를 대화 내 결과 영역에서도 제공한다.

독립 패널 저장 전 Python은 frontend `/api/validate`에 HTTP로 프로그램을 전달한다. 이 경로는 생성된 스키마로 parser를 실행한다. 미완성·미해결 참조·오류·중첩 artifact를 거절한다. 내용을 조용히 버리는 excess-args와 type-mismatch 파서 경고도 최종 검증에서 거절한다. 계산식 AST를 mutable state 초기값으로 저장하는 경우도 거절하고, 직접 계산식 또는 `$` 없는 파생 표현식을 사용하도록 오류를 반환한다. `root` 앞에 변수 선언이 오는 정상 프로그램은 허용한다. 카탈로그의 component-valued prop 참조도 검사하여 Card 바로 아래 SectionItem 같은 잘못된 배치를 거절한다. ResponseValidationGuard는 최종 채팅 응답도 검증하고 최대 두 번 답변 형식만 수정하게 한다. 채팅 검증에는 DashboardArtifact를 허용하지만 독립 패널에는 허용하지 않는다. 실패가 지속되면 답변 표시 미완료를 안내한다. 따라서 새 프로그램으로 기존 패널을 덮기 전에 실패를 모델/UI에 반환한다. 단순 제목/배치 변경은 프로그램을 재생성하지 않는다. pin_canvas_panel은 panel_id와 pinned를 명시적으로 받는다. 내용 변경이 없는 고정·배치·삭제 등만 계획된 턴에는 publish 도구를 노출하지 않아 잘못된 재시도로 프로그램을 바꾸는 경로를 차단한다.

## SYS-06 SEC와 근거 검색

- `sec/client.py`: HTTPS SEC 호스트 allowlist, 연락처가 있는 User-Agent, 0.22초 간격, 일시 오류 재시도, SQLite 캐시. CIK/원문 파일명을 검증한다.
- `sec/parsing.py`: HTML 숨김/스크립트 제거, Item별 텍스트와 위치 추출. Company Facts의 연간 기간과 단위, 최신 제출 관측치를 선택한다. `fy`를 원래 회계기간으로 잘못 쓰지 않는다.
- `sec/storage.py`: downloaded/indexed/failed 상태. 이미 받은 원문은 재시도 실패로 지우지 않는다.
- `sec/service.py`: 수집 그래프, 섹션 페이지네이션, 첫 검색 시 text-embedding-3-small 인덱싱. 임베딩은 SQLite BLOB으로 저장한다.
- `sec/tools.py`: 검색 실패를 근거 부재로 위장하지 않는 도구 결과.

기존 `documents.py`, `prepare_documents.py`, `history.py`의 PDF/페이지 출처/서버 이력 계약은 유지한다. 새 prepare는 documents/chunks와 함께 pages(document_id,page,text)에 추출한 원문을 원자적으로 저장한다. `document_pages.py`의 read_document_page는 페이지 번호·offset·limit를 검증하고 원문/다음 offset/페이지 URL을 반환한다. 기존 인덱스에는 backend 소유 data/pdfs/{id}.pdf만 fallback하며 ID 경로 탈출과 외부 symlink를 거절한다. 새로 준비한 임의 로컬 PDF는 pages 테이블에서 읽으므로 원본 경로에 런타임 의존하지 않는다.

CanvasPlan.source_read는 none/original/overview로 연구 요구를 구분한다. ResearchEvidenceGuard는 현재 턴의 성공한 read_document_page/read_sec_section 중 서로 다른 원문 페이지/섹션 증거를 요구한다(original 1, overview 4). 검색 구절·이전 턴·동일 페이지 반복은 새 읽기 증거로 세지 않는다. 최대 두 번 보완하고 미달이면 원문 확인 미완료를 안내한다. 이 최소 범위 검사는 모든 주제/수치의 의미적 정확성이나 전체 보고서 완독을 증명하지 않는다. 서버는 해당 턴의 실제 원문 도구 결과에서 확인한 문서/페이지/섹션·부분 범위·출처를 모아 별도의 “확인한 원문 범위” 카드를 저장하고 전송한다. 모델이 프로그램 주석에 적은 범위는 사용하지 않는다. SEC 섹션 식별은 문서 형식에 따라 실패할 수 있으며 그 경우 전체 원문 경로를 제공한다. 사용자 승인 SEC 설정 적용 후 직접 수집·섹션 읽기·검색·재무 갱신을 실환경에서 확인했다(SEC-NATIVE-01/02).

## SYS-07 FSD와 화면

| 계층 | 책임 |
|---|---|
| app/ | Next route adapters |
| src/app/config | 프롬프트 생성 조립 |
| src/pages/workspace | 헤드리스 대화·목록·전체 배치 |
| src/pages/onboarding | HTML 온보딩과 React Flow 구조도 |
| src/pages/print | 전체 탭 인쇄 화면 |
| src/features/dashboard | 명령·AG-UI 분배·Canvas·내보내기 |
| src/entities/dashboard | 상태 스키마·패널 렌더러·확장 카탈로그 |
| src/shared | 기본 OpenUI·서버 중계·공통 도구 |

Steiger 권장 규칙과 public API를 사용한다. dashboard entity/feature의 단일 소비자 경고만 역할 분리를 위해 제외한다. 주 화면에 AgentInterface를 사용하지 않는다. 기존 /comparison은 호환 경로로 보존한다.

### 반응형 배치와 키보드

`features/dashboard/model/grid.ts`는 저장 좌표에서 화면 배치를 계산한다. 600px 미만은 y/x 순서의 한 열 표시이며 저장 명령으로 전달하지 않는다. 키보드 이동과 크기 변경은 범위를 제한하고 동일한 layout 명령을 사용한다. Canvas는 drag/resize 시작부터 종료까지 gesture 상태를 추적한다. Escape는 저장하지 않고 그리드를 remount하여 임시 배치와 이벤트 리스너를 해제하며, 취소 뒤의 stop 이벤트는 저장하지 않는다. 정상 stop에서만 layout 명령을 보낸다. splitter는 Home/End, Enter/더블클릭 초기화, Escape/pointercancel 취소를 제공한다.

## SYS-08 내보내기와 인쇄

JSON은 버전과 전체 대시보드 상태를 담고, 가져오기는 기존 상태에 새 ID로 추가한다. CSV는 재무 데이터 행과 일반 Table/IuiTable 및 카탈로그 차트의 데이터를 제공한다. `extract-tables.ts`는 현재 카탈로그 evaluator에 저장된 ui_state를 적용하며 Query와 액션은 실행하지 않는다. 중첩/복수 표와 Card에 포함된 출처도 추출한다. extract-chart.ts는 선/막대/영역/레이더/원형/산점도/일반 Chart의 평가된 값을 데이터 블록으로 변환한다. 각 블록은 Data block/Row/Column/Value/Visualization의 긴 형식으로 내보내며 숫자 음수와 수식형 문자열을 구분한다. 표·차트가 없거나 평가에 실패하면 프로그램 대신 상태와 PDF/JSON 안내를 기록한다. `/print`는 모든 탭과 저장된 UI 입력값을 펼친다. A4 본문 폭 182mm를 화면/인쇄에 일관되게 적용해 SVG 잘림을 피한다. 긴 패널은 페이지 분할을 허용하고 표 행과 차트 컨테이너는 분할을 피한다. A4 여백, 제목과 다음 내용의 연결, 입력 필드 너비를 적용하며 인쇄 시 탐색·조작·개발 버튼은 제외한다. 빈 탭과 누락된 thread도 안내한다.

## SYS-09 재무 패널 갱신

`Panel.refresh`는 mode(live/snapshot), interval_seconds(0/60/300/900), last_attempt_at/last_success_at/error를 가진다. 기존 저장본에는 기본 live/수동 정책을 적용한다. `refresh_policy`는 공통 저장 명령이며 `refresh`는 `dashboard/refresh.py`에서 원래 저장 query로 SEC Company Facts를 캐시 우회 조회한다. 모델을 호출하지 않는다. 응답은 서버 전용 refresh_result 명령으로 저장하며 클라이언트가 해당 명령을 직접 보내면 거절한다.

operation_id 재전송은 이미 저장된 결과를 반환한다. 같은 패널의 중복 조회는 막고, base_revision 불일치·Snapshot·삭제된 thread에는 결과를 적용하지 않는다. 조회 실패는 마지막 정상 데이터를 유지하며 안전한 오류 범주와 시각만 저장한다. 에이전트의 재무 갱신 도구도 동일한 서비스와 정책을 사용한다.

`RefreshControls`는 보이는 패널의 Live 정책을 5초마다 확인하여 설정 주기가 지났을 때 요청한다. 숨겨진 브라우저/다른 탭/언마운트에서는 자동 요청하지 않는다. 서버 상주 스케줄러가 아니며 앱을 닫아도 자동 갱신한다고 설명하지 않는다. SEC 응답의 queried_at, cache의 source_fetched_at, 선택 관측치의 latest_filing_date를 구분해서 표시한다.

## SYS-10 검증과 증거

backend pytest/Ruff, frontend Vitest/typecheck/ESLint/Steiger/build를 실행한다. 브라우저는 전용 Playwright CLI 세션과 소유 서버를 사용한다. 실제 실행한 검토용 대화는 지우지 않는다. 이전 프로젝트의 기록은 새 검증을 대신하지 않는다.

구체적인 PASS/미검증/외부 차단은 [구현 현황](implementation-status.md), 사용자 흐름과 산출물 위치는 [변경 기록](../flow/2026-10-25-dashboard-implementation.md)에 남긴다.

### 탭 삭제 확인

내용이 있는 탭의 `tab_remove`는 정확한 boolean `remove_panels: true`를 요구한다. UI는 제목·패널 수·보존 범위를 확인창에 표시한다. revision 검사와 같은 트랜잭션에서 해당 패널과 선택을 정리하며 활성 탭 삭제 시 남은 첫 탭으로 전환한다. 마지막 탭은 유지한다. Agent 도구는 포함 패널 삭제가 명시되지 않은 요청에는 확인하도록 안내한다. 모델 확인 대화는 별도 검증이 남아 있다.

### 외부 드롭 좌표와 배치

외부 artifact drop은 실제 grid bounds와 열 간격 12px·행 간격 40px로 좌표를 계산한다. 빈 화면 안내는 absolute overlay여서 그리드 시작점을 밀지 않는다. noCompactor로 저장된 빈 공간을 유지하며 라이브러리의 이동 충돌 처리와 서버 arrange가 겹침을 정리한다. 좁은 화면의 표시 전용 한 열 정책은 유지한다.

### 온보딩 최신 안내

/onboarding은 React Flow 9개 노드 구조도와 사용자 조작, 원문 확인 범위, 중단/재개, CSV 차트·JSON 입력값 복원 안내를 제공한다. 모바일 최소 zoom 0.15와 Fit View를 지원하며 큰 minimap은 작은 화면에서 숨긴다. 데스크톱 Zoom In과 390px 모바일의 페이지 가로 넘침 부재를 브라우저로 확인했다.

### 모호한 대상의 확인 단계

CanvasPlan.clarification이 비어 있지 않으면 operations/targets를 비우고 Canvas 도구는 inspect_dashboard만 제공한다. 동일 제목의 단수 요청을 모든 패널 변경으로 해석하지 않도록 분류 지침을 명시한다. 선택을 대상 지정으로 보지 말라는 사용자 지시를 존중하고 탭 이름으로 확인한다. 후속 답변이 대상을 확정하면 해당 ID를 계획한다. 자료의 페이지·수치가 아직 없다는 이유만으로 사용자에게 되묻지 않으며 명확한 패널 수정 요청은 조사와 갱신으로 계획한다. 확인 여부 분류 자체는 모델 판단이며 모든 자연어 표현에 대한 보장을 주장하지 않는다.

### 보고서 근거 검사와 읽기 전용 턴

GroundingGuard는 현재 사용자 턴에 매칭된 검색/원문/재무 도구 결과를 수집하고 별도 structured-output 모델로 최종 답변의 기업·수치·기간·단위·인용 페이지를 검사한다. 잘못된 기업 귀속이나 근거 없는 금액은 최대 두 번 추가 검색/답변 수정을 요구하며 계속 실패하면 보류 Callout으로 교체한다. 반올림과 명시적 가정, 근거 있는 계산은 허용한다. 최종 답변 검사는 현재 턴 근거를 사용하며, 검증 모델도 오판할 수 있다.

원문 확인 계획(source_read != none)은 Canvas 변경 계획과 마찬가지로 중간 텍스트를 보류하고 검증 후 최종본을 전송한다. 일반 분석의 스트리밍은 유지하므로 모든 답변의 초안 노출을 막는다는 의미는 아니다. 도구 진행/상태 이벤트는 계속 전송한다. operations가 비어 있거나 clarification이 있는 계획은 Canvas 도구를 inspect_dashboard만 제공한다. API 직접 조작 경로는 기존 revision/스키마 검사를 유지한다.

### OpenUI 게시 전 근거 검사

GroundingGuard.awrap_tool_call은 publish_ui_panel 및 modify_dashboard(update)의 program 변경을 handler 실행 전에 검사한다. 불일치/검사 오류는 success=false ToolMessage로 돌려주고 저장 함수를 실행하지 않는다. 제목만 바꾸는 작업은 이 검사를 건너뛴다. SEC 재무 패널은 기존 서버 Company Facts 경로를 사용한다.

게시 검사는 서버 소유 과거 도구 결과도 사용할 수 있다. 최신 결과부터 최대 24개/200,000문자를 완전한 결과 단위로 선택하고 current_turn 표시를 유지한다. 오래된 모델 답변은 근거로 사용하지 않는다. 현재 읽은 범위 카드와 source_read 검사는 계속 이번 턴 기준이다. 저장 전 검사는 전체 기존 artifact에 대한 소급 감사나 사용자가 가져온 JSON 전부의 사실 검증을 의미하지 않는다.

### 헤드리스 도구 활동 표시

workspace/ui/ToolActivities는 useToolActivities로 assistant 호출과 전체 메시지의 결과를 ID로 연결한다. 텍스트가 없는 도구 호출도 표시하며 tool-status 모델에서 사용자 작업명과 문서/페이지/섹션을 표시한다. 프로토콜 오류뿐 아니라 JSON success=false/error/status=failed도 실패로 구분하고 failed 건수는 일부 실패로 표시한다. 일반 완료는 응답 수신으로 표현한다. 현재 사용자 턴이고 실행 중인 호출만 진행 중이며 종료 후 결과 없는 호출은 미완료다. 원시 프로그램/비밀 값/파일 경로를 이 요약 UI에 출력하지 않는다. 저장 이력의 도구 메시지를 사용하므로 reload 후에도 상태가 복원된다.

### SEC 오류와 실행 대상 검증

SEC 도구의 HTTPStatusError는 http_status, 공개 host, retryable(429 또는 5xx)을 반환한다. 403을 공시 부재나 SEC 내부 장애로 단정하지 않는다. 근거 검사는 SEC 조회/수집/목록 도구 결과와 서버 PDF catalog도 사용하여 SEC 저장소와 PDF 보유 여부를 구분한다.

plan_target_errors는 수정/삭제/이동/고정/선택/갱신의 실제 panel ID와 탭 명령의 tab ID를 검사한다. 채팅 artifact ID를 패널 ID로 쓸 수 없다. 해당 작업에 target이 없거나 ID가 잘못되면 최대 두 번 계획을 재분류하고 계속 실패하면 실행 오류로 처리한다. SEC 보고서 다운로드·재시도는 Canvas export/update와 별개라는 분류 지침을 명시한다.

### 게시 결과 참조와 입력 폼

/api/validate는 파싱된 root에서 도달 가능한 DashboardArtifact ID 목록도 반환한다. ResponseValidationGuard는 이번 턴에 성공적으로 게시한 chat artifact가 최종 응답에 포함되는지 검사하고 누락 시 표시 응답만 재구성하도록 요구한다. publish_ui_panel은 같은 실행 도구 인스턴스에서 동일 제목/프로그램/출처의 반복 chat 게시를 mutation lock 안에서 기존 ID로 반환한다. 기존 기록의 중복 artifact를 소급 삭제하지 않는다. 기존 artifact 재표시는 신규 게시 작업이 아니라 읽기 전용으로 분류한다.

Chips.defaultValue는 form-local 초기값이며 반응형 $binding이 아니다. 복사 문자열/파생 계산에 연결하는 선택에는 reactive value를 지원하는 Select 등 컴포넌트를 사용한다. 실제 생성 폼에서 기업명·질문·관심 항목 복사와 Canvas 추가 후 세 값의 reload 복원을 확인했다.

### 브라우저 명령 직렬화와 다중 생성 검사

features/dashboard/model/store.ts의 command는 thread ID별 Promise queue로 같은 브라우저의 변경을 직렬화한다. 각 실행 직전에 최신 revision을 읽으며, 실패한 명령이 다음 명령을 막지 않는다. 외부 변경의 409는 기존처럼 최신 상태를 읽고 사용자에게 알린다. 실행 완료 시 해당 queue 항목을 정리한다.

CanvasPlan.minimum_new_panels와 성공한 서로 다른 add 대상 ID를 대조한다. build_dashboard_tools의 실행 내 동일 add payload는 기존 ID를 반환한다. 메모/체크리스트에는 독립 reactive 입력 예제를 지침으로 제공한다. 새 분석 버튼은 split 화면을 선택한다. 새 add/artifact_publish/tab_add의 빈 target ID는 생성 전 placeholder이므로 정규화에서 제외한다. minimum_new_panels 개수 검사는 유지한다. 기존 항목 수정의 대상 ID 검사는 완화하지 않는다. 실제 메모·체크리스트 재실행에서 서로 다른 두 패널 생성과 정상 최종 답변 및 입력 복원을 확인했다.

### 전년도 공식 PDF 준비

`backend-langgraph`에서 `uv run prepare-documents --include-history`를 실행하면 기본 3개 보고서에 NVIDIA FY2025 공식 연차보고서(10-K 포함)를 추가한다. ID는 nvidia-2025, PDF 페이지 수는 181이다. 이 보고서는 IR의 annual-reports-and-proxies 페이지가 연결하는 공식 CDN 파일이며, SEC 수집 저장소와 구분한다. 기본 CLI는 기본 3개 및 로컬 documents 입력으로 인덱스를 재구축하므로 전년도 자료를 계속 포함하려면 옵션을 유지한다. 준비는 새 인덱스 완성 후 교체하며 실패 시 기존 검색 자료를 유지한다.

PDF-only 요청은 원문 재무 표를 확인한 뒤 일반 OpenUI 패널로 게시할 수 있다. SEC XBRL financial 패널과 출처/갱신 경로가 다르며, PDF 확보가 SEC API 접근 성공을 의미하지 않는다.

`find_document_pages(document_id, phrase, limit)`는 준비된 pages 테이블에서 대소문자·줄바꿈을 정규화한 문구 검색을 수행한다. 전체 일치 페이지 수와 제한된 페이지/문맥을 반환하며 실제 원문 읽기는 read_document_page로 수행한다. SQL wildcard가 아니라 문자열 포함 검색이므로 %를 검색어로 넣어도 전체 페이지가 매칭되지 않는다. 긴 연차보고서의 페이지 번호 추측을 줄이기 위한 도구이며 검색만으로 전체 문서를 읽었다고 처리하지 않는다.

### OpenUI 출처 메타데이터 동기화

/api/validate는 유효한 프로그램에 대해 sourcesFromRoot의 출처를 반환한다. 파서 root에서 도달 가능한 element의 sources props만 수집하고 title/sourceName 및 선택 URL 문자열을 정규화한다. 사용하지 않는 선언과 임의 문자열은 출처로 추출하지 않는다. publish_ui_panel은 parser 출처와 명시적 sources를 중복 제거하여 저장한다. 내용 수정은 새 프로그램과 새 인자의 출처로 교체하며 이전 출처를 자동 누적하지 않는다. parser 실패 시 저장하지 않는 기존 경계와 게시 전 근거 검사는 유지된다.

### 에이전트 탭 조작 계약

modify_dashboard의 action은 지원하는 Literal 값으로 제한한다. tab_add/tab_select는 tab_id를 반환한다. 같은 실행 안의 동일 탭 생성 재시도는 이미 만든 탭 ID를 재사용한다. publish_ui_panel은 신규 패널의 tab_id를 명시할 수 있어 병렬 게시 중 활성 탭 변경에 의존하지 않는다. modify_dashboard의 탭 명령은 tab_id 또는 payload.id를 지원하며 서로 다르면 거절한다.

실행 계획의 remove_tab_contents_confirmed는 탭과 패널을 함께 지우는 명시적 승인 여부다. 미승인 상태의 nonempty tab_remove는 실제 포함 패널 수를 넣은 clarification으로 변환하고 변경 도구를 노출하지 않는다. 이 의도 분류는 모델 기반이다. 재시도나 패널 이름으로 탭을 식별한 것을 승인으로 간주하지 않도록 지침을 명시했다. 저장 계층은 remove_panels=true 없는 내용 있는 탭 삭제를 계속 거절한다.

### 목적지와 변경 대상 구분 및 확인 응답

plan_target_errors는 add의 대상이 기존 chat artifact ID인지 검사한다. 목적지 탭 ID를 add target으로 넣거나 새 tab_add/artifact_publish에 기존 target을 지정하면 계획을 재분류한다. 목적지 탭은 instruction과 publish_ui_panel.tab_id로 전달한다.

plan.clarification이 있으면 /dashboard/chat은 에이전트 그래프를 실행하지 않고 서버가 질문을 Callout으로 구성해 AG-UI로 전송하고 대화 이력에 저장한다. 완료 이벤트는 저장 후 전송한다. 질문 필요 여부의 분류는 모델에 의존하지만 분류된 질문의 표시를 추가 모델 생성에 맡기지 않는다. 두 번째 계획 수정 후에도 탭 내용 확인 정책을 적용한다.

탭 삭제 도구는 저장 전후 패널 ID 차이로 실제 removed_panel_ids를 반환한다. 완료 검사는 이를 같은 호출에서 충족한 remove 효과로 계산한다. 따라서 탭과 포함 패널을 함께 삭제하라는 요청에서 이미 제거한 패널을 다시 삭제하려고 재시도하지 않는다. 단순히 remove_panels=true 인자를 보냈다는 사실만으로 삭제 완료를 인정하지 않는다.

### 로컬 실행 진단

agent/dashboard/diagnostics.py는 conversations.sqlite의 dashboard_run_diagnostics에 실제 최종 계획, 완료 효과, 미충족 조건, 실행 종료 상태를 기록한다. 대화별 최근100회를 유지하며 대화 삭제 시 함께 제거한다. 원문/프로그램/전체 도구 응답/환경 키는 저장하지 않지만 계획의 instruction에는 사용자 요청을 요약한 문구가 포함된다. 진단 저장 실패는 실행 결과를 실패로 바꾸지 않고 서버 로그에 남긴다. finished는 스트림 종료 상태이며 요청 충족 여부는 missing으로 별도 확인한다. API로 공개하지 않으며 로컬 diagnostics.latest(thread_id)로 조회한다.

## SYS-UI-01 화면 책임 분리 (SLAP)

`workspace.tsx`는 대화 생명주기와 화면 구성을 조정한다. 메시지 렌더링은 `chat-message.tsx`, 시작 안내는 `welcome.tsx`, 포인터·키보드 너비 조절은 `workspace-splitter.tsx`가 담당한다. `canvas.tsx`는 그리드·폭 측정·드롭·배치 저장을 조정하며, 패널 내용과 입력 저장은 `canvas-panel.tsx`, 가져오기·내보내기는 `canvas-toolbar.tsx`, 탭 조작은 `canvas-tabs.tsx`에 둔다. React Grid Layout의 직접 자식 DOM과 패널 키는 유지한다. 서버 저장 명령과 대화별 순차 처리 경계는 변경하지 않는다.

## SCOPE-03 n년 검증 계약

실제 검증 기준은 3년, 기능은 1~20년 가변 입력이다. 연간 도구 기본값과 갱신 fallback은 3년이다. collect_sec_reports의 form은 Literal[10-K,10-Q]이며 client에서 같은 범위를 검사한다. 정정본은 같은 보고 기간과 함께 보존한다. 10-Q 대상 수는 3n개의 고유 보고 기간으로 계산한다(SEC Form 10-Q: https://www.sec.gov/about/form10-q.pdf). 연간 시계열은 기간/제외 연도를 먼저 적용하고 표시되는 연속 관측치에서만 YoY를 계산한다.

## CACHE-01 요청 조정 경계

`agent/sec/client.py`의 fetch는 URL 검증→SQLite 조회→진행 중 다운로드 합류→결과 검증/저장 순서다. 합류 키는 데이터 디렉터리/URL/강제 갱신 여부/응답 형식이며, 일반 조회와 강제 갱신은 별도 취급한다. asyncio.shield로 한 대기자의 취소가 다른 대기자에게 영향을 주지 않게 한다. 완료/실패 시 진행 중 항목을 제거하고 모든 대기자가 취소한 경우에도 실패 예외를 회수한다.

네트워크 gate는 요청 시작 간격 1초와 동시 요청1개를 적용한다. 403/429 또는 5xx+Retry-After에는 프로세스 공통 cooldown을 설정한다. Retry-After 초/HTTP-date를 지원하고 최소 60초를 쉰다. cooldown 중 요청은 SecCooldownError로 빠르게 종료하며 도구 응답에 SEC_COOLDOWN/retry_after_seconds를 제공한다. Retry-After 없는 일부 5xx는 기존 최대3회 지수 간격 재시도를 유지한다. 쿨다운과 요청 합류는 단일 프로세스 범위이며 재시작으로 초기화된다. 다중 worker/여러 별도 실행 프로세스의 호출량을 합산하는 분산 제한은 아니다. SQLite 정상 응답 캐시는 재시작 후에도 유지된다.

## UI-EMPTY-01 빈 Canvas 위치 기준

`.canvas-pane`은 position:relative로 새 분석 화면의 직접 자식 `.canvas-empty`에 위치 기준을 제공한다. 기존 대화에서는 `.canvas-grid`가 빈 패널 안내의 기준이다. 따라서 chat+canvas 전체가 아닌 각 Canvas 영역에서 가운데 배치된다.


## GROUNDING-SCOPE-01 요청 범위와 근거 판정

`GroundingGuard`는 최신 사용자 메시지를 `user_requested_scope`로 전달하고 실제 도구 근거 및 서버 준비 PDF 목록과 분리한다. 사용자 요청은 사실 근거나 검증 면제 지시가 아니다. 게시/프로그램 갱신 검사와 최종 답변 검사에 동일한 범위 정보를 전달한다.

검사 응답은 주장별 `explanation` 뒤에 `supported`/`unsupported` 판정을 받는다. 정상 설명을 오류 목록으로 오인하지 않도록 `issues`는 unsupported 항목에서만 만든다. OpenAI 검사 모델은 원래 채팅 모델을 변경하지 않는 복사본에서 streaming=false, temperature=0으로 실행한다. 검사는 화면 토큰 스트림이 아닌 완성된 구조화 판정으로 소비한다. 오류 시 저장 차단, 기존 패널 보존 및 최종 답변 보완 한도는 유지한다.

이 구조와 설정은 모델의 판정 오류를 없앤다는 보장이 아니다. 원문 기반 실제 회귀와 오류 입력 검증을 함께 유지하며 브라우저 전체 흐름 검증을 대체하지 않는다.


## PLAN-INTENT-01 채팅과 Canvas 목적지 분류

CanvasPlan은 먼저 instruction에서 최신 요청의 출력 위치와 변경 의도를 해석하고, 그 뒤 operations 및 minimum_new_panels를 생성한다. 최소 패널 수는 Canvas에 새로 추가할 패널만 세며 일반 채팅 시각화·재사용 가능한 채팅 artifact는 0이다. “Canvas에 추가하지 마”라는 금지만으로 artifact_publish를 요구하지 않는다. 너비/높이/위치는 layout, 내용/기간은 update다. “1년치는 빼줘”처럼 대상 연도가 없는 제외는 clarification으로 처리하며 선택 패널만으로 제외 연도를 추정하지 않는다.

계획 모델은 원래 채팅 모델을 바꾸지 않는 OpenAI 복사본에서 streaming=false, temperature=0으로 실행한다. 기존 target 유효성 검사·재분류·명시적 탭 내용 삭제 확인·도구 노출 제한은 유지한다. 자연어 의도 분류는 여전히 모델 기반이므로 완전한 오분류 방지를 보장하지 않는다.


## SEC-Q-PARTS-01 분기 보고서 섹션 식별

10-Q/10-Q/A는 `Part I Item 1`, `Part II Item 1`처럼 Part와 Item의 조합으로 저장한다. SEC Form10-Q의 Part I Item1(재무제표)과 Part II Item1(법적 절차)은 별개다([공식 양식](https://www.sec.gov/files/form10-q.pdf)). `extract_sections`는 Part 전환도 섹션 종료 경계로 사용하며, 동일 키의 목차/본문 중 긴 구간을 보존한다. Part를 확인할 수 없는 분기 Item은 임의 귀속하지 않고 전체 원문 읽기를 제공한다. 10-K의 기존 Item 키는 유지한다.

`read_section`은 대소문자와 앞뒤 공백을 정규화하고 정확한 키를 우선한다. Part 없는 Item 요청은 유일한 후보일 때만 해석하며, 여러 후보이면 text 없이 matching_sections/available_sections를 반환한다. 성공 응답의 section은 실제 정규 키다. 수집 서비스는 공시 form을 파서에 전달한다.

예전 Item-only 분기 섹션이 저장되어 있으면 storage.get_filing에서 보관 원문을 다시 파싱하고 동일 트랜잭션에서 기존 passage 인덱스를 제거하며 status를 downloaded로 되돌린다. 다음 검색이 새 섹션으로 재인덱싱한다. 원문·출처·수집 시각은 유지하고 네트워크를 호출하지 않는다. 현재 실환경 저장소에는 분기 보고서0건이며 이 복구는 격리 SQLite 테스트로 검증했다.


## SEC-Q-REAL-01 공식 분기 PDF 준비

prepare-documents의 `--include-quarterly`는 nvidia-2027-q2(FY2027 Q2, 2026-07-26 종료) 공식 IR PDF를 선택적으로 포함한다. 기존 검토 자료를 모두 유지하는 명령은 `uv run prepare-documents --include-history --include-quarterly`다. 현재5문서/2512구절, 분기 PDF61쪽이며 기존 nvidia/amd/intel/nvidia-2025 ID를 유지한다. 자료 선택 옵션 없이 재준비하면 제외한 문서가 새 인덱스에 포함되지 않는 기존 CLI 계약을 유지한다. SEC 다운로드 상태와 PDF 준비 상태를 합치지 않는다.


## PLAN-SCOPE-02 출력 위치와 실행 계획 분리

긴 실제10-Q 요청에서 PLAN-INTENT-01의 단일 계획 모델이 다시 add를 생성한 것을 확인했다. classify_output_scope는 최신 요청/최근 대화/현재 선택을 바탕으로 chat, chat_artifact, canvas를 먼저 판정한다. constrain_output_scope는 chat의 변경 작업/대상/신규 패널 수를 제거하고, chat_artifact는 artifact_publish만 남긴다. 원문 읽기 요구(source_read)는 보존한다. canvas는 기존 대상/명확성 검사를 따른다. chat 계획에는 inspect_dashboard 외 변경 도구를 노출하지 않는다. 두 판정 모두 비공개 비스트리밍 모델을 사용하며 목적지 분류 자체는 여전히 모델 기반이다.


## PUBLISH-POLICY-01 목적지와 생성 상한

build_dashboard_graph는 계획에서 허용 게시 목적지와 maximum_new_panels를 도출해 해당 실행의 build_dashboard_tools에 전달한다. add/update는 canvas, artifact_publish는 chat을 허용한다. publish_ui_panel/publish_financial_chart가 목적지를 생략하면 허용 목적지가 하나일 때 이를 사용하고, 혼합 계획이면 명시적 선택을 요구한다. panel_id가 있는 수정은 Canvas로 해석한다. 계획과 다른 게시 목적지는 저장 전에 거절한다. 계획 없이 직접 도구를 사용하는 기존 호출은 chat 기본 동작을 유지한다.

maximum_new_panels는 정확한 개수/최대 개수 요청의 상한이고, 최소 개수·열린 범위 요청은 None이다. 최소 생성 요구와 충돌하면 계획을 거절한다. change의 mutation_lock 안에서 성공한 신규 패널 ID 수를 계산하고 상한 초과 add를 거절한다. 실패한 저장은 개수를 소비하지 않는다. 동일 payload 재시도는 기존 ID를 재사용하며, 수정은 기존 panel_id로 가능하다. 요청마다 도구 인스턴스가 새로 만들어져 다음 사용자 요청의 생성 허용량과 섞이지 않는다. 요청 중 여러 다른 경로에서 발생한 add도 같은 제한을 따른다.

게시 응답의 destination은 서버가 결정한 실제 저장 목적지다. 실행 완료 검사와 채팅 artifact 표시 검사는 생략된 요청 인자 대신 응답의 목적지를 우선한다. 과거 응답에는 기존 인자 기반 fallback을 유지한다. 이 정책은 올바르게 분류된 계획을 집행하며 자연어 분류의 정확성을 보장하지는 않는다.


## GROUNDING-QUALIFIER-01 후속 근거 검사와 표시 경계

GroundingReview는 qualifier_findings(예외·부정·불확실성), period_findings(제목·축·기간), findings를 분리하며 unsupported만 차단한다. 답변 검사는 과거 도구 결과도 사용한다. 최신 최대24개/200,000자 이내 완전한 결과를 보존하고 current_turn 표시로 새 조회와 구분한다. 과거 근거가 있는 후속 요청은 source_read=none이어도 API에서 TEXT_MESSAGE 이벤트를 버퍼링하고 graph 최종 답변만 전송한다. 원문 없이 일반 대화하는 기존 스트리밍은 유지한다.

실행 진단 grounding에는 검사 단계, 근거 개수, 오류 개수와 retry/accepted/withheld 결정을 남긴다. 원문·답변·키를 진단에 추가하지 않는다. 이 기록은 검사 실행 증거이며 모델 판정의 정확성을 보장하지 않는다.


## SOURCE-KEY-01 동일 URL 인용 렌더링

shared/ui/openui/source-card.tsx는 확장된 Card 정의의 스키마/설명을 유지한 채 렌더러만 감싼다. URL 중복이 없으면 기존 렌더러를 사용한다. 같은 URL의 서로 다른 인용이 있으면 CardSourceProvider에 원래 배열을 그대로 전달하고 순서별 key와 sourceId를 사용하는 가로 스크롤 목록을 그린다. 인용 번호·원문 URL·제목을 병합하거나 변경하지 않는다. 기존 ListedSourceItem의 키보드/원문 열기를 유지한다. 컴포넌트 명세 및 생성 프롬프트 변경은 없다.


## DISCLOSURE-01 생성 지침 및 모델 평가 경계

대시보드 graph의 시스템 지침은 no-change 공시의 전체 예외 문장을 인용·직역하고 추가 해석은 추론으로 표시하도록 요구한다. 단문 요청은 전체 한정 범위의 직역으로 응답한다. 이는 생성 지침이며 규칙 기반 의미 보장 장치는 아니다. 별도 집중 검사와 gpt-4.1 비교 실험은 output에 보존했고 런타임 모델이나 추가 검사 호출 수는 변경하지 않았다.


## REFRESH-COOLDOWN-01 갱신 대기 처리

refresh_panel은 SEC 클라이언트의 SecCooldownError를 별도로 처리한다. refresh_result에 안전한 대기 초/마지막 데이터 유지 안내와 시도 시각을 저장한다. 기존 데이터와 last_success_at은 변경하지 않으며 finally에서 실행 잠금을 해제한다. 같은 operation_id 재시도는 저장 상태를 그대로 반환한다. 패널은 refresh.error를 기존 role=alert로 표시한다.


## SEC-NATIVE-01 독립 Python 수집 복구 및 캐시 검증

사용자가 사용자 정보까지 BFF와 동일하게 따르도록 지시했다. BFF의 SEC_USER_AGENT 값 하나만 6-7 루트 .env에 복사하고 Python client에 BFF와 같은 Accept를 적용했다. 다른 시크릿/DB 설정은 복사하지 않았으며 런타임에 BFF 프로세스·코드·경로를 참조하지 않는다. 설정 복사 전 httpx에서 동일값으로 submissions/원문200을 먼저 확인했다. 기존 실제 연락처를 유지하려던 제약은 이번 사용자의 동일 설정 지시로 대체되었다. 환경 파일 값은 문서/로그에 노출하지 않는다.

LangGraph SEC 수집 tool call은 기존 collect_sec_reports를 사용한다. 서비스 응답에 reused 수를 추가하고 도구 설명에 캐시를 명시했다. downloaded는 기존 보관본을 포함한 이용 가능 원문 수이며 reused는 그중 재사용 수다. 원문은 filing ID로 영구 보관·재사용하고 동일 파일을 다시 받지 않는다. SQLite URL캐시는 원문365일·제출목록/재무1시간·기업목록/과거목록24시간이며 이미 저장한 원문의 재사용은 이 TTL과 무관하다. 동일 URL 동시 요청 합류,1초 간격 직렬 요청,Retry-After/cooldown 정책을 유지한다.

실제 Python 도구: AAPL 기업 식별,10-K3건·10-Q3건 수집 성공,Company Facts3년 매출 조회 성공. 최초 추가 네트워크7건(이미 확보한 Apple 최신10-K 재사용), 반복 수집은 네트워크 함수를 금지한 상태에서 성공하며 외부 요청0건. 원문 섹션 읽기도 성공. backend131 tests/Ruff 통과.

실제 대화5b6ee045-b0e9-4b95-b253-bed548dc58e5(`[실데이터 검증] 자체 SEC 수집과 캐시`)에서 수집 상태→3년 financial 패널→FY2024 제외→실제 갱신을 확인했다. FY2023/2024/2025 매출은383285000000/391035000000/416161000000 USD. 패널db82c9c3-e7fd-4f55-beed-22f60d0f73e5의 ID/배치 유지, 제외 후2023/2025만 표시. 처음 갱신에서 동기SQLite 연결이 LangGraph 이벤트 루프 차단 검사에 걸렸다. operation_applied 조회를 asyncio.to_thread로 이동하고 비동기 루프 밖 DB 접근 회귀 테스트를 추가한 뒤 같은 대화에서 갱신 성공(error=None,last_success_at 갱신). 브라우저 reload와 수동 새로고침도 성공했다. 최초 실패 이력은 보존했다.

증거: backend-langgraph/output/python-bff-settings-probe.json, python-sec-collection-success.json, native-sec-tools-success.json, sec-native-settings-tests.txt, native-sec-e2e/; frontend/output/playwright/native-sec-excluded-refreshed.png. 이는 BFF API 연동이 아니라 6-7 Python의 직접 SEC 호출 성공이다. 다음은 새 SEC 원문의 검색/분석 연결,자동 갱신 및 전체 요구 최종 감사다.
