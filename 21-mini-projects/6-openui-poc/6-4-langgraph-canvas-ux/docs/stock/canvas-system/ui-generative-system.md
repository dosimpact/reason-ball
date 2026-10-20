# UI Generative System

Python LangGraph가 분석과 UI 생성을 수행하고 Next.js/OpenUI가 Chat 및 thread별 Canvas를 렌더링하는 현재 시스템이다. [Architecture](architecture.md), [Canvas 상태·명령](canvas-system.md), [통합 시스템 설계](../system.md)를 함께 참고한다.

## Architecture

```text
AgentInterface
  → workspaceFetch (thread/Canvas/artifact 문맥 포함)
  → Next /api/workspace/run
  → Python /canvas/run
  → LangGraph plan → work
      ├ 일반 Chat: DeepAgents + OpenUI 카탈로그
      ├ 분석 Chat: publish_analysis_chart → 실제 ID 참조 프로그램
      ├ Canvas: 위젯별 생성/수정/삭제/갱신 계획
      └ explain / clarify: 설명 또는 확인
  → 자체 SSE run/chat/canvas/artifact
  → Chat AG-UI 변환 / Canvas store / artifact registry
```

현재 위젯 생성은 순차 실행이다. 하나의 SSE 연결 안에서 채널별 이벤트를 분배하며 Chat/Canvas 각각 별도 연결이나 병렬 생성 엔진을 운영하는 것은 아니다.

## Runtime

프로젝트 루트에서 아래 디렉터리로 각각 이동해 실행한다.

```bash
cd backend-langgraph
uv sync --frozen
uv run langgraph dev --port 2037 --no-browser
```

```bash
cd frontend
npm ci
npm run generate
npm run dev
```

frontend는 `http://127.0.0.1:3045`, Python은 2037을 사용한다. Python 앱은 `agent/app.py`의 Starlette custom routes를 LangGraph 서버에 마운트한다. 과거 `/study`의 FastAPI/uvicorn 2930, frontend 2929 명령을 사용하지 않는다.

## Environment

backend `.env`가 모델 자격 증명을 소유한다. frontend는 서버 측 `LANGGRAPH_API_URL`과 필요한 LangGraph 설정을 소유한다. 실제 키는 문서·로그에 기록하지 않는다. 두 프로젝트는 HTTP로 연결하며 상대 프로젝트의 소스/env 파일을 런타임에 읽지 않는다.

`npm run generate`는 `src/app/config/library.ts`에서 `generated/system-prompt.txt`, `generated/spec.json`을 생성한다. 카탈로그 변경 후 Python의 `agent/system-prompt.txt`를 명시적으로 갱신해야 한다. Tambo provider는 현재 앱의 필수 런타임이 아니다.

## API Contract

### 경로

| 브라우저 same-origin 경로 | Python 경로 | 역할 |
|---|---|---|
| POST /api/workspace/run | POST /canvas/run | 생성·자연어 변경 SSE |
| GET /api/workspace/query/{queryId} | GET /canvas/query/{queryId} | 저장된 조회 정의 |
| POST /api/workspace/query/{queryId} | POST /canvas/query/{queryId} | 등록 SQL의 결정적 재실행 |
| GET /api/workspace/health | GET /canvas/health | 상태·metrics·synthetic 표시 |

기존 `/api/chat` 경로도 유지하지만 현재 Chat+Canvas 화면은 workspaceFetch 경로를 사용한다. queryId는 SQL hash 기반 24자리 hex다.

### Run request

아래는 `RunBody`의 주요 필드 요약이다.

```ts
type RunBody = {
  message: string;
  threadId?: string | null;
  history?: Array<Record<string, unknown>>;
  widgets?: Widget[];
  selectedWidgetId?: string | null;
  canvas?: { tabs?: CanvasTab[]; activeTabId?: string;
    pending?: unknown; refreshStatus?: unknown };
  chatArtifacts?: ChartArtifact[];
};
```

서버는 본문 1MB, message 1~12000자, history 최대 30개, widgets/artifacts 각각 최대 50개를 제한한다. 현재 frontend는 이전 user/assistant 메시지 최근 12개까지 전달한다. 이 문맥은 브라우저가 제공하며 서버의 인증된 사용자 소유권 저장소를 대체하지 않는다.

### 자체 SSE envelope

```text
data: {"channel":"run","type":"start","runId":"...","sequence":0}

data: {"channel":"chat","type":"delta","delta":"...","runId":"...","sequence":1}

```

| channel | 주요 type | 수신 동작 |
|---|---|---|
| run | start / done / error | 전체 실행 수명주기 |
| chat | delta | AG-UI 텍스트 이벤트로 변환 |
| artifact | commit | ChartArtifact 검증·thread registry 저장 |
| canvas | start / progress / delta / commit / error / delete | pending과 위젯 상태 갱신 |

각 이벤트에 runId/sequence를 붙인다. Canvas 이벤트에는 작업에 따라 widgetId, tabId, baseRevision, widget/snapshot 등이 포함된다. 생성 중 program은 임시 상태이며 완료 commit에서 검증 후 저장한다. 서버 run 제한은 120초다. 스트림이 done 없이 끝나면 frontend 오류로 처리하며 마지막 정상 위젯은 보존한다.

### AG-UI 적용 범위

현재 `workspaceFetch`가 `RUN_STARTED`, `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`, `RUN_FINISHED`를 만들어 OpenUI `agUIAdapter`에 제공한다. Python이 이 이벤트를 직접 보내는 것은 아니다. Canvas/artifact는 AG-UI frontend tool 호출 대신 자체 이벤트 분배로 처리한다.

현재 frontend tool 선언 → 호출 → 브라우저 실행 → tool result 반환 → LangGraph 재개 계약은 없다. 향후 표준 프로토콜 통일과 frontend tooling을 검토할 수 있지만 SDK 선택·재개 방식·이벤트 계약은 별도 검증 대상이다. OpenUI 렌더링, AG-UI 전송 규약, Canvas 도메인 명령은 서로 다른 책임이다.

### Artifact와 Query

`publish_analysis_chart(sql, title, description, chart_type, months, region, start_date, end_date)`는 검증·실행·등록 후 ChartArtifact를 발급한다. Chat 분석 경로에서는 work 노드가 도구를 실행하고 반환된 실제 artifactId로 프로그램을 작성한다. 일반 Chat 경로에도 분석 도구가 등록되어 있다.

GET query는 SQL·제목·설명·파라미터/결과 스키마·생성 시각을 반환한다. POST query는 `{parameters, queryVersion}`를 받아 snapshot을 반환한다. QueryResult는 registry의 정의와 별개이며 최신 결과 하나로 모든 소비자를 덮어쓰지 않는다. 없는 정의 GET은 404, 유효하지 않은 조회 POST는 400이다.

## Analytics Tools And Data Freshness

`agent/analytics.py`는 synthetic sales_daily/ad_daily를 DuckDB에 제공한다. describe/validate/execute/register와 publish 도구가 같은 서비스를 사용한다. 단일 SELECT, 테이블/함수 allowlist, 파라미터 바인딩과 period/value 결과 계약을 검증한다. 신규 등록 SQL은 start_date/end_date/region 바인딩을 요구한다. 서비스 초기화와 query API 실행은 worker thread에서 수행한다.

| 정책 | 동작 |
|---|---|
| manual | 사용자가 조회 API를 호출해 갱신 |
| polling | 패널 타이머가 조건에 맞을 때 조회, intervalSeconds 10~3600 |
| snapshot | 저장된 결과 유지, 수동 갱신도 차단 |

polling은 렌더링된 패널에서 동작하며 화면이 visible이고 온라인이며 생성 실행 중이 아닐 때만 수행한다. 실패 시 최대 5분의 지수 backoff를 적용하고 마지막 정상 결과를 유지한다. 같은 패널 조회를 중복 실행하지 않으며 오래된 revision의 응답은 버린다.

fetchedAt은 조회 시각, sourceWatermark는 원천 반영 시점, dataVersion은 데이터 revision이다. 이는 실시간 push 구독이 아니다. `uv run simulate-analytics`로 합성 원천 변경을 요청한 뒤 다음 조회에서 반영을 확인할 수 있다. 후속 Canvas fetch에는 LLM이 필요 없다.

## Testing And Validation

현재 자동 검증 명령은 다음과 같다. 각 프로젝트 디렉터리에서 실행한다.

```bash
# backend-langgraph
uv run pytest
uv run ruff check agent tests
```

```bash
# frontend
npm run generate
npm test
npm run lint
npm run typecheck
npm run verify
npm run test:e2e
```

이미 작업이 소유한 서비스를 사용할 때는 `BASE_URL=http://127.0.0.1:3045 npm run test:e2e`를 사용한다. 다른 서비스의 포트를 종료하거나 재사용하지 않는다. 실제 모델 E2E는 provider 호출을 포함한다.

검증 범위는 SQL 제약, artifact/저장 스키마, thread 격리, 늦은 응답/중복 이벤트, Chat 추가와 원본 보존, 필터 조회, polling/backoff, snapshot, 새로고침 복원, 탭/resize/이동, 일반 Chat·Canvas 생성/부분 변경이다.

이전 분석 차트/FSD 검증은 [기존 flow](../../flow/2026-10-18-add-to-canvas.md)에 보존한다. 현재 registry/DnD 검증은 아래 최신 결과를 따른다.

AG-UI frontend tool 왕복, 임의 Root 추출, 임의 OpenUI 버전 호환, 인증·멀티테넌트 저장은 현재 완료 검증 범위가 아니다.

## REG-01: 일반 콘텐츠 생성

Operation에 kind=analysis|registered와 content 생성 지시를 추가한다. 기본값 analysis로 기존 호출을 유지한다. 등록 가능한 비분석 콘텐츠 요청은 registered create/update로 계획한다. 일반 대화의 기존 생성 경로도 유지한다.

- mode=chat: 독립 기본 OpenUI 프로그램을 생성하고 서버가 `CanvasItem("openui", title, JSON.stringify(program))`으로 감싼다. Chat에만 표시하며 추가는 사용자 동작이다.
- mode=canvas: 등록 위젯 commit을 반환한다. registrationId/version, sourceId, program, uiState, revision, tabId/layout을 포함하며 queryId는 없다.
- 수정: 기존 registered 종류를 우선한다. 기존 프로그램을 문맥에 포함하고 새 프로그램으로 교체한다. 기존 sourceId/배치를 보존하며 입력 상태는 초기화한다.
- refresh/policy: 일반 등록 위젯에는 분석 조회가 없으므로 거부한다. delete는 양쪽 위젯을 지원한다.
- 프런트엔드 registry/parser 검증 후 저장한다. 잘못된 프로그램은 기존 정상 위젯을 덮어쓰지 않는다.

생성된 CanvasItem 명세를 `npm run generate`로 내보내고 `frontend/generated/system-prompt.txt`를 `backend-langgraph/agent/system-prompt.txt`에 명시적으로 복사한다. 생성 명세만 바꾸고 backend asset을 방치하지 않는다.

REG/DND 검증은 Markdown/표/입력, Chat→Canvas 복사, 상태 독립성, 삭제/재추가, 패널·탭 drop, 그리드 폭, reload, 잘못된 payload, 실제 Python/provider 생성·수정을 포함한다. 최신 결과는 [변경 기록](../../flow/2026-10-18-canvas-registry-dnd.md)에 기록한다.

최신 확장 검증: Chrome 전체 16개(50.1초), frontend 348개, Python 전체 59개 및 최종 planner 관련 18개 통과. typecheck/FSD/build/Ruff 통과, ESLint 기존 경고 5개. 상세 실패·수정 과정과 실행 경계는 위 registry/DnD 변경 기록에 보존한다.
