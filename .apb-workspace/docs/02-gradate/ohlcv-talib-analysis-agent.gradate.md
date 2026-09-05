# ohlcv-talib-analysis-agent Gradate

## Design

기술 분석 기능을 세 계층으로 분리한다. `domains`는 Yahoo Finance 가격 에이전트와
기술 분석 에이전트가 사용할 라이브러리 중립 분석 계약을 소유한다. 공통 가격 bar는
`graph.shared.value_objects.PriceData`가 소유한다. `infrastructure.technical_analysis.talib`만 Python `talib`와 NumPy를 알고,
공식 TA-Lib 카테고리별 하위 디렉터리에서 지표를 계산한다. LangGraph 서브그래프는
`TechnicalAnalysisEngine` 포트만 호출하며, 단일 공개 툴과 명시적 StateGraph 노드를
통해 Standard API stream에서 입력 검증, 툴 호출, 결과 상태, 최종 응답을 추적할 수 있게 한다.

Yahoo Finance 가격 에이전트는 `prices: list[PriceData]`와 `interval`을 상태로 출력한다.
기술 분석 그래프도 같은 필드명을 입력으로 사용하여 변환 DTO 없이 연결한다. 개별 bar의
Decimal·거래일·OHLCV 불변식은 `PriceData`가 검증하고, 목록의 동일 종목/통화/거래소/
시간대 및 거래일 오름차순은 `validate_price` 노드가 검증한다.

## Implementation Draft

### Architecture Overview

```text
LangGraph Standard API / price_agent output
  {messages, prices: list[PriceData], interval}
          |
          v
  validate_price ---------------------- invalid --> render_input_error --> END
          |
          v valid
      call_model <-----------------------------------+
          |                                          |
          | tool call: indicators only               |
          v                                          |
  ToolNode(analyze_ohlcv_with_talib)                 |
          | InjectedState.price                      |
          v                                          |
  TechnicalAnalysisEngine (domain port)              |
          |                                          |
          v                                          |
  TaLibAnalysisEngine                                |
          |                                          |
          +--> overlap/momentum/volatility/volume    |
          |                                          |
          +--> full AnalysisResult in graph state ---+
               compact ToolMessage to model
```

허용 의존성은 `graph -> domains <- infrastructure`이다. 그래프의 `composition.py`만
구체 `TaLibAnalysisEngine`을 선택해 툴 팩토리에 주입한다. `import talib`는
`src/infrastructure/technical_analysis/talib/` 아래에서만 허용한다.

### Modules

| Module | Responsibility | Public interface |
| --- | --- | --- |
| `graph.shared.value_objects.price_data_vo` | Yahoo/기술 분석 공통 불변 일봉 bar | `PriceData` |
| `domains.technical_analysis.models` | 지표 요청·결과·오류의 라이브러리 중립 모델 | `IndicatorRequest`, `IndicatorOutcome`, `AnalysisResult` |
| `domains.technical_analysis.ports` | 분석 엔진 의존성 역전 포트 | `TechnicalAnalysisEngine` |
| `domains.technical_analysis.errors` | 안전한 오류 코드와 도메인 예외 | `TechnicalAnalysisError`, `InvalidIndicatorParameters` |
| `infrastructure.technical_analysis.talib.normalization` | ndarray/NaN/다중 출력을 JSON 안전 시계열로 변환 | `normalize_outputs` |
| `infrastructure.technical_analysis.talib.categories.overlap_studies` | SMA, EMA, BBANDS 계산 | `calculate_sma`, `calculate_ema`, `calculate_bbands` |
| `infrastructure.technical_analysis.talib.categories.momentum_indicators` | RSI, MACD, ADX 계산 | `calculate_rsi`, `calculate_macd`, `calculate_adx` |
| `infrastructure.technical_analysis.talib.categories.volatility_indicators` | ATR 계산 | `calculate_atr` |
| `infrastructure.technical_analysis.talib.categories.volume_indicators` | OBV 계산 | `calculate_obv` |
| `infrastructure.technical_analysis.talib.registry` | 지표 이름을 허용된 계산기와 카테고리에 매핑 | `INDICATOR_REGISTRY`, `get_indicator_calculator` |
| `infrastructure.technical_analysis.talib.engine` | OHLCV 배열 변환, 복수 지표 실행, 결과 병합 및 오류 변환 | `TaLibAnalysisEngine.analyze` |
| `graph.subgraph.technical_analysis.state` | 메시지 reducer와 구조화 가격/결과 상태 | `TechnicalAnalysisState` |
| `graph.subgraph.technical_analysis.tools.analyze` | 단일 공개 LangChain 툴, 상태 주입, Command 갱신 | `create_analyze_ohlcv_tool` |
| `graph.subgraph.technical_analysis.node.validate_price` | 직렬화/객체 `PriceData` 목록과 시계열 일관성 검증 | `validate_price` |
| `graph.subgraph.technical_analysis.node.render_input_error` | 결정론적 입력 오류 AIMessage 생성 | `render_input_error` |
| `graph.subgraph.technical_analysis.node.call_model` | 툴 바인딩 모델 호출 | `create_call_model_node` |
| `graph.subgraph.technical_analysis.routing.after_validation` | 검증 결과 조건부 라우팅 | `route_after_validation` |
| `graph.subgraph.technical_analysis.workflow` | 명시적 노드·엣지 구성 및 컴파일 | `build_technical_analysis_graph`, `technical_analysis_graph` |
| `graph.subgraph.technical_analysis.composition` | 기본 모델·TA-Lib 엔진 조립 | `build_default_dependencies` |

### Interfaces

```python
@dataclass(frozen=True, slots=True)
class PriceData:
    symbol: str
    trading_date: date
    timezone: str
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    adjusted_close: Decimal | None
    volume: int
    currency: str
    exchange: str | None
    fetched_at: datetime | None
    is_partial: bool

class IndicatorRequest(BaseModel):
    name: Literal["SMA", "EMA", "BBANDS", "RSI", "MACD", "ADX", "ATR", "OBV"]
    parameters: dict[str, int | float] = {}

class IndicatorOutcome(BaseModel):
    name: str
    category: str
    status: Literal["success", "error"]
    parameters: dict[str, int | float]
    series: dict[str, tuple[float | None, ...]]
    latest: dict[str, float | None]
    error_code: str | None
    error_message: str | None

class AnalysisResult(BaseModel):
    symbol: str
    interval: str
    points: int
    indicators: tuple[IndicatorOutcome, ...]
    warnings: tuple[str, ...]

class TechnicalAnalysisEngine(Protocol):
    def analyze(
        self,
        prices: Sequence[PriceData],
        interval: str,
        indicators: Sequence[IndicatorRequest],
    ) -> AnalysisResult: ...

def create_analyze_ohlcv_tool(
    engine: TechnicalAnalysisEngine,
    recent_points: int = 5,
) -> BaseTool: ...

def build_technical_analysis_graph(
    *,
    model: BaseChatModel,
    engine: TechnicalAnalysisEngine,
): ...
```

범용 툴의 모델 공개 스키마에는 `indicators`만 나타난다. `price`와 tool call id는
`InjectedState`/`InjectedToolCallId`로 주입한다. 툴은 `Command`를 반환하여 전체
`AnalysisResult`를 `analysis_result`에 기록하고, 동일 tool call id의 `ToolMessage`에는
최근 구간과 최신 값만 JSON으로 넣는다.

### Dependencies

- Add runtime dependency: `TA-Lib` (Python wrapper and bundled/installed native library)
- Transitive/runtime numeric dependency: NumPy
- Existing: Pydantic 2.x for frozen Value Objects and structured schemas
- Existing locked runtime: LangGraph 1.2.7 (`StateGraph`, `ToolNode`, `InjectedState`, `Command`)
- Existing: `langchain-core` tool/message/model abstractions through current LangGraph stack
- Existing: `ChatGptOauthProxyProvider` for the default live model
- Test: pytest, pytest-asyncio and fake chat model/engine; live model tests are opt-in

### Data Flow

1. Standard API/graph caller submits `messages`, JSON-compatible `prices`, and `interval`.
2. `validate_price` restores/accepts frozen `PriceData` objects and validates the series; failures populate
   `validation_errors` and route to `render_input_error`.
3. `call_model` receives messages plus price metadata, but not the full OHLCV arrays in the
   prompt. The bound tool schema lets the model select one or more allowed indicators and
   parameters in a single call.
4. `tools` executes `analyze_ohlcv_with_talib`. Injected state supplies `prices` and `interval` without
   asking the model to copy it into tool arguments.
5. `TaLibAnalysisEngine` converts `PriceData` Decimal fields to float64 arrays, resolves each request through the
   registry, invokes the correct category calculator, normalizes NaN to `None`, and preserves
   an output entry for every requested indicator.
6. The tool stores full series in `analysis_result` and returns a compact ToolMessage containing
   parameters, status, latest values, and the last five output points.
7. `call_model` uses only that ToolMessage to produce a grounded interpretation. If no further
   tool call exists, `tools_condition` routes to END.
8. `langgraph.json` exposes the compiled object as `technical_analysis_graph` alongside
   `main_graph`.

## Gap Analysis (Pre-Validate)

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| Common Yahoo/technical-analysis Value Object | `src/graph/shared/value_objects/price_data_vo.py:PriceData`, shared `prices` state | Matched |
| Domain analysis contracts and engine port | `src/domains/technical_analysis/{models,ports,errors}.py` | Matched |
| Four TA-Lib category boundaries and eight indicators | `src/infrastructure/technical_analysis/talib/categories/` with SMA, EMA, BBANDS, RSI, MACD, ADX, ATR, OBV | Matched |
| TA-Lib registry, normalization, engine | `registry.py`, `normalization.py`, `engine.py:TaLibAnalysisEngine` | Matched |
| Single state-injected LangChain tool | `tools/analyze.py:create_analyze_ohlcv_tool`; public schema exposes only `indicators` | Matched |
| Explicit validation/model/tool LangGraph nodes | `validate_price`, `render_input_error`, `call_model`, `ToolNode`, conditional edges in `workflow.py` | Matched |
| `technical_analysis_graph` dev-server registration | `langgraph.json`; dev API assistant search returned `technical_analysis_graph` | Matched |
| Unit, integration, architecture, graph tests | 14 scoped PASS; 94 full-project PASS, 7 environment SKIP; 94% scoped coverage | Matched |

Overall Match Rate: **100%** (8 matched / 8 designed, gap 0%).

## Implementation Notes

- `create_react_agent` is not used; the current runtime marks it deprecated and explicit nodes
  provide clearer Standard API stream events.
- The default graph object may instantiate the provider but must not perform a network call at
  import time.
- Each category calculator owns its parameter allowlist/defaults and output names. Unknown
  parameters fail before invoking TA-Lib.
- One indicator failure becomes an error outcome without deleting successful sibling outcomes.
- No technical analysis result is presented as investment advice or a future-price guarantee.
- The initially proposed duplicate `domains.market_data.OHLCVPrice` was removed after the shared
  Yahoo agent contract appeared. The implementation uses `graph.shared.value_objects.PriceData`
  directly, so this is an aligned design correction rather than an extra module.
- Live dev-server model execution completed directly through the healthy OAuth proxy on port
  `18741`. The project provider default, `.env`, and `.env.example` use the same port. The model
  requested only SMA(20), RSI(14), and MACD(12/26/9), the tool returned TA-Lib values, and the
  final response stayed grounded in those values.
