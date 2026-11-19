# 기술적 분석 시스템 설계

## 실행 경계

`3-langgraph-fast/langgraph.json`에 기존 `technical_analysis_agent`와 별도 `technical_analysis_canvas_agent`를 등록한다. 두 그래프는 LangGraph development runtime과 실제 그래프 builder를 PostgreSQL saver로 컴파일하는 FastAPI 런타임에서 실행한다. `/langgraph-dev-chat`은 `/api/langgraph-runtime` 및 `LANGGRAPH_RUNTIME_API_URL`(기본 2982), `/fastapi-chat`은 `/api/fastapi-langgraph` 및 `FASTAPI_RUNTIME_API_URL`(기본 2981)을 사용한다. 전용 `/technical-analysis`와 `/technical-analysis/canvas`도 FastAPI 런타임을 사용하며 각각 기존 graph ID로 고정한다. 대화·실행·기록·차트/카탈로그 Query는 해당 런타임에 고정하며 서로 fallback하거나 개발 서버 기록을 이관하지 않는다. [공용 런타임 계약](../tech-shared/system-design.md#fastapi-runtime-001-독립-실행-경계)을 따른다.

```text
/langgraph-dev-chat → /api/langgraph-runtime → development runtime
/fastapi-chat, /technical-analysis, /technical-analysis/canvas
  → /api/fastapi-langgraph → FastAPI + PostgreSQL checkpoints
  technical_analysis_agent → Deep Agent tools → shared OpenUI LLM composition → validated inline presentation
  technical_analysis_canvas_agent → route/tools → shared OpenUI LLM composition → validated CanvasItem presentation → explicit user pin
```

기존 primary graph 소유 경로는 `3-langgraph-fast/src/graph/primary_graphs/technical_analysis_agent/`, Canvas 전용 경로는 `technical_analysis_canvas_agent/`이다. 상태는 DeepAgentState를 확장하며 full prices, price_request, price_metadata, indicators, analysis_result, analysis_error, presentation을 가진다. prepare는 매 turn의 결과/표시만 지워 오래된 결과가 새 답변으로 노출되지 않게 한다.

## 도구와 계산

- `get_price_ohlcv(ticker, interval="1d", count=120)`: 기존 Yahoo 어댑터 및 TTL/single-flight 캐시 재사용. 전체 배열은 Command로 state에 기록하고 모델에는 메타데이터만 반환한다.
- `analyze_ohlcv_with_talib(indicators=None)`: 주입 state로 계산한다. 설정 생략 시 기존 설정 또는 세 기본 지표를 사용한다. 준비 구간이 모자라면 같은 가격 조건으로 더 긴 이력을 조회한다. 전체 결과는 state, 최신값·시그널은 ToolMessage로 전달한다.

기존 TA-Lib 엔진 지표를 유지하며 에이전트 도구는 TA-INDICATORS-020의 20종 및 복수 인스턴스를 받는다. 자연어 전체 선택은 `all_indicators=True`, 구조화 재분석은 inline의 `input.analysis_request` 또는 Canvas의 `input.canvas_context.request`를 사용해 설정을 모델이 다시 해석하지 않고 그대로 계산한다. 시그널과 화면 데이터 구성은 `domains/technical_analysis/report.py`, `presentation.py`의 순수 로직이다. 캐시 키는 ticker·interval·조회 개수·auto_adjust를 구분한다. 일반 가격 어댑터의 최대 요청 개수는 5000이다. 누적 지표 전용 경로는 2000-01-01 고정 origin에서 실제 이력을 조회하며 20000행 초과 시 오류를 반환한다. 표시 개수는 OpenUI validator의 60000자 제한을 고려해 200개로 제한한다. 차트는 하나의 날짜별 bars 배열을 공유한다.

## OpenUI와 Host 계약

세 그래프(technical_analysis_agent, technical_analysis_canvas_agent, talib_agent)는 공통 `build_output_graph`로 UI를 생성한다. `library.ts`의 componentGroups와 `promptOptions.examples`를 기존 CLI로 생성한 동일 카탈로그를 사용한다. Python presentation 어댑터는 최신 질문·설명과 검증된 결과·표시 제약만 전달하며 DSL 배치를 만들지 않는다. 모델이 전체 프로그램을 생성하고 Host parser와 Canvas ID 검사를 통과해야 게시한다. 형식·DSL 오류는 전체 두 번의 호출 안에서 수정하며 공급자 오류는 계산 상태·텍스트를 보존하는 실패 안내로 처리한다.

`technical_analysis_canvas_agent`는 `presentation`과 `canvas_reports` snapshot으로 보고서를 전달한다. 기존 `technical_analysis_agent`와 다른 graph의 `presentation = {id, program}` 경로는 유지한다. `/langgraph-dev-chat`은 공통 `AgentConversation`의 OpenUI AgentInterface·Composer·메시지 목록을 사용하며, 기존 TA는 inline 본문과 검증된 OutputView를 표시한다. Canvas TA는 채팅에 설명과 검증된 선택형 요소를 표시하며 사용자가 선택한 요소를 Canvas에 추가한다. 그래프 선택과 LangGraph SDK 전송은 기존 ChatProvider가 유지한다. values는 snapshot으로 교체하며 delta처럼 누적하지 않는다. 그래프 선택 목록은 runtime assistant 검색을 페이지별로 조회해 모든 등록 graph를 표시한다. 채팅과 구조화 JSON 입력 모드를 구분하며 서브그래프도 JSON 입력과 원본 결과로 테스트할 수 있다. 기술적 분석 에이전트는 채팅 모드를 유지한다.

## 실행과 검증

프로젝트 루트에서 별도 터미널로 실행한다.

```sh
pnpm -C 3-langgraph-fast dev
pnpm -C 1-fe-host dev
# 개발 그래프 탐색이 필요할 때 별도로 실행:
# pnpm -C 3-langgraph-fast dev:langgraph
```

기술적 분석 전용 화면의 기본 포트는 FastAPI 2981, Host 2983이며 개발 채팅은 별도 runtime 2982다. 모델 설정은 Python 패키지 `.env`의 기존 OpenAI 호환 설정을 사용한다. Host의 `FASTAPI_RUNTIME_API_URL`은 FastAPI 주소(기본 `http://127.0.0.1:2981`)를 사용하며 `SEC_CHAT_UI_VALIDATOR_URL=http://127.0.0.1:2983/api/sec-ui/validate`로 Host validator를 연결한다. 전용 UI는 `http://127.0.0.1:2983/technical-analysis`와 `/technical-analysis/canvas`이며 개발 그래프 탐색 UI는 `/langgraph-dev-chat`이다. 코드의 fallback 포트와 실제 환경 프로필은 구분한다.

```sh
pnpm -C 3-langgraph-fast test tests/test_technical_analysis_agent.py tests/graph/subgraph/price_agent tests/infrastructure/technical_analysis tests/graph/shared/cache
pnpm -C 1-fe-host typecheck
pnpm -C 1-fe-host lint
pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/chat/ui/GraphSelector.stories.tsx src/_pages/chat/ui/ChatMessageList.stories.tsx
# from 3-langgraph-fast/bruno-api-tests:
../node_modules/.bin/bru run 19-technical-analysis --env local --env-var baseUrl=http://127.0.0.1:2981
```

Bruno는 실제 Yahoo·모델·Host validator 연결이 필요하다. 테스트용 thread/assistant를 생성하고 삭제한다. 필수 검증과 정리 원칙은 [검증 지도](../../validation/INDEX.md), 실행 증거는 [flow](../../flow/2026-11-08-technical-analysis-agent.md)에 기록한다.


## TA-VAL-20261114: 실제 브라우저 검증과 관찰된 제한

실제 Yahoo·모델·TA-Lib·OpenUI 경로에서 AAPL 일봉/주봉, RSI7·SMA60 후속 변경, 삼성전자 KRW, 200봉, 잘못된 티커 안내, EMA·5분봉 범위 제한, 그래프 변경 시 격리와 모바일 390px 차트를 확인했다. [검증 기록](../../flow/2026-11-14-technical-analysis-browser-validation.md)에서 PNG 보고서와 결과에 연결한다.

당시 개발 런타임 검증에서 로컬 FE가 개발 runtime 대신 2981을 가리키면 분석이 실행되지 않았다. 현재 두 전용 화면은 실제 graph 실행을 지원하는 FastAPI 2981을 사용하므로 이 과거 관찰을 현재 포트 제한으로 적용하지 않는다. 분석 본문은 공통 ConversationText의 Markdown 렌더러를 사용하며, OpenUI 차트는 기존 검증 결과를 표시한다. 이전 Markdown 원문 노출은 OPENUI-CHAT-DS-001에서 수정했다. 잘못된 지표 기간 요청은 경고 후 기본 설정으로 계산할 수 있어, 사용자 설정 확인 UX는 후속 개선 대상이다. 이번 검증에서는 코드·환경파일을 수정하지 않았다.

## TA-QUERY-001: 조회 API와 차트 runtime

`GET /technical-analysis/chart`는 FastAPI router와 `langgraph.json`의 독립 `http.app` 양쪽에 등록된다. 브라우저는 선택 런타임의 Host `/api/langgraph-runtime/technical-analysis/chart` 또는 `/api/fastapi-langgraph/technical-analysis/chart`를 호출한다. 모델·thread·run을 만들지 않는 Yahoo/TA-Lib 읽기 API이며 기존 완료 봉·수정주가·TTL 캐시와 warmup 계산을 재사용한다.

요청은 `ticker`, `interval`(1d/1wk), `count`(2~200), 쉼표로 구분한 `indicators`(SMA/RSI/MACD의 중복 없는 선택), `sma_period`, `rsi_period`, `macd_fast`, `macd_slow`, `macd_signal`이다. 기간 범위는 기존 TA-002와 같다. ticker는 필수이며 기본 조회는 일봉120개, SMA20·RSI14·MACD12/26/9다. 잘못된 설정은422, 없는 ticker/빈 데이터는404, 그 외 공급자 실패는503이다. 응답은 `Cache-Control: no-store`를 사용한다.

응답은 source/symbol/currency/exchange/timezone/interval/auto_adjust/fetched_at/cache_hit/source_url metadata와 `as_of`, `parameters`, `indicators`, `warnings`, `requested_count`, `available_count`, `bars`를 제공한다. 각 bar는 정렬된 `time`(ISO 날짜), open/high/low/close/volume와 선택한 지표의 sma/rsi/macd/signal/histogram이다. 준비 구간 부족값은 null로 유지하며 모든 값은 같은 날짜 행에 정렬한다.

모델은 제공된 요청 인자로 Query-backed FinancialChart를 구성한다. 초기 fallback은 빈 bars/indicators이며 실제 수치는 Query가 조회한다. reactive ticker/interval/count/instances와 기본0인 refresh를 사용하도록 카탈로그와 표시 제약으로 안내한다. Host provider는 이 이름과 알려진 인자만 허용한다. 응답은 Zod schema로 검사하며 API 실패는 빈 bars와 오류 안내로 표시한다. SDK의 query key별 결과 격리가 늦게 도착한 다른 설정의 값을 차단하고 프로그램 교체·unmount 시 진행 중인 fetch를 취소하지 않으며 이전 출력의 성공 콜백은 무시한다.

최신 메시지만 opt-in30초 polling을 제공한다. 이전 메시지와 실행 중 메시지는 polling을 멈추며 화면 제거 시 SDK timer와 chart/observer를 정리한다. Lightweight Charts는 candles·volume·SMA·RSI·MACD pane을 공유 시간축으로 그리고 null을 whitespace로 유지한다. Host 테마 변경을 관찰하고 컨테이너 폭에 맞춰 크기를 조정한다. TradingView 저작권·링크를 표시한다.

[구현·검증 기록](../../flow/2026-11-14-openui-query-financial-charts.md)

## TA-QUERY-002: Query 수동 재실행

공통 카탈로그 예시와 표시 제약은 ticker/interval/count controls와 FinancialChart를 `QueryPanel([...], Action([@Run(chart)]))`에 함께 배치하도록 안내한다. native OpenUI `@Run`이 `chart` Query statement의 cache를 invalidate하므로 동일 인자로도 새 HTTP 조회가 발생한다. QueryPanel은 SDK query loading·streaming 상태를 사용해 접근 가능한 refresh 버튼과 pending 상태를 표시하며, 모델 action으로 전송하지 않는다. polling·state 격리·unmount 정리 정책은 TA-QUERY-001과 같다.

[변경·검증 기록](../../flow/2026-11-14-openui-query-manual-refresh.md)

## CHAT-ACTIVITY-001: 도구 실행 현황

Host `/langgraph-dev-chat`은 기존 values snapshot의 이번 turn tool_calls/tool 메시지를 연결해 `get_price_ohlcv`, `analyze_ohlcv_with_talib` 등의 실제 실행 이름과 상태를 OpenUI BehindTheScenes로 표시한다. 원본 도구 인자·결과·중간 AI 설명을 추가 노출하지 않는다. 조회 API와 Query의 모델 없는 갱신 경계는 유지한다. [Host 계약](../tech-shared/1-fe-host/open-ui.md#chat-activity-001-chat-behind-the-scenes)을 따른다.

## TA-CANVAS-003: 선택형 요소와 인용 문맥

Canvas 전용 그래프는 계산 후 `presentation={id, program}`을 반환한다. id는 저장된 보고서 UUID다. OpenUI는 `CanvasItem(id,title,children)`으로 가격 및 지표 인스턴스별 QueryPanel·FinancialChart를 각각 감싼다. 요소 ID는 보고서 UUID를 포함한다. 모델은 계산 결과를 설명하고 공유 카탈로그를 이용해 전체 UI 프로그램을 구성한다. 서버는 필요한 CanvasItem ID 집합을 제공하고 누락·중복·다른 ID를 거부한다. 모델이 보고서 전체를 Canvas에 스트리밍하던 기존 경로는 사용하지 않는다.

각 요소에는 별도 reactive 변수와 Query가 있다. 가격 전용 v2 chart는 명시적 `instances=[]`를 허용하고 지표 요소는 해당 인스턴스를 조회한다. 기존 v1 및 생략 시 기본 지표 계약은 유지한다. 요소별 조회는 독립되므로 많은 지표를 선택하면 초기 HTTP 조회 수도 늘어난다.

Host `OutputView.onCanvasAdd`는 wrapper의 children과 참조하는 선언만 추출해 standalone program 및 현재 reactive state를 넘긴다. Canvas 전용 ChatPage만 이 콜백을 연결한다. `PinnedCanvas`는 요소별 Renderer를 mount하고, localStorage의 `ta-canvas-items-v1:<runtime>:<thread>` 키에 구성·배치·상태를 보존한다. 같은 원본 요소도 클릭할 때마다 UUID가 다른 패널로 추가한다. sourceElementId에 원본 요소 ID를 보존하며 패널별 초기/반응 상태를 독립 복사한다. 기존 보고서 custom 이벤트를 받더라도 그것만으로 새 Canvas를 열지 않는다.

`canvas_reports[reportId]`에는 계산 결과·조건·program과 허용된 요소 ID를 보존한다. 입력 `canvas_context`는 `reportId`, `elementId`, `quote`, 선택적 구조화 `request`를 받는다. 서버는 현재 thread의 보고서 및 요소 소속을 검증하고, 인용 텍스트는 명령이 아닌 사용자 질문 문맥으로 취급한다. 설명 요청은 새 보고서 없이 채팅으로 답한다. 차트 조건을 바꾼 뒤 질문하더라도 근거는 원래 저장된 분석이며 UI에 이 차이를 명시한다.

PDF는 프런트엔드 인쇄 스타일로 전체 요소를 펼친다. chart Query의 최신 요청 상태가 성공이어야 버튼을 활성화하며 오래된 요청 완료가 이 상태를 덮어쓰지 않는다. 새로고침은 데이터를 다시 조회하므로 로컬 저장을 과거 가격의 불변 스냅샷으로 해석하지 않는다. 공유 발행 API는 이번 범위에 없다.

## TA-CANVAS-002: 독립 그래프 계약

기존 inline·TA-Lib·SEC 그래프 출력은 유지한다. Canvas 전용 그래프와 화면에만 선택형 추가를 연결한다. 서버 보고서는 대화 근거, 로컬 pinned 요소는 사용자의 화면 구성으로 구분한다. 이전 TA-CANVAS-001의 자동 보고서 탭 계약은 TA-CANVAS-003으로 대체한다. [변경·검증 기록](../../flow/2026-11-17-canvas-item-workspace.md)을 따른다.

## TA-INDICATORS-020: 버전 카탈로그와 복수 인스턴스

`GET /technical-analysis/catalog`는 `schemaVersion:2`, `catalogVersion`, 지표20종의 기본값·매개변수 범위·series descriptors·`maxInstances:40`·`maxVisiblePanels:4`를 반환한다. v2 차트는 기존 `/technical-analysis/chart`에서 `schema_version=2`와 URL-encoded `instances` JSON 배열(`instanceId?`, `name`, `parameters?`, `showSignal?`)을 받는다. `indicators=all`도 지원한다. URL의 schema_version은 정수로 변환 후 1~2 범위를 검사한다.

v2 응답의 공통 OHLCV `bars`와 `indicators[]`의 인스턴스별 series.values는 같은 날짜·길이를 유지한다. 각 인스턴스는 안정적인 ID, 정규화 parameters, showSignal, panel, status/error/errorCode, signal, series descriptors를 가진다. 동일 지표의 다른 설정은 구분하고 중복 implicit 설정·중복 명시 ID·40개 초과·잘못된 값은422로 거부한다. 원래 schema_version 생략/v1의 SMA/RSI/MACD flat-bar 응답은 호환 유지한다.

누적 origin은 `date`, `availableHistory`, `policy`, `requestedDate`, `baseline`으로 공개한다. OBV는 첫 거래량, PVT는0, AD는 첫 money-flow-volume을 기준으로 계산한다. count는 표시만 자르며 동일 소스 이력의 겹치는 날짜 값이 유지된다. 공급자 이력 수정은 캐시 버전과 origin 정책의 제약으로 명시한다. 지표 수식·EMA seed·lookback·null/분모0·개별 시그널은 [Python 계산 계약](../tech-shared/3-langgraph-fast/ta20.md)을 따른다.

OpenUI는 `technical_analysis_catalog` Query와 `IndicatorControls($chart_instances,catalog)`, reactive 인스턴스 JSON을 사용한다. 서버는 검증된 결과에서 compact 표시 입력을 만들며 모델이 DSL을 생성한다. 초기 fallback에 큰 수치 배열을 삽입하지 않는다. 실제 숫자는 모델 없는 Query로 조회한다. 두 TA 그래프는 같은 계산·설정 계약을 공유하며 inline은 LLM 생성 presentation, Canvas는 UUID별 저장 근거와 선택형 요소 표시를 사용한다. 프로토콜·수치·모델 비호출·parser 검증 증거와 사용자에게 맡긴 브라우저 검증 범위는 [당일 기록](../../flow/2026-11-16-fastapi-runtime-and-ta-indicators.md)에 둔다.

## TALIB-AGENT-001: 전체 네이티브 TA-Lib 에이전트

`talib_agent`는 기존 20종 `technical_analysis_agent`·Canvas와 분리된 그래프다. Python wrapper와
native core를 각각 `0.8.3`으로 고정하고 설치된 네이티브 카탈로그의 **237개** 함수를 실행한다.
`ALLIGATOR`, `CE`, `GATOR`, `MACDV`, `SHARPE`, `SKEW`, `SORTINO`는 이 버전에 없으므로
대체 구현을 섞지 않는다. 카탈로그는 실제 함수의 입력 키·기본 필드·파라미터·출력 타입/flags·lookback을
제공한다. 네이티브 접근은 기존 `infrastructure/technical_analysis/talib/` 아래에 두고
`domains/talib_agent/` facade를 통해 그래프와 분리한다.

외부 입력은 `MessagesState`의 `messages` 하나다. `TalibState`와 내부 `TalibBusinessState`를
명시적으로 변환하며 메시지 ID와 `add_messages` 의미를 유지한다. 내부 Deep Agent의 files/todos는
외부 상태로 반환하지 않는다. 가격·계산 전체 배열은 datasets/results에 저장하고 모델에는 도구의
최신값·상태·단위/출처·lookback·경고 요약만 제공한다. 모델 프롬프트에 전체 state를 직렬화하지 않는다.
생산 ChatOpenAI 설정은 `parallel_tool_calls=false`로 복사해 상태 변경 도구를 순차 요청한다.

| 도구 | 계약 |
| --- | --- |
| `list_talib_functions(group?, search?)` | 실제 237종의 그룹·이름 검색 |
| `describe_talib_function(name)` | 정확한 입력·파라미터·출력과 native metadata |
| `get_price_ohlcv(ticker, interval="1d", count=120)` | 완료된 수정 OHLCV. 일봉/주봉, 표시 최대 200봉, 초기 내부 이력 최소 600봉 |
| `run_talib_functions(requests)` | 호출당 1–40개 요청, 개별 실패 격리, 명시적 ID/파라미터/입력 참조로 순차 계산 |

입력 참조는 데이터셋 OHLCV 필드, 명시적 상수, 사용자 제공 값/날짜 배열, 이전 결과의 출력이다.
다중 가격 입력이나 MAVP 기간 배열은 모호하게 추측하지 않는다. 날짜를 교집합으로 정렬하고 보간하지
않는다. 실제 파라미터의 native lookback에 표시 봉 수를 더해 필요 시 최대 5,000봉까지 추가 조회한다.
누적 함수의 bounded-window origin은 메타데이터/경고로 남기며 고정 원점 계산이라고 주장하지 않는다.
다른 티커 추가는 독립 결과를 보존하고, 같은 데이터셋 갱신은 의존 결과와 그 결과를 참조하는 후속
결과를 무효화한다. 설명만 요청한 후속 턴은 가격/배열을 재사용할 수 있고 새 계산을 강제하지 않는다.

출력은 날짜 정렬 배열과 타입, flags, lookback, warnings, 마지막 봉의 `lastBarValue` 및
`lastValidAt`을 가진다. 마지막 봉이 null이면 이전 유효값을 현재값으로 바꾸지 않는다. 패턴 정수 코드와
인덱스 출력은 가격·확률로 해석하지 않는다. DPO/FRACTAL/ICHIMOKU의 displayShift는 표시 의미만
기록하고 계산 가용 날짜를 이동하지 않아 미래 참조를 방지한다.

각 턴 시작에 current_result_ids/presentation/followUps를 초기화해 이전 차트가 새 답변으로 노출되지
않게 한다. 계산 결과의 bounded context를 공통 LLM composer에 전달하여 적절한 표·차트·컨트롤을 구성한다. 전체 결과가
선택 가능하며 모든 배열은 상태에 남긴다. 표시 프로그램은 60,000자 한도에서 출력 수에 따라 차트
표시 봉 수를 제한하고 그 한계를 명시한다. 입력 context의 null·날짜를 보존하며 결측을 보간하지 않고 정수 출력의 코드 의미를 유지하도록 안내한다. 티커·통화·표시 기간·파라미터·출처/조회 시각·origin·경고를 함께 보여준다. 실제 Host parser/
catalog validator를 통과한 프로그램만 presentation으로 반환하고 실패 시 텍스트와 계산 상태를 보존한다.
후속 질문 3개는 별도 추천 단계에서 생성하며 실패는 기존 답변을 무효화하지 않는다.

`langgraph.json` 등록과 exported builder를 사용하는 FastAPI GraphRegistry 양쪽에서 같은 그래프를
사용한다. `/talib-chat`는 고정 graph ID를 사용하는 native chat 진입점이다. 기존 TA와 Canvas의
그래프·도구·화면은 유지한다. 실제 검증과 사용자 요청으로 제외한 브라우저 범위는
[2026-11-16 구현 기록](../../flow/2026-11-16-talib-agent.md)을 따른다.

### TALIB-STARTERS-001: 주제별 시작 질문

`/talib-chat`의 빈 대화는 함수 탐색, 추세, 모멘텀, 변동성, 거래량, 캔들 패턴, 통계·수학·주기,
한국 주식·기간 비교의 8개 그룹과 32개 시작 질문을 제공한다. 첫 그룹을 기본으로 펼치고 나머지는
접어서 탐색한다. 질문을 누르면 표시 제목과 별도로 저장된 실제 프롬프트를 전송하며 실행 중에는
중복 전송을 막는다. 대화가 시작되면 시작 질문을 숨긴다. 전용 페이지의 중복 graph 제목은 표시하지 않는다.

### TALIB-COMPARE-001: 일봉·주봉 비교 완료와 데이터 보존

- TA-Lib 가격 데이터는 `ticker:interval` 키로 보존하고, 기존 ticker 키는 최신 조회의 호환 별칭으로 유지한다. 계산 요청의 별칭 참조는 실행 시 canonical 키로 고정하므로 다른 주기 조회가 앞선 결과를 지우지 않는다. 같은 주기를 새로 조회하면 그 주기에 의존하는 결과와 연쇄 계산만 무효화한다.
- 현재 사용자 요청이 일봉·주봉과 계산/비교를 명시한 경우에만 두 주기 및 명시한 네이티브 함수의 실행 결과를 확인한다. 일부가 누락되면 업무 에이전트를 최대 한 번 더 호출한다. 실제 가격 조회 실패는 자동 반복하지 않으며, 여전히 누락되면 미계산 항목을 명시한다. 일반 자연어 작업 계획기나 무제한 재시도는 추가하지 않는다.
- 모델에 전체 계산 이력의 `origin`·입력 metadata를 전달한다. lookback은 전체 계산 이력에 적용되며 최근 표시 구간의 시작에서 다시 초기화되지 않는다. 현재 UI는 출력 선택형 단일 line/bar 시리즈이며, 캔들·중첩·다중 패널을 제공한다고 설명하지 않는다.
- 회귀와 검증 상태: [TA-Lib 비교 완료 수정 기록](../../flow/2026-11-16-talib-comparison-completion.md).

### TALIB-EVIDENCE-001 / TA-QUERY-DEADLINE-001: 네이티브 의미·근거·조회 제한

TA-Lib SQZMOM squeeze의 정수 상태는 고정 v0.8.3 C 소스의 strict 채널 비교를 따른다(-1 해제,0 겹침·접촉,1 wide,2 normal,3 narrow 압축). 별도 momentum과 혼동하지 않는다. 네이티브 양수 입력 제약은 유지하며 부호 있는 누적 OBV·AD에 요청하지 않은 백분율 ROC를 추가하지 않는다. 명시적 유효 함수 호출은 허용한다. 최근 최대120 계산 봉의 출력·가격·거래량 요약은 공통 `summarize_series`를 사용하고, 날짜·절대 변화·유효 개수와 백분율 제한을 함께 전달한다. canonical 데이터와 ticker 별칭은 같은 operand로 해석한다.

Host chart/catalog Query는 헤더·JSON 본문을 포함한30초 제한과 외부 abort 전파를 적용한다. 완료·실패·취소 후 타이머/listener를 정리한다. Canvas graph는 현재 소스에 등록되어 있으며 provisional/ready의 SDK Query 차단 경계는 유지한다. 과거 프로세스 등록·브라우저 로딩 완료 여부는 소스 검사만으로 단정하지 않는다. [변경과 검증 기록](../../flow/2026-11-16-ta-series-evidence-and-query-deadline.md).

## PRICE-HISTORY-001: 불완전한 가격 도구 이력

price_agent의 요청 추출은 과거 assistant tool call과 뒤따르는 ToolMessage의 ID를 대조한다. 결과 없는 호출과 고아 tool 결과는 모델 입력에서 제외하며 원래 대화 기록은 수정하지 않는다. 정상 호출·결과 쌍은 유지한다. 새 요청 추출 시 과거 error_code/error_message를 초기화하여 이전 실패가 새 도구 실행을 차단하지 않게 한다.

## PRICE-MESSAGES-001: 가격 에이전트 입력

price_agent의 사용자 요청 입력은 messages로 통일하며 query 필드는 제거했다. run_price_agent 문자열 helper는 HumanMessage를 생성한다. 응답 작성 모델은 messages의 최신 HumanMessage와 조회 결과를 받아 사용자 언어로 답변한다. 빈 messages는 invalid_request다. Host graph 입력 예제와 실제 graph 검증 스크립트도 messages 형식을 사용한다.


## TA-CANVAS-004: Grafana 방식 그리드와 반복 추가

`CanvasItem`은 OpenUI children wrapper이고 React `CanvasItemFrame`이 공통 추가 버튼을 제공한다.
primary 버튼은 우측 상단 경계 밖으로 8px 돌출되며 여백으로 내용 겹침·잘림을 방지한다.
DSL의 id/title/children 계약은 유지한다. Canvas 안에서는 추가 콜백을 전달하지 않는다.

패널 instance id와 원본 sourceElementId를 구분한다. 반복 추가는 독립 조회·상태·배치·삭제를 지원하고
인용 질문의 elementId는 원본 sourceElementId를 보낸다. 기존 storage key에서 v1 배열을 읽어
`{version:2,items}`로 이관하며 columns/height를 x/y/w/h로 변환한다.

6-b-4-grafana-grid-system과 같은 react-grid-layout 24열·행28px·간격12px·noCompactor를 적용한다.
헤더 이동, 우측 하단 resize, 키보드 이동/크기 조절, 위치 고정, Esc 취소를 지원한다.
충돌은 고정 패널과 이동 대상 우선으로 배치한 뒤 겹친 패널을 아래로 이동한다.
Canvas 너비600px 미만은 단일열 projection으로 표시하고 저장된 desktop layout을 덮어쓰지 않는다.
이동/resize 종료 시 저장하며 초기 렌더링·단순 너비 변경은 좌표를 저장하지 않는다.
참조의 그리드 규칙을 이식하며 기존 대화별 localStorage와 인용·PDF 기능을 유지한다.
참조 앱의 탭·서버 저장·명령 API 전체를 도입한 것은 아니다.
[검증 기록](../../flow/2026-11-17-canvas-grafana-grid.md).

## PRICE-RESPONSE-LLM-001: 가격 답변 생성

format_response는 async LLM 노드다. 최신 사용자 요청과 구조화한 조회 결과(종목·통화·주기·조회 시각·날짜별 가격·장중 여부·오류 코드)를 도구가 연결되지 않은 모델에 전달하고 반환 메시지를 messages와 response에 반영한다. 고정 Markdown 포맷과 언어별 오류 문구 조립은 제거했다. close 기준·가격 창작 금지·장중 표시·오류 설명을 prompt로 지시한다. 오류가 있으면 과거 prices를 전달하지 않는다. 정상 요청은 추출1회+답변1회 모델 호출이며 답변 모델 실패는 실행 오류로 전파된다.


## OPENUI-COMPOSE-001: 공통 카탈로그 기반 생성

TA20은 원시 가격/지표 배열 대신 요청 인자와 요약을 전달하고 FinancialChart의 실제 수치는 기존 Query API가 제공한다. TA-Lib은 현재 결과의 출력당 최대120점, 출력 수에 따른 400점 목표와 JSON 60000자 상한의 context를 전달하며 전체 배열은 state에 보존한다. 카탈로그 예시는 구문·조합 안내이고 고정 레이아웃이 아니다.

모델 출력은 parser로 구조를 검증하며 Canvas 요소 식별자는 추가로 강제한다. 설명의 모든 의미·숫자나 Query 조건의 일치까지 parser가 검증하는 것은 아니다. 모델에 전달한 검증된 데이터와 생성 UI의 의미 일치는 별도 품질 관리 대상이다. 모델 UI 생성에 추가 호출과 지연이 발생한다. 고정 업무 action controls는 이 전환 대상이 아니다.

[구현·검증 기록](../../flow/2026-11-17-openui-llm-composition.md).


## OPENUI-FIN-BLOCKS-001: 간결한 차트 화면

조회 조건은 기본 접힘이며 차트와 새로고침은 계속 표시한다. 사용자는 필요할 때 설정을 열고 바꾼다. 지표 요약과 데이터 출처도 독립 접이식 블록이며 모델이 Plot/Summary/Metadata를 별도 조립할 수 있다. Query·계산·재분석 계약은 유지한다. [구체 UI 계약](../tech-shared/1-fe-host/2-frontend-side-architecture.md#openui-fin-blocks-001-접이식-조회와-금융-블록).


## CANVAS-ONBOARD-001: 온보딩 런북

[Canvas A–Z HTML 런북](../../human-docs/3.dynamic-canvas-openui/canvas-system-onboarding-runbook.html)은 현재 구현을 사용자 흐름·서버/브라우저 상태·식별자·Query/LLM 경계·그리드·운영·장애 대응 순서로 설명한다. 외부 CDN 없이 단일 HTML로 동작하며 설명용 실습은 API를 호출하지 않는다. 제품 계약의 기준은 이 시스템 설계와 패키지 stock이다. 2026-11-19 사용자 지정 경로의 HTML 생성 요청에 한해 human-docs 편집 금지의 예외를 적용했으며 기존 goal.md는 변경하지 않았다. [작성·검토 기록](../../flow/2026-11-19-canvas-onboarding-runbook.md).
