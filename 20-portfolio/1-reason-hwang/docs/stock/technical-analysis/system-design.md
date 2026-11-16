# 기술적 분석 시스템 설계

## 실행 경계

`3-langgraph-fast/langgraph.json`에 기존 `technical_analysis_agent`와 별도 `technical_analysis_canvas_agent`를 등록한다. 두 그래프는 LangGraph development runtime과 실제 그래프 builder를 PostgreSQL saver로 컴파일하는 FastAPI 런타임에서 실행한다. `/langgraph-dev-chat`은 `/api/langgraph-runtime` 및 `LANGGRAPH_RUNTIME_API_URL`(기본 2982), `/fastapi-chat`은 `/api/fastapi-langgraph` 및 `FASTAPI_RUNTIME_API_URL`(기본 2981)을 사용한다. 대화·실행·기록·차트 Query는 해당 런타임에 고정하며 서로 fallback하거나 개발 서버 기록을 이관하지 않는다. [공용 런타임 계약](../tech-shared/system-design.md#fastapi-runtime-001-독립-실행-경계)을 따른다.

```text
/langgraph-dev-chat → /api/langgraph-runtime → development runtime
/fastapi-chat → /api/fastapi-langgraph → FastAPI + PostgreSQL checkpoints
  technical_analysis_agent → Deep Agent tools → deterministic inline presentation
  technical_analysis_canvas_agent → route/tools → AI layout → canvas custom events
```

기존 primary graph 소유 경로는 `3-langgraph-fast/src/graph/primary_graphs/technical_analysis_agent/`, Canvas 전용 경로는 `technical_analysis_canvas_agent/`이다. 상태는 DeepAgentState를 확장하며 full prices, price_request, price_metadata, indicators, analysis_result, analysis_error, presentation을 가진다. prepare는 매 turn의 결과/표시만 지워 오래된 결과가 새 답변으로 노출되지 않게 한다.

## 도구와 계산

- `get_price_ohlcv(ticker, interval="1d", count=120)`: 기존 Yahoo 어댑터 및 TTL/single-flight 캐시 재사용. 전체 배열은 Command로 state에 기록하고 모델에는 메타데이터만 반환한다.
- `analyze_ohlcv_with_talib(indicators=None)`: 주입 state로 계산한다. 설정 생략 시 기존 설정 또는 세 기본 지표를 사용한다. 준비 구간이 모자라면 같은 가격 조건으로 더 긴 이력을 조회한다. 전체 결과는 state, 최신값·시그널은 ToolMessage로 전달한다.

기존 TA-Lib 엔진 지표를 유지하며 에이전트 도구는 TA-INDICATORS-020의 20종 및 복수 인스턴스를 받는다. 자연어 전체 선택은 `all_indicators=True`, 구조화 재분석은 inline의 `input.analysis_request` 또는 Canvas의 `input.canvas_context.request`를 사용해 설정을 모델이 다시 해석하지 않고 그대로 계산한다. 시그널과 화면 데이터 구성은 `domains/technical_analysis/report.py`, `presentation.py`의 순수 로직이다. 캐시 키는 ticker·interval·조회 개수·auto_adjust를 구분한다. 일반 가격 어댑터의 최대 요청 개수는 5000이다. 누적 지표 전용 경로는 2000-01-01 고정 origin에서 실제 이력을 조회하며 20000행 초과 시 오류를 반환한다. 표시 개수는 OpenUI validator의 60000자 제한을 고려해 200개로 제한한다. 차트는 하나의 날짜별 bars 배열을 공유한다.

## OpenUI와 Host 계약

기존 inline TA는 결정적 OpenUI 프로그램을 기존 Host parser로 검증해 presentation으로 반환한다. 별도 Canvas의 TA-CANVAS-001은 결정적 가격·지표 Query panel/근거 데이터를 보존하고, 별도 모델 composer가 허용된 layout/prose만 구성한 뒤 기존 Host parser/catalog validator로 검증한다. 모델은 가격 배열·Query·지표 수치를 새로 정의하지 않으며 taPanel/taSignals를 각각 한 번 포함한다. 다른 OpenUI 호출자의 기본 생성 경로는 유지한다.

`technical_analysis_canvas_agent`만 custom canvas event와 `canvas_reports` snapshot으로 보고서를 전달한다. 기존 `technical_analysis_agent`와 다른 graph의 `presentation = {id, program}` 경로는 유지한다. `/langgraph-dev-chat`은 공통 `AgentConversation`의 OpenUI AgentInterface·Composer·메시지 목록을 사용하며, 기존 TA는 inline 본문과 검증된 OutputView를 표시한다. Canvas TA는 canvas에서 검증된 보고서를 표시하고 채팅에는 짧은 안내와 도구 타임라인을 남긴다. 그래프 선택과 LangGraph SDK 전송은 기존 ChatProvider가 유지한다. values는 snapshot으로 교체하며 delta처럼 누적하지 않는다. 그래프 선택 목록은 runtime assistant 검색을 페이지별로 조회해 모든 등록 graph를 표시한다. 채팅과 구조화 JSON 입력 모드를 구분하며 서브그래프도 JSON 입력과 원본 결과로 테스트할 수 있다. 기술적 분석 에이전트는 채팅 모드를 유지한다.

## 실행과 검증

프로젝트 루트에서 별도 터미널로 실행한다.

```sh
pnpm -C 3-langgraph-fast dev:langgraph
pnpm -C 1-fe-host dev
```

현재 로컬 포트 프로필은 runtime 2982, Host 2983이다. 모델 설정은 Python 패키지 `.env`의 기존 OpenAI 호환 설정을 사용한다. `LANGGRAPH_INTERNAL_API_URL=http://127.0.0.1:2982`와 `SEC_CHAT_UI_VALIDATOR_URL=http://127.0.0.1:2983/api/sec-ui/validate`를 맞춘다. 사용자 UI는 `http://127.0.0.1:2983/langgraph-dev-chat`이다. 코드의 fallback 포트와 실제 환경 프로필은 구분한다.

```sh
pnpm -C 3-langgraph-fast test tests/test_technical_analysis_agent.py tests/graph/subgraph/price_agent tests/infrastructure/technical_analysis tests/graph/shared/cache
pnpm -C 1-fe-host typecheck
pnpm -C 1-fe-host lint
pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/chat/ui/GraphSelector.stories.tsx src/_pages/chat/ui/ChatMessageList.stories.tsx
# from 3-langgraph-fast/bruno-api-tests:
../node_modules/.bin/bru run 19-technical-analysis --env local --env-var baseUrl=http://127.0.0.1:2982
```

Bruno는 실제 Yahoo·모델·Host validator 연결이 필요하다. 테스트용 thread/assistant를 생성하고 삭제한다. 필수 검증과 정리 원칙은 [검증 지도](../../validation/INDEX.md), 실행 증거는 [flow](../../flow/2026-11-08-technical-analysis-agent.md)에 기록한다.


## TA-VAL-20261114: 실제 브라우저 검증과 관찰된 제한

실제 Yahoo·모델·TA-Lib·OpenUI 경로에서 AAPL 일봉/주봉, RSI7·SMA60 후속 변경, 삼성전자 KRW, 200봉, 잘못된 티커 안내, EMA·5분봉 범위 제한, 그래프 변경 시 격리와 모바일 390px 차트를 확인했다. [검증 기록](../../flow/2026-11-14-technical-analysis-browser-validation.md)에서 PNG 보고서와 결과에 연결한다.

관찰된 제한: 로컬 FE 환경이 runtime 대신 2981을 가리키면 분석이 실행되지 않는다. 분석 본문은 공통 ConversationText의 Markdown 렌더러를 사용하며, OpenUI 차트는 기존 검증 결과를 표시한다. 이전 Markdown 원문 노출은 OPENUI-CHAT-DS-001에서 수정했다. 잘못된 지표 기간 요청은 경고 후 기본 설정으로 계산할 수 있어, 사용자 설정 확인 UX는 후속 개선 대상이다. 이번 검증에서는 코드·환경파일을 수정하지 않았다.

## TA-QUERY-001: 조회 API와 차트 runtime

`GET /technical-analysis/chart`는 FastAPI router와 `langgraph.json`의 독립 `http.app` 양쪽에 등록된다. 브라우저는 선택 런타임의 Host `/api/langgraph-runtime/technical-analysis/chart` 또는 `/api/fastapi-langgraph/technical-analysis/chart`를 호출한다. 모델·thread·run을 만들지 않는 Yahoo/TA-Lib 읽기 API이며 기존 완료 봉·수정주가·TTL 캐시와 warmup 계산을 재사용한다.

요청은 `ticker`, `interval`(1d/1wk), `count`(2~200), 쉼표로 구분한 `indicators`(SMA/RSI/MACD의 중복 없는 선택), `sma_period`, `rsi_period`, `macd_fast`, `macd_slow`, `macd_signal`이다. 기간 범위는 기존 TA-002와 같다. ticker는 필수이며 기본 조회는 일봉120개, SMA20·RSI14·MACD12/26/9다. 잘못된 설정은422, 없는 ticker/빈 데이터는404, 그 외 공급자 실패는503이다. 응답은 `Cache-Control: no-store`를 사용한다.

응답은 source/symbol/currency/exchange/timezone/interval/auto_adjust/fetched_at/cache_hit/source_url metadata와 `as_of`, `parameters`, `indicators`, `warnings`, `requested_count`, `available_count`, `bars`를 제공한다. 각 bar는 정렬된 `time`(ISO 날짜), open/high/low/close/volume와 선택한 지표의 sma/rsi/macd/signal/histogram이다. 준비 구간 부족값은 null로 유지하며 모든 값은 같은 날짜 행에 정렬한다.

결정적 프로그램은 최초 `snapshot`, reactive ticker/interval/count, 기본0인 `$chart_refresh_seconds` 및 `Query("technical_analysis_chart", args, snapshot, $chart_refresh_seconds)`를 선언하고 `FinancialChart(chart)`로 표시한다. Host provider는 이 이름과 알려진 인자만 허용한다. 응답은 Zod schema로 검사하며 API 실패는 빈 bars와 오류 안내로 표시한다. SDK의 query key별 결과 격리가 늦게 도착한 다른 설정의 값을 차단하고 프로그램 교체·unmount 시 진행 중인 fetch를 취소하지 않으며 이전 출력의 성공 콜백은 무시한다.

최신 메시지만 opt-in30초 polling을 제공한다. 이전 메시지와 실행 중 메시지는 polling을 멈추며 화면 제거 시 SDK timer와 chart/observer를 정리한다. Lightweight Charts는 candles·volume·SMA·RSI·MACD pane을 공유 시간축으로 그리고 null을 whitespace로 유지한다. Host 테마 변경을 관찰하고 컨테이너 폭에 맞춰 크기를 조정한다. TradingView 저작권·링크를 표시한다.

[구현·검증 기록](../../flow/2026-11-14-openui-query-financial-charts.md)

## TA-QUERY-002: Query 수동 재실행

결정적 프로그램은 ticker/interval/count controls와 FinancialChart를 `QueryPanel([...], Action([@Run(chart)]))`에 함께 배치한다. native OpenUI `@Run`이 `chart` Query statement의 cache를 invalidate하므로 동일 인자로도 새 HTTP 조회가 발생한다. QueryPanel은 SDK query loading·streaming 상태를 사용해 접근 가능한 refresh 버튼과 pending 상태를 표시하며, 모델 action으로 전송하지 않는다. polling·state 격리·unmount 정리 정책은 TA-QUERY-001과 같다.

[변경·검증 기록](../../flow/2026-11-14-openui-query-manual-refresh.md)

## CHAT-ACTIVITY-001: 도구 실행 현황

Host `/langgraph-dev-chat`은 기존 values snapshot의 이번 turn tool_calls/tool 메시지를 연결해 `get_price_ohlcv`, `analyze_ohlcv_with_talib` 등의 실제 실행 이름과 상태를 OpenUI BehindTheScenes로 표시한다. 원본 도구 인자·결과·중간 AI 설명을 추가 노출하지 않는다. 조회 API와 Query의 모델 없는 갱신 경계는 유지한다. [Host 계약](../tech-shared/1-fe-host/open-ui.md#chat-activity-001-chat-behind-the-scenes)을 따른다.

## TA-CANVAS-001: 별도 Canvas 에이전트의 보고서 이벤트와 상태

입력 `canvas_context`는 선택 `reportId`와 선택적 구조화 `request`를 사용한다. request는 ticker, interval(1d/1wk), strict 정수 count(2~200), 중복 없는 RSI/SMA/MACD 설정 목록이다. 존재하지 않는 reportId·잘못된 조건은 도구 조회 전 analysis_error와 안내로 끝내며 custom open을 보내지 않는다. selected report 설명은 그 report의 title/request/asOf/signals만 근거로 사용한다.

분석마다 서버 UUID를 만들고 `channel:"canvas"`, `type`, `reportId`, `payload` custom event를 보낸다. 이벤트는 open→reset.program→delta.delta→validating→ready.program 또는 error.message/fallbackText다. 모델 layout은 실제 astream chunk마다 delta를 보낸다. parser는 전방 참조를 허용하지 않으므로 prefix에 root를 두지 않고 taLayout 뒤 마지막 root assignment를 서버 delta로 붙인다. 서버는 전체 프로그램을 검증하고 실패하면 한 번만 repair한다.

현재 provider가 빈 stream 오류를 내면 한 번의 ainvoke와 전체 layout delta로 fallback한다. 이것은 token 단위 점진 생성이 아니다. 마지막 서버 root delta를 모델 delta로 세지 않는다. 실제 API 검증에서는 이 fallback이 관찰되었으며 현재 환경의 정상 token streaming은 확인되지 않았다.

`canvas_reports[UUID]`는 reportId/title/request/analysis/snapshot/summary/prices/price_request/price_metadata/indicators/program/status를 보존한다. ready는 검증된 프로그램, error는 오류와 가능한 계산 snapshot을 가진다. 신규 분석은 기존 보고서와 별도 id다. Deep Agent의 도구 없는 장문 최종 분석은 채팅에 중복 출력하지 않으며 native 도구 호출·결과와 기존 메시지는 보존한다.

FE는 thread/assistant/run별 이벤트를 격리한다. prefix만 있으면 준비 상태를 표시한다. taLayout draft는 실제 누적 버퍼를 바꾸지 않고 SDK autoClose와 preview 전용 root를 적용한 disposable projection으로 점진 미리보기할 수 있다. canonical root가 아직 없어도 이 provisional preview는 inert·Query provider 없음·action 차단이며 ready에서만 모델 없는 Query를 연결한다. 선택되어 보이는 보고서만 mount하고 close/collapse/전환 시 이전 조회·timer를 해제한다. 재분석은 마지막 성공 Query 조건을 구조화 request로 보내 별도 모델 분석을 수행한다. 기존 chart GET 자체는 thread/run을 만들지 않는다.

[API 실행·제약·정리 기록](../../flow/2026-11-15-ta-dynamic-canvas-implementation.md). 브라우저 동작 검증은 사용자 수행 범위다.

## TA-CANVAS-002: 독립 그래프 계약

기존 TA workflow/state는 inline 구현으로 복원해 canvas 필드를 포함하지 않는다. 신규 Canvas state는 기존 계산 상태를 상속하고 canvas 문맥·보고서 필드만 추가한다. 두 graph는 가격/TA-Lib 도구를 공유하되 기존 graph는 custom canvas 이벤트를 보내지 않고 신규 graph는 inline presentation을 중복 생성하지 않는다. FE의 custom 이벤트·canvas_context·탭·재분석 처리도 신규 ID에만 연결한다. 그래프 전환 때 탭을 비우며 각각 별도 thread를 사용한다.

Canvas API 시나리오 `22-ta-dynamic-canvas`는 신규 ID를 대상으로 하고, `23-ta-agent-split`은 두 ID discovery와 각 출력·상태 격리를 검증한다. [분리 검증 기록](../../flow/2026-11-15-ta-agent-canvas-split.md)을 따른다.

## TA-INDICATORS-020: 버전 카탈로그와 복수 인스턴스

`GET /technical-analysis/catalog`는 `schemaVersion:2`, `catalogVersion`, 지표20종의 기본값·매개변수 범위·series descriptors·`maxInstances:40`·`maxVisiblePanels:4`를 반환한다. v2 차트는 기존 `/technical-analysis/chart`에서 `schema_version=2`와 URL-encoded `instances` JSON 배열(`instanceId?`, `name`, `parameters?`, `showSignal?`)을 받는다. `indicators=all`도 지원한다. URL의 schema_version은 정수로 변환 후 1~2 범위를 검사한다.

v2 응답의 공통 OHLCV `bars`와 `indicators[]`의 인스턴스별 series.values는 같은 날짜·길이를 유지한다. 각 인스턴스는 안정적인 ID, 정규화 parameters, showSignal, panel, status/error/errorCode, signal, series descriptors를 가진다. 동일 지표의 다른 설정은 구분하고 중복 implicit 설정·중복 명시 ID·40개 초과·잘못된 값은422로 거부한다. 원래 schema_version 생략/v1의 SMA/RSI/MACD flat-bar 응답은 호환 유지한다.

누적 origin은 `date`, `availableHistory`, `policy`, `requestedDate`, `baseline`으로 공개한다. OBV는 첫 거래량, PVT는0, AD는 첫 money-flow-volume을 기준으로 계산한다. count는 표시만 자르며 동일 소스 이력의 겹치는 날짜 값이 유지된다. 공급자 이력 수정은 캐시 버전과 origin 정책의 제약으로 명시한다. 지표 수식·EMA seed·lookback·null/분모0·개별 시그널은 [Python 계산 계약](../tech-shared/3-langgraph-fast/ta20.md)을 따른다.

OpenUI는 `technical_analysis_catalog` Query와 `IndicatorControls($chart_instances,catalog)`, reactive 인스턴스 JSON을 사용한다. 서버는 검증된 결과로 최소 DSL을 만들며 초기 fallback에 큰 수치 배열을 삽입하지 않는다. 실제 숫자는 모델 없는 Query로 조회한다. 두 TA 그래프는 같은 계산·설정 계약을 공유하며 inline은 결정적 presentation, Canvas는 UUID별 custom 보고서 표시를 유지한다. 프로토콜·수치·모델 비호출·parser 검증 증거와 사용자에게 맡긴 브라우저 검증 범위는 [당일 기록](../../flow/2026-11-16-fastapi-runtime-and-ta-indicators.md)에 둔다.

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
않게 한다. 계산 결과로 결정적인 inline OpenUI 표와 선택형 출력 상세 차트를 만든다. 전체 결과가
선택 가능하며 모든 배열은 상태에 남긴다. 표시 프로그램은 60,000자 한도에서 출력 수에 따라 차트
표시 봉 수를 제한하고 그 한계를 명시한다. null 차트 값은 보간하지 않고 제외하며 정수 출력은 막대로
표시한다. 티커·통화·표시 기간·파라미터·출처/조회 시각·origin·경고를 함께 보여준다. 실제 Host parser/
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
