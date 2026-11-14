# 기술적 분석 시스템 설계

## 실행 경계

`3-langgraph-fast/langgraph.json`에 `technical_analysis_agent`를 등록한다. Host의 기존 `/api/langgraph` 프록시와 LangGraph SDK의 threads/runs API를 사용한다. 실행 서버는 **LangGraph development runtime**이며 FastAPI의 기본 echo executor에 이 그래프를 등록한 것은 아니다. Host의 `LANGGRAPH_INTERNAL_API_URL`은 해당 runtime을 가리켜야 한다.

```text
/chat → /api/langgraph → technical_analysis_agent
  prepare → Deep Agent(two business tools) → common OpenUI output subgraph
```

primary graph 소유 경로는 `3-langgraph-fast/src/graph/primary_graphs/technical_analysis_agent/`이다. 상태는 DeepAgentState를 확장하며 full prices, price_request, price_metadata, indicators, analysis_result, analysis_error, presentation을 가진다. prepare는 매 turn의 결과/표시만 지워 오래된 결과가 새 답변으로 노출되지 않게 한다.

## 도구와 계산

- `get_price_ohlcv(ticker, interval="1d", count=120)`: 기존 Yahoo 어댑터 및 TTL/single-flight 캐시 재사용. 전체 배열은 Command로 state에 기록하고 모델에는 메타데이터만 반환한다.
- `analyze_ohlcv_with_talib(indicators=None)`: 주입 state로 계산한다. 설정 생략 시 기존 설정 또는 세 기본 지표를 사용한다. 준비 구간이 모자라면 같은 가격 조건으로 더 긴 이력을 조회한다. 전체 결과는 state, 최신값·시그널은 ToolMessage로 전달한다.

기존 TA-Lib 엔진의 다른 지표는 유지하며 새 도구 스키마만 RSI/SMA/MACD로 제한한다. 시그널과 화면 데이터 구성은 `domains/technical_analysis/report.py`, `presentation.py`의 순수 로직이다. 캐시 키는 ticker·interval·조회 개수·auto_adjust를 구분한다. 가격 어댑터 내부 최대 조회 개수는 5000이다. 표시 개수는 OpenUI validator의 60000자 제한을 고려해 200개로 제한한다. 차트는 하나의 날짜별 bars 배열을 공유한다.

## OpenUI와 Host 계약

공통 `build_output_graph`의 선택적 `program_builder` 주입을 사용한다. 기술적 분석은 결정적 OpenUI 프로그램을 생성한 후 기존 Host parser/catalog validator로 검증한다. 다른 호출자의 기본 LLM UI 생성 경로는 유지한다. 이 방식은 모델이 차트 수치를 재작성하지 않게 한다.

최종 values의 `presentation = {id, program}`을 Host가 현재 assistant message ID에 연결한다. `/chat`은 공통 `AgentConversation`의 OpenUI AgentInterface·Composer·메시지 목록을 사용하며, AssistantMessage 확장 렌더러가 분석 본문과 검증된 `OutputView` 차트를 표시한다. 그래프 선택과 LangGraph SDK 전송은 기존 ChatProvider가 유지한다. values는 snapshot으로 교체하며 delta처럼 누적하지 않는다. 그래프 선택 목록은 runtime assistant 검색을 페이지별로 조회해 모든 등록 graph를 표시한다. 채팅과 구조화 JSON 입력 모드를 구분하며 서브그래프도 JSON 입력과 원본 결과로 테스트할 수 있다. 기술적 분석 에이전트는 채팅 모드를 유지한다.

## 실행과 검증

프로젝트 루트에서 별도 터미널로 실행한다.

```sh
pnpm -C 3-langgraph-fast dev:langgraph
pnpm -C 1-fe-host dev
```

현재 로컬 포트 프로필은 runtime 2982, Host 2983이다. 모델 설정은 Python 패키지 `.env`의 기존 OpenAI 호환 설정을 사용한다. `LANGGRAPH_INTERNAL_API_URL=http://127.0.0.1:2982`와 `SEC_CHAT_UI_VALIDATOR_URL=http://127.0.0.1:2983/api/sec-ui/validate`를 맞춘다. 사용자 UI는 `http://127.0.0.1:2983/chat`이다. 코드의 fallback 포트와 실제 환경 프로필은 구분한다.

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

`GET /technical-analysis/chart`는 FastAPI router와 `langgraph.json`의 독립 `http.app` 양쪽에 등록된다. 브라우저는 기존 Host `/api/langgraph/technical-analysis/chart`만 호출한다. 모델·thread·run을 만들지 않는 Yahoo/TA-Lib 읽기 API이며 기존 완료 봉·수정주가·TTL 캐시와 warmup 계산을 재사용한다.

요청은 `ticker`, `interval`(1d/1wk), `count`(2~200), 쉼표로 구분한 `indicators`(SMA/RSI/MACD의 중복 없는 선택), `sma_period`, `rsi_period`, `macd_fast`, `macd_slow`, `macd_signal`이다. 기간 범위는 기존 TA-002와 같다. ticker는 필수이며 기본 조회는 일봉120개, SMA20·RSI14·MACD12/26/9다. 잘못된 설정은422, 없는 ticker/빈 데이터는404, 그 외 공급자 실패는503이다. 응답은 `Cache-Control: no-store`를 사용한다.

응답은 source/symbol/currency/exchange/timezone/interval/auto_adjust/fetched_at/cache_hit/source_url metadata와 `as_of`, `parameters`, `indicators`, `warnings`, `requested_count`, `available_count`, `bars`를 제공한다. 각 bar는 정렬된 `time`(ISO 날짜), open/high/low/close/volume와 선택한 지표의 sma/rsi/macd/signal/histogram이다. 준비 구간 부족값은 null로 유지하며 모든 값은 같은 날짜 행에 정렬한다.

결정적 프로그램은 최초 `snapshot`, reactive ticker/interval/count, 기본0인 `$chart_refresh_seconds` 및 `Query("technical_analysis_chart", args, snapshot, $chart_refresh_seconds)`를 선언하고 `FinancialChart(chart)`로 표시한다. Host provider는 이 이름과 알려진 인자만 허용한다. 응답은 Zod schema로 검사하며 API 실패는 빈 bars와 오류 안내로 표시한다. SDK의 query key별 결과 격리가 늦게 도착한 다른 설정의 값을 차단하고 프로그램 교체·unmount 시 소유 fetch를 취소한다.

최신 메시지만 opt-in30초 polling을 제공한다. 이전 메시지와 실행 중 메시지는 polling을 멈추며 화면 제거 시 SDK timer와 chart/observer를 정리한다. Lightweight Charts는 candles·volume·SMA·RSI·MACD pane을 공유 시간축으로 그리고 null을 whitespace로 유지한다. Host 테마 변경을 관찰하고 컨테이너 폭에 맞춰 크기를 조정한다. TradingView 저작권·링크를 표시한다.

[구현·검증 기록](../../flow/2026-11-14-openui-query-financial-charts.md)

## TA-QUERY-002: Query 수동 재실행

결정적 프로그램은 ticker/interval/count controls와 FinancialChart를 `QueryPanel([...], Action([@Run(chart)]))`에 함께 배치한다. native OpenUI `@Run`이 `chart` Query statement의 cache를 invalidate하므로 동일 인자로도 새 HTTP 조회가 발생한다. QueryPanel은 SDK query loading·streaming 상태를 사용해 접근 가능한 refresh 버튼과 pending 상태를 표시하며, 모델 action으로 전송하지 않는다. polling·state 격리·unmount 정리 정책은 TA-QUERY-001과 같다.

[변경·검증 기록](../../flow/2026-11-14-openui-query-manual-refresh.md)

## CHAT-ACTIVITY-001: 도구 실행 현황

Host `/chat`은 기존 values snapshot의 이번 turn tool_calls/tool 메시지를 연결해 `get_price_ohlcv`, `analyze_ohlcv_with_talib` 등의 실제 실행 이름과 상태를 OpenUI BehindTheScenes로 표시한다. 원본 도구 인자·결과·중간 AI 설명을 추가 노출하지 않는다. 조회 API와 Query의 모델 없는 갱신 경계는 유지한다. [Host 계약](../tech-shared/1-fe-host/open-ui.md#chat-activity-001-chat-behind-the-scenes)을 따른다.
