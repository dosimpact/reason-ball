# yahoo-finance-price-agent-subgraph Gradate

## Design

`langgraph-fast` 프로젝트에 Studio에서 독립 실행 가능한 가격 조회 서브그래프를 추가한다.
LLM은 사용자 요청을 Yahoo Finance 툴콜로 변환하는 한 번의 호출에만 사용한다. 이후
`ToolNode`가 인메모리 TTL 캐시를 거쳐 `yfinance`를 실행하고, 결과를 불변 `PriceData`
목록으로 정규화한다. 수집 노드와 결정적 Markdown 포매터가 일반 종가(`Close`) 기준의
최신 10개 일봉과 변동률을 반환한다. 기존 `main_graph` workflow는 변경하지 않는다.

## Implementation Draft

### Architecture Overview

```text
LangGraph Dev / Studio
        │
        ▼
price_agent_graph
START → extract_request ──tool call──→ yahoo_finance_tools (ToolNode)
                │                              │
                │ missing/error                ▼
                └──────────────────→ collect_price_data
                                               │
                                               ▼
                                        format_response → END

yahoo_finance_tools
  → @cached_price_data
  → PriceCache Protocol
  → InMemoryPriceCache (TTL 60s, maxsize 128, per-key single-flight)
  → cache miss only: yfinance.Ticker.history(auto_adjust=False)
  → tuple[PriceData, ...]
```

- `price_agent_graph`는 `langgraph.json`의 독립 `price_agent` entry로 등록한다.
- `extract_request`는 `get_historical_prices`를 bind한 모델을 정확히 한 번 호출한다.
- `ToolNode`는 JSON content와 typed artifact를 함께 전달한다.
- `collect_price_data`는 artifact를 상태 계약으로 옮기고 최종 정렬/개수를 보장한다.
- `format_response`는 네트워크와 LLM 없이 Markdown을 생성한다.
- 공유 VO와 캐시는 `graph.shared` 아래에 두어 향후 다른 노드가 재사용한다.

### Modules

| Module | Responsibility | Public Interface |
| --- | --- | --- |
| `graph.shared.value_objects.price_data_vo` | 불변 일봉 값, 불변조건, JSON 직렬화 | `PriceData` |
| `graph.shared.cache.price_cache` | 캐시 backend 계약과 lookup 결과 | `PriceCache`, `CacheLookup` |
| `graph.shared.cache.in_memory_price_cache` | TTL/LRU 저장소, thread safety, invalidation | `InMemoryPriceCache` |
| `graph.shared.cache.price_data_cache_decorator` | 정규화 키, 성공 결과 캐시, per-key single-flight | `cached_price_data`, `build_price_cache_key` |
| `graph.subgraph.price_agent.state` | 그래프 state와 메시지 reducer | `PriceAgentState` |
| `graph.subgraph.price_agent.prompts.ticker_extraction` | 단일 LLM 호출 및 툴 사용 규칙 | `TICKER_EXTRACTION_PROMPT` |
| `graph.subgraph.price_agent.tools.yahoo_finance` | yfinance 패칭, DataFrame 매핑, 툴 content/artifact | `get_historical_prices`, `fetch_historical_prices` |
| `graph.subgraph.price_agent.node.extract_request` | LLM 1회 호출, 툴콜 생성 | `extract_request` |
| `graph.subgraph.price_agent.node.collect_price_data` | ToolMessage artifact 검증 및 state update | `collect_price_data` |
| `graph.subgraph.price_agent.node.format_response` | Close 변동률과 Markdown/오류 응답 | `format_response` |
| `graph.subgraph.price_agent.workflow` | StateGraph 조립, 조건부 라우팅, 실행 helper | `price_agent_graph`, `run_price_agent` |

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
    exchange: str | None = None
    fetched_at: datetime | None = None
    is_partial: bool = False

    def to_json_dict(self) -> dict[str, JSONScalar]: ...
    @classmethod
    def from_json_dict(cls, payload: Mapping[str, object]) -> "PriceData": ...
```

불변조건:

- symbol/currency/timezone은 trim 후 비어 있지 않아야 한다.
- OHLC는 0 이상이고 `low <= high`여야 한다. Yahoo의 장중 미완성 일봉은 일시적으로
  `open > high` 같은 원본 상태를 반환할 수 있어 open/close의 범위 포함은 강제하지 않는다.
- `adjusted_close`가 있으면 0 이상, volume은 0 이상이어야 한다.
- 직렬화 시 Decimal은 문자열, date는 ISO-8601, 복원 시 원 타입으로 되돌린다.

```python
class PriceCache(Protocol):
    def get(self, key: str) -> CacheLookup: ...
    def set(self, key: str, value: tuple[PriceData, ...], ttl_seconds: float) -> None: ...
    def invalidate(self, key: str) -> None: ...
    def clear(self) -> None: ...
```

```python
def cached_price_data(*, cache: PriceCache, ttl_seconds: float):
    """Cache successful immutable price tuples and expose hit metadata."""
```

```python
@tool(response_format="content_and_artifact")
def get_historical_prices(symbol: str, interval: str = "1d", count: int = 10):
    """Return JSON content plus an artifact containing PriceData values and metadata."""
```

Tool artifact contract:

```text
prices: tuple[PriceData, ...]
symbol: str
currency: str
exchange: str | None
fetched_at: datetime
cache_hit: bool
cache_key: str
error_code: str | None
error_message: str | None
```

`PriceAgentState` fields:

```text
messages, query, symbol, interval, count, prices, currency, exchange,
fetched_at, cache_hit, cache_key, error_code, error_message, response
```

### Dependencies

- Existing: Python 3.11+, `langgraph`, `langchain-core`, `langchain-openai`, pytest.
- New runtime dependency: `yfinance` added through `uv add yfinance` and locked in `uv.lock`.
- No cache library is required; TTL/LRU/single-flight use standard-library `threading`,
  `time.monotonic`, and `collections.OrderedDict`.
- Existing model provider: `graph.provider.ChatGptOauthProxyProvider`.
- Configuration: `PRICE_CACHE_TTL_SECONDS` default `60`, `PRICE_CACHE_MAXSIZE` default `128`.
- External service: Yahoo Finance endpoints accessed through `yfinance`.

### Data Flow

1. Studio invokes `price_agent_graph` with a `HumanMessage` or `run_price_agent(message)`.
2. `extract_request` binds `get_historical_prices` with required tool choice and invokes the LLM once.
3. The model emits `symbol`, `interval="1d"`, `count=10`; missing toolcalls route to formatter error.
4. `ToolNode` invokes the price tool. The tool normalizes the cache key.
5. Cache hit returns the immutable tuple immediately with `cache_hit=true`.
6. Cache miss enters per-key single-flight; one caller executes `yfinance` in the ToolNode executor.
7. The adapter requests enough daily history (`period="1mo"`, `auto_adjust=False`, `actions=False`),
   maps valid rows to `PriceData`, marks the current trading-date row partial when applicable,
   sorts ascending, and keeps the latest requested count.
8. Successful non-empty results are cached; errors and empty results are not cached.
9. Tool content is JSON-compatible for Studio; artifact retains the typed `PriceData` tuple.
10. `collect_price_data` validates the artifact and updates graph state.
11. `format_response` calculates `(last Close / first Close - 1) * 100`, emits chronological
    Markdown, includes currency and partial-bar warning, or emits a safe error response.
12. Graph terminates without a second LLM call.

Error codes:

```text
tool_call_missing, invalid_request, symbol_not_found, empty_data,
provider_timeout, provider_rate_limited, provider_error, invalid_provider_data,
invalid_tool_artifact
```

## Gap Analysis (Pre-Validate)

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| Shared `PriceData` VO | `src/graph/shared/value_objects/price_data_vo.py`, package export, VO unit tests | Matched |
| Cache Protocol + in-memory TTL/LRU/single-flight | `price_cache.py`, `in_memory_price_cache.py`, `price_data_cache_decorator.py`, cache tests | Matched |
| Yahoo Finance tool and typed artifact | `tools/yahoo_finance.py`; raw `Close`, `auto_adjust=False`, structured artifact/errors, live CPNG smoke | Matched |
| Single-call LLM extraction node | `node/extract_request.py`; required tool choice and one `ainvoke`, mocked call-count test | Matched |
| Collection and deterministic formatter nodes | `node/collect_price_data.py`, `node/format_response.py`, node unit tests | Matched |
| Compiled independent graph and LangGraph config | `workflow.py`, independent `langgraph.json` `price_agent` entry, LangGraph Dev load smoke | Matched |
| Unit/integration tests for V1-V18 | 28 feature tests; full project result `93 passed, 7 skipped` | Matched |

### Gap Summary

- Missing design items: 0
- Extra implementation items: 0
- Matched design items: 7/7
- Match rate: **100%** (`matched / total design items`)
- Gate result: **PASS** — missing rate 0% is below the Validate threshold of 1%.

## Implementation Notes

- Preserve all unrelated user changes in the dirty worktree.
- Restrict implementation to `20-portfolio/1-reason-hwang/3-langgraph-fast/` plus PGV docs.
- Do not modify `src/graph/main_graph/workflow.py`.
- Mock the model and yfinance in deterministic tests; reserve live Yahoo and Studio checks for smoke validation.
- Use `pnpm test`, `pnpm lint`, and `pnpm typecheck` as committed project commands.
