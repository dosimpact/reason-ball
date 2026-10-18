# Chat + Canvas 시스템 설계

## 실행 경계

- Python 3.12/uv: `backend-langgraph`, `uv run langgraph dev --port 2037 --no-browser`.
- Next.js/npm: `frontend`, `npm run dev` (3045). `npm run generate`로 기본 OpenUI 카탈로그를 생성한다.
- Backend의 `.env`가 모델 키를 소유하고 frontend의 `LANGGRAPH_API_URL`이 Python 주소를 지정한다. 실제 env·DuckDB·SQLite·검증 산출물은 커밋 대상이 아니다.
- 형제 프로젝트와 reference를 런타임에 import하지 않는다. 포트·프로세스도 독립적으로 소유한다.

## 요청과 스트리밍

`AgentInterface → workspaceFetch → /api/workspace/run → Python /canvas/run → workspace_graph(plan, work)`.

Plan은 chat/canvas/clarify/explain과 위젯별 작업을 구조화한다. `queryMode=reuse`는 서버에서 새 SQL을 무시하고 기존 queryId를 사용한다. 새 지표는 replace로 검증된 새 쿼리를 등록한다. 일반 Chat은 기존 DeepAgents 그래프와 OpenUI 카탈로그를 사용한다. 이전 `/api/chat` 경로도 유지한다.

SSE는 run/chat/canvas/artifact 채널과 runId/sequence를 포함한다. Canvas 이벤트는 widgetId, operationId, baseRevision으로 식별하며 start/progress/delta/commit/error/delete를 사용한다. 브라우저 분배 계층은 Chat 텍스트를 AG-UI 이벤트로 변환하고 Canvas 이벤트는 Zustand store로 보낸다. 현재 생성 작업은 위젯별 순차 실행이며 동시 모델 생성으로 설명하지 않는다. commit 전에는 임시 상태이고 파싱·버전 검증 성공 후 저장한다. 모델의 계획 설명이 비거나 공백뿐이면 서버가 작업 진행/확인 안내를 채워 빈 Chat 응답을 방지한다. 안내는 완료를 미리 주장하지 않는다.

## 위젯과 데이터 모델

`src/entities/analysis/model/model.ts`의 Zod 스키마가 저장 계약이다. widget schemaVersion=1, catalogVersion=1을 검사하며, 분석 위젯은 queryVersion=1/resultSchemaVersion=1을 추가 검사한다. 분석 위젯별 program·parameters·snapshot·definitionRevision·refreshPolicy·uiState를 저장한다. 일반 등록 위젯은 아래 REG/DND 계약을 따른다. 별도 Renderer와 SnapshotContext로 등록된 CanvasChart에 데이터를 제공한다. 데이터 갱신은 OpenUI 프로그램 재생성 없이 context를 갱신한다. 표현 변경은 대상 프로그램을 교체한다.

Canvas 문서는 schemaVersion=5 (기존 v2/v3/v4 읽기 호환)이며 `threadId`, `tabs[{id,title}]`, `activeTabId`, `widgets`, `selectedWidgetId`를 가진다. 위젯의 `tabId`와 `layout{x,y,w,h}`는 OpenUI program 바깥의 호스트 메타데이터다. 너비는 24열 중 1~24열, 높이는 4~40행이며 새 위젯 기본값은 main 탭/12열/14행이다. 행 높이 30px와 간격 8px를 사용한다. 탭은 최대 20개, 문서는 최대 50개 패널이며 ID·탭/선택 참조를 검증한다.

`canvas-ux:thread-canvas:${encodeURIComponent(threadId)}`에 완료된 문서를 저장한다. `canvas-ux:active-thread`는 reload 시 복원할 채팅을 가리킨다. AgentInterface 안의 ThreadCanvasBridge가 thread 선택을 Canvas store에 연결한다. 첫 메시지 전 draft는 메모리에 두고 createThread에서 새 ID로 이전한다. New chat 버튼은 draft도 초기화한다. 채팅 삭제/보관 한도 초과는 연결 문서도 정리한다.

store와 진행 요청/sequence/종료 run 집합은 thread별로 분리한다. workspaceFetch는 시작 시 owner store를 포획하고 이후 모든 이벤트·완료·오류를 그 store에 적용한다. 삭제된 store는 disposed 처리하여 늦은 응답의 저장을 차단한다. 패널의 polling도 소유 store에 연결한다. 생성 이벤트에 요청 시작 시 tabId를 담고 기존 패널 변경은 tabId/layout을 유지한다. 삭제된 탭으로의 commit은 거부한다.

요청 본문은 threadId, widgets, selectedWidgetId와 canvas{tabs,activeTabId,pending,refreshStatus}를 포함한다. Python RunBody와 WorkspaceState가 이를 보존하여 planner에 전달한다. 상태 질문은 explain/no operations로 처리한다. 이는 브라우저 제공 문맥의 PoC이며 서버 인증/테넌트 권한 검증을 구현한 것은 아니다.

기존 `canvas-ux:dashboard:v1`의 알려진 v0/v1은 가져오기 버튼으로 현재 활성 탭에 새 패널 ID로 복사한다. 원본은 유지한다. 미지원 scoped 문서는 덮어쓰기를 차단하고 검증 가능한 행만 읽기 전용 표로 표시한다. 임의 OpenUI 버전 호환성은 보장하지 않는다.

## DuckDB와 조회 API

`agent/analytics.py`가 sales_daily/ad_daily 합성 fixture와 query registry를 소유한다. DuckDB 연결은 프로세스 내 RLock으로 직렬화하고 registry는 SQLite에 저장한다. 외부 접근·확장 로딩을 끄며 SQLGlot로 단일 SELECT, 테이블·함수 allowlist, 정확한 period/value 결과 계약을 검사한다. 실행에 행 수·메모리·타임아웃 제한을 적용한다. 이 제한은 운영 환경의 사용자 인증·테넌트 격리를 대체하지 않는다.

describe/validate/execute/register 분석 도구와 `/canvas/query/{queryId}`는 같은 서비스를 사용한다. 반복 조회는 모델 없는 API다. 데이터셋 revision과 ingestion 시각을 sourceWatermark로, 응답 시각을 fetchedAt으로 기록한다. `uv run simulate-analytics`는 소유 서비스가 다음 조회에서 적용할 로컬 변경 요청을 만든다. 공개 쓰기 API는 없다.

## Chat artifact와 Query 계약

`publish_analysis_chart` 도구는 검증·실행·등록을 거쳐 artifactId를 발급한다. 분석 차트 요청은 planner가 mode=chat의 create operations로 구조화하고 work 노드가 도구를 직접 실행한다. Chat Root의 AnalysisChart 참조는 모델이 임의 생성하지 않고 실제 발급된 ID로 서버가 구성하며, 각 결과가 준비되는 순서대로 스트리밍한다. 일반 UI/표 요청은 기존 DeepAgents 생성 경로를 유지한다. 중첩 Chat graph의 custom 이벤트를 workspace SSE로 전달한다. transport는 요청 소유 thread의 artifact registry에 저장하고, Chat OpenUI에는 `AnalysisChart(artifactId)` 참조가 들어간다. snapshot 렌더링과 추가 버튼은 해당 컴포넌트가 담당하며 Root/AST 추출은 하지 않는다.

- QueryDefinition: SQL hash 기반 queryId/queryVersion=1, SQL, 제목/설명, createdAt, parameterSchema/resultSchema. SQLite 기존 테이블에 제목/설명 컬럼을 기본값과 함께 추가한다. 최초 등록 메타데이터를 유지한다. 신규 등록은 start_date/end_date/region 바인딩이 있는 SQL만 허용하고 고정 날짜는 시작·종료 쌍을 검증한다. `GET /canvas/query/{queryId}`는 정의, POST는 재실행 결과를 반환한다.
- QueryResult: rows, parameters/hash, fetchedAt, sourceWatermark, dataVersion, resultSchemaVersion. registry는 결과를 단일 최신값으로 덮어쓰지 않는다.
- ChartDefinition: schemaVersion=1, artifactId, 제목/차트 종류, queryId/version, parameters, snapshot, queryDefinition. renderer는 지원하는 차트 타입·period/value 계약을 사용한다.

`canvas-ux:artifacts:{encodedThreadId}`에 완료된 Chat artifact를 보관한다. 미지원 문서 원본은 보존한다. Chat 후속 요청에는 해당 thread의 최근 artifact 50개까지 문맥으로 전달한다. 삭제된 thread의 늦은 이벤트는 무시하고 채팅 삭제 시 artifact도 정리한다.

추가는 `addArtifact`가 스키마 검증 → 깊은 복사 → 새 widgetId/sourceArtifactId → 활성 탭 저장으로 처리한다. 호스트가 `root = Col([CanvasChart(title,type)])`를 결정적으로 생성한다. 중복 클릭은 sourceArtifactId로 기존 패널을 찾아 이동한다. Chat snapshot/Canvas snapshot의 메모리 참조도 분리한다. 이후 Canvas fetch는 기존 registered-query API를 이용한다. 스트리밍 중·호환성 차단 상태에서는 추가하지 않는다.

## Frontend FSD

Next.js 경로는 루트 `app/`의 얇은 adapter이며 `src/pages`를 Pages Router로 오인하지 않도록 루트 `pages/README.md`를 둔다. 레이어 경계는 아래와 같다.

| 위치 | 역할 |
|---|---|
| src/app | 앱 layout/styles, OpenUI 생성 설정, 서버 API |
| src/pages/chat, gallery, preview | 화면 구성과 페이지 전용 UI |
| src/features/manage-canvas | thread 저장/전환, 스트림 분배, Canvas 조작 |
| src/entities/analysis | 차트·조회·snapshot 계약, artifact registry, OpenUI 렌더러 |
| src/shared/ui/openui | 기존 범용 OpenUI 컴포넌트·함수·기본 카탈로그 |
| src/shared/api, config, lib | origin 검사, base path, 개발 도구 |

slice 외부에서는 index public API를 사용한다. 기존 범용 UI/함수 내부 로직은 유지하고 모듈 이동·import 경로와 public API만 조정했다. 생성물은 `frontend/generated/`이며 `npm run generate` 후 packaged Python prompt를 명시적으로 동기화한다.

Steiger 0.7.0 및 @feature-sliced/steiger-plugin 0.8.0, `steiger.config.mjs`의 권장 규칙을 사용한다. 업무 계약을 분리하기 위해 analysis/manage-canvas 두 slice의 단일 사용처 병합 권고만 제외한다. 계층 참조·교차 참조·public API 검사는 유지한다. `npm run lint:fsd`는 경고도 실패 처리하고 `npm run verify`에서 구조 검사와 build를 함께 실행한다.

## 검증 결과와 지원 경계

단위: `uv run pytest`, `uv run ruff check agent tests`; frontend: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. 브라우저: `npm run test:e2e`, 자체 테스트 서버를 시작한다. 이미 이 작업이 소유한 서버를 사용할 때는 `BASE_URL=http://127.0.0.1:3045 npm run test:e2e`.

HTML 보고서는 `frontend/output/playwright-report/index.html`, 상세 JSON은 `frontend/output/validation/e2e.json`, 화면은 `frontend/output/playwright`에 남긴다. registry/DnD 확장 후 전체 Chrome E2E 16개 통과(50.1초), frontend 348개, Python 전체 59개 통과. planner 보완 후 관련 Python 18개와 Ruff를 재검증했다. FSD 오류/경고 0, typecheck와 production build 통과, ESLint 오류 0/기존 경고 5개다.

[최신 registry/DnD 검증 기록](../flow/2026-10-18-canvas-registry-dnd.md)을 참고한다. 실제 provider가 이전 Chat-only 지시 또는 중복 제목 편집을 오해한 사례를 확인해 planner 우선 규칙을 보완했다. 금지된 CURRENT_DATE SQL은 서버가 거부했으며 SQL 필드의 바인딩 명세를 강화한 뒤 통합 검사를 통과했다. 유한한 검증 시나리오의 통과가 모든 모델 출력의 정확성을 보장하지는 않는다.

검증 서버는 Python 2047/Next production 3055와 별도 분석 데이터 디렉터리를 사용했다. 기존 사용자 서비스 2037/3045를 유지하고 검증 서버는 종료한다. mock 오류·오프라인·교차 SSE 검사와 실제 provider 검사를 구분해 보고서에 남긴다.

운영 인증·멀티테넌트·공개 배포, 임의 OpenUI 코드/버전 호환, 임의 Chat Root 추출, AG-UI frontend tool 왕복은 범위 밖이다. 취소는 Python 작업 종료까지이며 공급자 과금 취소를 보장하지 않는다.

## Canvas 상세 문서와 프로토콜 경계

[Architecture](canvas-system/architecture.md), [Canvas 상태·조작·렌더링](canvas-system/canvas-system.md), [UI 생성·API·검증](canvas-system/ui-generative-system.md)은 이 통합 시스템 계약의 상세 설명이다. Tambo 및 /study 참고 설계를 현재 코드에 맞게 재작성했다.

현재 AG-UI 적용은 Chat 텍스트의 브라우저 변환 계층이다. Python의 end-to-end AG-UI 출력과 frontend tool 결과 반환·LangGraph 재개는 미구현이다. 공통 CanvasCommand 처리기와 AG-UI frontend tool 왕복은 후속 설계다. Chat→Canvas DnD와 범용 OpenUI registry는 아래 REG/DND 확장 계약을 따른다. 현재 조작은 Zustand 액션과 자체 Canvas 이벤트로 처리한다. 문서 정합화 기록은 [2026-10-18 상세 stock 재작성](../flow/2026-10-18-canvas-system-docs-rewrite.md)을 참고한다.

## REG / DND 확장 계약

`entities/analysis/ui/registration.tsx`가 registerCanvasElement, CanvasRegistrationWrapper, CanvasItem, RegisteredRenderer를 공개한다. 개발자 등록 ID·버전·library를 검증하고 기본 openui 등록에 전체 기본 컴포넌트를 제공한다. payload로 library 코드나 JSX를 받지 않는다. custom library의 모델 명세 동기화는 개발자 책임이다.

저장 계약은 기존 분석 Widget과 `kind=registered` RegisteredWidget union이다. 등록 위젯은 query/snapshot 대신 registrationId/version·sourceId·program·uiState를 가진다. v5 문서에 혼합 저장하고 v2/v3를 읽는다. parser 실패·미지원 등록/버전은 원본 보존 정책을 따른다. 배치와 입력 상태 수정은 definitionRevision을 증가시키지 않는다.

HTML5 MIME application/x-openui-canvas의 thread-scoped payload로 Chat 등록 콘텐츠 복사, 분석 artifact 참조 추가, widget 재정렬/탭 이동을 처리한다. beforeId 앞 삽입 또는 끝 삽입이며 24열 ReactGridLayout이 배치한다. 잘못된 payload와 cross-thread drop은 거부한다. Alt+위/아래 및 기존 컨트롤이 drag 대안이다.

Python Operation.kind/content가 일반 위젯 생성·수정을 분리한다. mode=chat은 CanvasItem wrapper를 출력하고 mode=canvas는 쿼리 없는 widget commit을 보낸다. 수정은 기존 프로그램을 문맥에 포함하며 layout/sourceId를 보존하고 uiState는 초기화한다. registry parser가 commit을 최종 검증한다. 생성 프롬프트를 재생성해 Python packaged asset과 동기화한다.

상세 계약과 검증은 [Canvas system](canvas-system/canvas-system.md), [변경 기록](../flow/2026-10-18-canvas-registry-dnd.md)을 따른다.

## SPLIT-01 — Workspace splitter

`src/pages/chat/ui/split-workspace.tsx`가 Chat과 Canvas를 3열 CSS Grid(가변 Chat / 10px handle / 가변 Canvas)로 배치한다. ResizeObserver로 컨테이너 너비를 추적하고 각 영역 최소 430px로 비율을 제한한다. Pointer capture와 pointermove로 실시간 조절하며 pointercancel/lost capture/Escape는 드래그 시작 비율로 복원한다. 방향키/Home/End/Enter와 ARIA separator 값을 제공한다. 드래그 중 텍스트 선택을 막고 종료 시 복구한다. 950px 이하에서는 splitter를 숨기고 기존 세로 레이아웃을 유지한다. 비율은 UI 메모리 상태로 관리하며 widget 문서·query·모델 실행과 무관하다. 검증은 [splitter 기록](../flow/2026-10-18-workspace-splitter.md)을 따른다.

SPLIT-01 검증: Chrome 관련 E2E 4개, typecheck/FSD/build 통과. [검증 기록](../flow/2026-10-18-workspace-splitter.md).

## REG-FIX-01 — 등록 콘텐츠 생성 형식 검증

독립 프로그램은 `$state`와 로컬 컴포넌트 선언 뒤에 `root = Col(...)`를 정의할 수 있다. 서버는 첫 문자열이 아닌 root 선언을 검사하며 전체 코드 펜스를 제거한다. packaged catalog의 컴포넌트·함수·액션 호출 이름을 검사하고 잘못된 생성 결과에는 오류 문맥을 전달해 최대 한 번 재생성한다. 로컬 컴포넌트 변수는 호출하지 않고 참조하며 Add/Delete/drag는 호스트 wrapper가 제공한다. 서버 검사는 전체 OpenUI 문법·인자 타입 검증을 대체하지 않으며 최종 검증은 브라우저 parser가 담당한다. 기존 실패 응답은 자동 재실행하지 않는다.

원문 메모/입력 폼 요청의 실제 provider 생성→입력→Canvas 추가→reload 복원을 확인했다. [수정·검증 기록](../flow/2026-10-18-registered-program-fix.md).

## GRAFANA-GRID — 좌표 기반 Dashboard Grid

Grafana의 수동 배치(custom/default) grid 방식을 적용한다. react-grid-layout 2.3.0이 24열, rowHeight 30px, gap 8px, `{x,y,w,h}` 좌표, drag/resize preview, 충돌 밀어내기와 위쪽 빈 공간 정리를 담당한다. 기존 CSS auto-placement와 개별 pointer resize는 교체했다. Grafana의 별도 Auto grid나 전체 대시보드 제품을 복제한 것은 아니다.

패널 기본값은 12×14, 너비 1~24, 높이 4~40이다. 높이 범위는 이 앱의 콘텐츠와 기존 최대 크기를 보존하기 위한 제품 정책이다. ⠿는 좌표 이동, 우하단 핸들은 resize, ↗는 기존 native DnD로 탭 이동/재정렬이다. Chat 추가도 native DnD를 유지하며 grid 안에 놓으면 해당 위치를 시작점으로 충돌 정리한다. 입력/버튼 조작은 이동을 시작하지 않는다. 방향키 이동 및 기존 너비/높이 컨트롤이 키보드 대안이다. Escape로 진행 중 위치/크기 변경을 취소한다.

Grid 이벤트는 thread 소유 store의 setLayouts에 해당 탭 전체 패널 좌표를 전달한다. 모든 영향 패널을 한 번 저장하고 content revision·프로그램·입력·query는 유지한다. 생성/삭제/수동 컨트롤/탭 이동도 같은 normalizeWidgets 경로에서 collision/vertical compaction을 적용한다. 실행 중·호환성 차단·폐기된 thread의 layout commit은 거부한다. 요청된 패널 집합이 현재 탭과 다르면 저장하지 않는다.

문서 저장은 v5. v2/v3 pixel height와 v4의 12열 w/h를 24열 비율 및 가장 가까운 38px row pitch로 변환한다. 좌표 없는 항목은 빈 자리를 순서대로 찾고, 좌표 있는 항목은 충돌을 정리한다. Renderer는 측정한 Canvas container width를 사용하여 splitter 변화에 반응한다. 폭 600px 미만은 한 열 읽기 배치로 표시하고 drag/resize를 끄며 저장 좌표는 보존한다.

실행 파일: entities/analysis/model/grid.ts (계약·migration), features/manage-canvas/model/layout.ts (정규화), model/store.ts (원자적 저장), pages/chat/ui/dashboard-grid.tsx (ReactGridLayout), grid-item.tsx (공통 카드). 조사 출처·적용 기준·최종 검증은 docs/flow/2026-10-19-grafana-grid.md에 기록한다.

GRAFANA-GRID 검증: frontend 356개, Python 관련 29개, 전체 Chrome 21개 통과. 최종 핸들 표시 보완 후 grid 전용 3개(외부 drop/splitter 추가 시나리오 포함)를 재검증했다. typecheck/FSD/build/Ruff 통과, lint 오류 0/기존 경고 5. 조사와 증거는 [Grafana grid 기록](../flow/2026-10-19-grafana-grid.md)을 참조한다.
