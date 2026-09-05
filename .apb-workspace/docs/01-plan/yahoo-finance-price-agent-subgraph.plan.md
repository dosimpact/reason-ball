# yahoo-finance-price-agent-subgraph Plan

## Goal

사용자가 자연어로 종목과 기간을 요청하면(예: “쿠팡의 최근 10일간 가격을 알려줘”),
가격 조회 에이전트가 종목을 Yahoo Finance 심볼로 해석하고 일별 가격 데이터를 조회하여
사용자의 언어로 이해하기 쉽게 응답한다. 에이전트는 독립적인 LangGraph 서브그래프로
구현하고 `langgraph dev`에 등록하여 LangSmith Studio에서 그래프 실행, 툴 호출, 결과를
추적하고 테스트할 수 있어야 한다.

## Scope

- Target project root: `20-portfolio/1-reason-hwang/3-langgraph-fast/`
- Target graph package: `20-portfolio/1-reason-hwang/3-langgraph-fast/src/graph/`
- In scope:
  - `src/graph/__init__.py`가 속한 동일 프로젝트의 `src/graph/subgraph/` 아래에 가격 조회 에이전트 패키지 추가
  - 여러 그래프 노드와 AI 에이전트가 쉽게 탐색·재사용할 수 있도록 `src/graph/shared/value_objects/price_data_vo.py`에 공용 `PriceData` Value Object 추가
  - 사용자 자연어에서 회사명/티커, 일봉 간격, 데이터 개수를 구조화해 추출하는 LLM 노드 구현
  - 요청당 LLM 호출은 티커/조회 조건 추출을 위한 1회로 제한하고 이후 조회·정렬·계산·Markdown 생성은 결정적으로 처리
  - `yfinance`를 통해 Yahoo Finance 가격 조회를 캡슐화한 비동기 툴 정의
  - Yahoo Finance 패칭 경계에 TTL 기반 인메모리 캐시 데코레이터를 적용하여 동일 요청의 중복 호출 방지
  - 티커 추출 LLM 노드 → 검증/조건부 라우팅 → Yahoo Finance `ToolNode` → Markdown 포매터 노드로 단방향 흐름 구성
  - 회사명 입력은 LLM이 Yahoo Finance 티커로 1차 변환하고 실제 가격 조회 결과로 유효성을 검증
  - “최근 10일”을 달력일이 아니라 Yahoo Finance에서 조회 가능한 최신 일봉 10개로 해석
  - 충분한 조회 구간에서 유효한 일봉을 날짜 오름차순으로 정렬한 뒤 최신 10개를 선택하며,
    Yahoo Finance가 당일 장중 일봉을 반환하면 미완성 일봉도 최신 데이터로 포함
  - `auto_adjust=False`로 원 OHLC 의미를 보존하고 일반 종가(`Close`)를 사용자 표시 가격과 기간 변동률의 기준으로 사용
  - 원 OHLCV, 참고용 수정 종가, 통화/거래소/조회 구간, 마지막 일봉의 장중 미완성 가능성을 내부 결과에 포함
  - Yahoo/pandas 원본 행은 어댑터에서 `PriceData`로 변환하고 노드 간 가격 전달에는 원시 딕셔너리나 DataFrame을 사용하지 않음
  - 쿠팡(`CPNG`) 예제를 포함한 정상·빈 결과·잘못된 종목·외부 API 오류 처리
  - `langgraph.json`에 가격 에이전트를 독립 그래프로 등록하고 `pnpm dev:langgraph`로 Studio 테스트 가능하게 구성
  - Yahoo Finance 응답은 그대로 노출하지 않고 안정적인 내부 스키마로 정규화
  - 최종 응답은 날짜 오름차순의 Markdown 텍스트와 최신 일반 종가·10개 일봉 구간 변동률 요약으로 생성하며,
    표 형식은 필수로 강제하지 않고 목록 또는 간결한 문단으로도 표현 가능
- Out of scope:
  - 요구사항이 아직 정해지지 않은 두 번째 에이전트 및 두 번째 서브그래프
  - 실시간 틱/호가, 주문 실행, 포트폴리오 관리, 투자 추천 또는 수익률 예측
  - 가격 차트 및 기타 시각화 생성
  - Yahoo Finance 이외의 복수 데이터 공급자 연동 및 장애 시 공급자 자동 전환
  - 장기 가격 데이터 저장, 영속 DB 캐시 구현, 데이터베이스 스키마 변경
  - 기존 FastAPI 표준 API에 새로운 전용 REST 엔드포인트 추가
  - 가격 에이전트를 기존 `main_graph`에 노드 또는 서브그래프로 연결하는 작업
  - `20-portfolio/1-reason-hwang/3-langgraph-fast/` 밖의 애플리케이션, 패키지, 포트폴리오 변경

## Implementation Directory

```text
20-portfolio/1-reason-hwang/3-langgraph-fast/
├── langgraph.json
├── pyproject.toml
├── uv.lock
├── src/
│   └── graph/
│       ├── shared/
│       │   ├── cache/
│       │   │   ├── __init__.py
│       │   │   ├── price_cache.py
│       │   │   ├── in_memory_price_cache.py
│       │   │   └── price_data_cache_decorator.py
│       │   └── value_objects/
│       │       ├── __init__.py
│       │       └── price_data_vo.py
│       └── subgraph/
│           └── price_agent/
│               ├── __init__.py
│               ├── state.py
│               ├── workflow.py
│               ├── node/
│               │   ├── __init__.py
│               │   ├── extract_request.py
│               │   ├── collect_price_data.py
│               │   └── format_response.py
│               ├── prompts/
│               │   ├── __init__.py
│               │   └── ticker_extraction.py
│               └── tools/
│                   ├── __init__.py
│                   └── yahoo_finance.py
└── tests/
    └── graph/
        ├── shared/
        │   ├── cache/
        │   │   ├── test_in_memory_price_cache.py
        │   │   └── test_price_data_cache_decorator.py
        │   └── value_objects/
        │       └── test_price_data_vo.py
        └── subgraph/
            └── price_agent/
                ├── test_extract_request.py
                ├── test_yahoo_finance_tool.py
                ├── test_collect_price_data.py
                ├── test_format_response.py
                └── test_price_agent_workflow.py
```

- `src/graph/shared/value_objects/price_data_vo.py`: 재사용 가능한 불변 `PriceData`와 JSON 직렬화 계약
- `src/graph/shared/cache/price_cache.py`: 현재/향후 캐시 구현이 따를 `PriceCache` Protocol과 캐시 키 계약
- `src/graph/shared/cache/in_memory_price_cache.py`: TTL, maxsize, eviction, single-flight를 제공하는 프로세스 로컬 구현
- `src/graph/shared/cache/price_data_cache_decorator.py`: Yahoo 패칭 함수에 `PriceCache`를 적용하는 재사용 가능 데코레이터
- `src/graph/subgraph/price_agent/state.py`: `PriceAgentState`와 노드 간 상태 필드
- `src/graph/subgraph/price_agent/node/extract_request.py`: LLM 1회 호출로 회사명/티커/간격/개수 구조화 추출
- `src/graph/subgraph/price_agent/tools/yahoo_finance.py`: `yfinance` 조회, 오류 변환, DataFrame → `PriceData` 매핑
- `src/graph/subgraph/price_agent/node/collect_price_data.py`: `ToolMessage` artifact를 검증해 `PriceData` 목록과 오류 상태로 반영
- `src/graph/subgraph/price_agent/node/format_response.py`: `Close` 기준 정렬·변동률 계산·Markdown 생성
- `src/graph/subgraph/price_agent/workflow.py`: 노드와 `ToolNode` 연결 및 `price_agent_graph` 컴파일
- `src/graph/subgraph/price_agent/prompts/ticker_extraction.py`: 티커 추출 전용 시스템 프롬프트
- `langgraph.json`: `price_agent`를 `price_agent_graph`에 매핑하여 Studio 독립 실행 항목으로 등록
- `pyproject.toml`, `uv.lock`: `yfinance` 의존성을 프로젝트 환경에 고정
- `tests/graph/`: 소스 구조를 미러링하여 Value Object, 노드, 툴, 전체 워크플로를 각각 검증

`langgraph.json`의 그래프 등록 목표는 다음과 같다.

```json
{
  "graphs": {
    "main_graph": "./src/graph/main_graph/workflow.py:main_graph",
    "price_agent": "./src/graph/subgraph/price_agent/workflow.py:price_agent_graph"
  }
}
```

위 등록은 Studio에서 두 그래프를 독립적으로 선택하기 위한 것이며 `price_agent_graph`를
`main_graph` 내부에 연결한다는 의미가 아니다.

## Node Structure

```text
START
  │
  ▼
[extract_request]  ← 유일한 LLM 호출, Yahoo Finance 툴 바인딩
  │
  ├─ tool call 있음 ───────────────┐
  │                                ▼
  │                    [yahoo_finance_tools]
  │                     ToolNode + TTL cache
  │                                │
  │                                ▼
  │                    [collect_price_data]
  │                     artifact → PriceData
  │                                │
  └─ tool call 없음/추출 오류 ─────┤
                                   ▼
                         [format_response]
                    Close 기준 Markdown/오류 응답
                                   │
                                   ▼
                                  END
```

### `extract_request`

- 입력: 원본 사용자 메시지
- 처리: `ChatGptOauthProxyProvider` 모델에 `get_historical_prices` 툴을 바인딩하고 한 번만 호출
- 기대 툴 인자: `symbol`, `interval="1d"`, `count=10`
- 출력: 툴콜을 포함한 `AIMessage`; 추출 실패 시 `tool_call_missing` 또는 구조화 오류 상태
- 규칙: 이 노드 이후에는 LLM을 다시 호출하지 않으며 툴 실행 후 에이전트 루프로 되돌아가지 않음

### `yahoo_finance_tools`

- 타입: `ToolNode([get_historical_prices])`
- 입력: `extract_request`가 만든 툴콜
- 처리: 캐시 데코레이터를 먼저 조회하고 miss일 때만 `yfinance`를 비동기 실행 경계에서 호출
- 출력: 사용자/Studio가 확인할 JSON 호환 요약 content와 `PriceData` 목록 artifact를 포함한 `ToolMessage`
- 오류: 잘못된 티커, 빈 데이터, 시간 초과, 속도 제한, 공급자 오류를 안정적인 오류 코드로 변환

### `collect_price_data`

- 입력: `ToolMessage` content/artifact
- 처리: artifact 타입과 `PriceData` 불변 조건을 검증하고 날짜 오름차순 정렬 후 최신 10개 선택
- 출력: `prices`, `symbol`, `currency`, `exchange`, `fetched_at`, `error_code`, `error_message`
- 규칙: 당일 미완성 일봉을 제거하지 않고 `is_partial=True` 상태를 유지

### `format_response`

- 입력: 정규화된 `PriceData` 목록 또는 오류 상태
- 처리: 마지막/첫 `Close`로 기간 변동률을 계산하고 날짜 오름차순 Markdown 생성
- 출력: 최종 `response`
- 규칙: LLM을 사용하지 않으며 표나 차트를 강제하지 않고, 장중 데이터에는 값이 변할 수 있음을 표시

### Conditional routing

- `route_after_extract`: 유효한 `get_historical_prices` 툴콜이 있으면 `yahoo_finance_tools`, 없으면 `format_response`
- `yahoo_finance_tools` 실행 후에는 항상 `collect_price_data`를 거쳐 성공/오류 artifact를 단일 상태 계약으로 정규화
- `collect_price_data` 이후에는 항상 `format_response`로 이동하고 최종적으로 `END`
- 재시도나 다중 툴 호출 루프는 이번 범위에 포함하지 않음

### `PriceAgentState`

```text
messages        # add_messages reducer를 사용하는 Human/AI/Tool 메시지
query           # 원본 사용자 요청
symbol          # LLM이 추출하고 Yahoo 조회로 검증된 티커
interval        # 이번 범위에서는 "1d"
count           # 기본값 10
prices          # list[PriceData]
currency        # 거래 통화
exchange        # 거래소
fetched_at      # 데이터 조회 시각
cache_hit       # 인메모리 캐시 적중 여부
cache_key       # 정규화된 캐시 키
error_code      # 성공 시 None
error_message   # 성공 시 None
response        # 최종 Markdown 문자열
```

## Cache Strategy

- 현재 구현: 프로세스 로컬 `InMemoryPriceCache`
- 향후 구현: 동일 `PriceCache` Protocol을 따르는 영속 `DatabasePriceCache`
- 적용 위치: `yahoo_finance.py`의 실제 데이터 패칭 함수 경계
- 데코레이터: `@cached_price_data(cache=price_cache, ttl_seconds=..., maxsize=...)`
- 기본 설정: `PRICE_CACHE_TTL_SECONDS=60`, `PRICE_CACHE_MAXSIZE=128`
- 캐시 값: 변경 불가능한 `tuple[PriceData, ...]` 및 조회 메타데이터
- 캐시 키: `provider + normalized_symbol + interval + count + auto_adjust`
- 키 예시: `yahoo-finance:CPNG:1d:10:false`
- 시간 측정: 시스템 시각 변경의 영향을 피하도록 TTL 판정에는 monotonic clock 사용
- 저장 조건: 정상 조회이며 하나 이상의 유효한 `PriceData`가 있는 경우만 저장
- 저장 제외: 잘못된 티커, 빈 데이터, 타임아웃, 속도 제한, 공급자 오류
- 동시성: 동일 키의 동시 cache miss는 single-flight/lock으로 한 번만 Yahoo Finance를 호출
- 만료: TTL 경과 시 다음 요청이 새 데이터를 패칭하고 캐시를 교체
- eviction: maxsize 초과 시 가장 오래 사용하지 않은 항목부터 제거
- 관측성: ToolMessage와 `PriceAgentState.cache_hit`에 hit/miss를 남겨 Studio trace에서 확인
- 한계: 프로세스 재시작 시 초기화되고 worker/인스턴스 사이에서 공유되지 않음
- 교체 원칙: 툴과 노드는 `PriceCache` Protocol에만 의존하고 인메모리/DB 저장 방식을 알지 않음

## Verification

- Implementation scope:
  - 가격 에이전트의 상태, 프롬프트, 툴, 워크플로, 패키지 export와 단위 테스트
  - 공용 `PriceData` Value Object, 직렬화 계약, 값 검증과 단위 테스트
  - 인메모리 TTL 캐시, 캐시 데코레이터, single-flight, 만료/eviction 동작과 단위 테스트
  - LangGraph Dev가 로드할 그래프 등록 정보
  - 모든 구현 및 테스트 변경은 `20-portfolio/1-reason-hwang/3-langgraph-fast/` 내부로 제한
- Public interfaces:
  - 컴파일된 `price_agent_graph`
  - `run_price_agent(message: str)` 비동기 실행 함수
  - `get_historical_prices(symbol_or_company: str, days: int = 10)` 툴
  - `PriceData`: 심볼, 거래일/거래소 시간대, 원 OHLC, 참고용 수정 종가, 거래량, 통화, 장중 미완성 여부를 담는 공용 값 타입
  - `PriceCache`: `get`, `set`, `invalidate`, `clear` 동작을 정의하는 교체 가능한 캐시 Protocol
  - `cached_price_data`: `PriceCache`를 주입받아 패칭 결과를 캐시하는 데코레이터
  - 툴 결과 스키마: 해석된 심볼, 회사/거래소, 조회 구간, `PriceData` 목록, 데이터 기준 시각, 오류 코드
- Value Object rules:
  - 프로젝트의 표준 `dataclass` 스타일을 따르되 `@dataclass(frozen=True, slots=True)`로 불변성과 값 동등성을 보장
  - 파일명은 도메인 이름 뒤에 역할 suffix를 붙인 `price_data_vo.py`로 고정하고 `vo_` prefix는 사용하지 않음
  - 클래스명은 `PriceData`, 필드는 Python `snake_case`, 명시적 타입을 사용하고 선택 필드는 `None` 허용 여부를 선언
  - 클래스명에는 `VO` suffix를 붙이지 않고 `graph.shared.value_objects.__init__`에서 `PriceData`를 명시적으로 재노출
  - 모듈과 클래스 docstring에 `shared immutable price data value object` 문구를 포함해 코드 및 AI 검색성을 확보
  - 가격은 부동소수점 계산 오차를 피하도록 `Decimal`, 거래량은 음수가 아닌 `int`, 날짜/시각은 시간대 의미가 보존되는 타입 사용
  - 생성 시 `high >= low`, 음수 가격/거래량 금지, 빈 심볼/통화 금지 등을 검증하되,
    Yahoo 장중 미완성 행의 일시적 `open > high` 가능성 때문에 open/close의 범위 포함은 강제하지 않음
  - 외부 API 호출, DataFrame 의존성, Markdown 포매팅 로직을 Value Object 내부에 넣지 않음
  - LangGraph 상태·Studio 트레이스·체크포인트에서 사용할 수 있도록 명시적인 JSON 호환 직렬화 메서드를 제공
- External dependencies:
  - Yahoo Finance HTTP 엔드포인트를 내부적으로 사용하는 Python `yfinance` 라이브러리
  - LangGraph, LangChain 모델/툴 인터페이스
  - 모델 호출을 위한 기존 OAuth proxy 및 환경 설정
- Internal dependencies:
  - `graph.provider.ChatGptOauthProxyProvider`
  - `graph.shared.value_objects.PriceData`
  - `graph.shared.cache.PriceCache`, `InMemoryPriceCache`, `cached_price_data`
  - 기존 `src/graph/subgraph` 패키지 구조와 `langgraph.json`
  - `pnpm dev:langgraph` 개발 스크립트
- Integration decision:
  - 1단계에서는 `price_agent_graph`를 `langgraph.json`의 독립 그래프로 노출하여 Studio에서 직접 검증
  - Studio 검증이 끝난 뒤 별도 작업에서 `main_graph`에 연결하며, 이번 플랜에서는 해당 연결을 구현하지 않음
  - Yahoo Finance 접근 코드는 툴 내부의 어댑터 경계로 격리하여 향후 직접 HTTP 호출 구현으로 교체 가능하게 유지
  - `yfinance.Ticker.history(..., interval="1d", auto_adjust=False)`로 원 종가와 `Adj Close`를 명시적으로 분리
  - 사용자에게 표시하는 가격과 10개 일봉 구간 변동률은 실제 거래일 가격 의미를 유지하도록 일반 종가(`Close`)를 사용
  - 수정 종가(`Adj Close`)는 `PriceData`에 참고 정보로 보존하지만 이번 응답 계산에는 사용하지 않음
  - 기간 변동률은 `(마지막 Close / 첫 Close - 1) * 100`으로 계산
- Risky areas:
  - Yahoo Finance 엔드포인트/응답 스키마 변경, 속도 제한, 네트워크 실패
  - LLM의 회사명→티커 오해석 및 실제 가격 조회 전까지 티커 유효성을 보장할 수 없는 점
  - `Decimal`, 날짜/시간, 불변 dataclass를 LangGraph 상태와 JSON 트레이스 사이에서 손실 없이 직렬화해야 하는 점
  - 신규 상장 또는 거래 이력이 부족한 종목은 일봉 10개를 채우지 못할 수 있는 점
  - 거래소별 시간대와 장 운영 상태를 바탕으로 마지막 일봉의 미완성 여부를 정확히 표시해야 하는 점
  - `auto_adjust` 기본값 변화로 원 종가와 수정 종가의 의미가 섞일 수 있으므로 값을 명시적으로 요청해야 하는 점
  - 동기 방식인 `yfinance` 호출이 LangGraph 비동기 실행을 막지 않도록 실행 경계를 처리해야 하는 점
  - 장중 가격에 비해 TTL이 길면 오래된 값을 반환할 수 있고 짧으면 Yahoo 호출 절감 효과가 낮아지는 점
  - 인메모리 캐시가 worker/프로세스별로 분리되어 전체 시스템 수준의 일관성을 제공하지 않는 점
  - 동일 키 동시 miss에서 중복 패칭을 막는 lock이 다른 키 요청까지 직렬화하지 않아야 하는 점
  - 툴 실패를 환각된 가격으로 대체하지 않고 명시적 오류로 응답해야 하는 점

## Validation

- 쿠팡 최근 10일 요청이 `CPNG`으로 해석되고 최신 일봉 10개를 반환한다.
- 요청 처리 중 LLM 호출이 티커/조회 조건 추출 단계에서 정확히 1회 발생한다.
- Yahoo Finance 결과가 `PriceData`로 변환되고 다른 노드가 동일 클래스 계약을 재사용할 수 있다.
- `PriceData`가 불변 조건을 위반한 값은 거부하고 JSON 왕복 직렬화 후에도 값 동등성을 유지한다.
- 그래프 실행 기록에서 에이전트의 Yahoo Finance 툴 호출과 툴 결과를 확인할 수 있다.
- 동일 키를 TTL 내 두 번 조회하면 두 번째 요청은 cache hit이고 Yahoo Finance 패칭은 한 번만 발생한다.
- TTL 만료 후 동일 키를 조회하면 cache miss로 새 데이터를 패칭한다.
- 오류와 빈 결과는 캐시되지 않으며 다음 요청에서 다시 패칭을 시도한다.
- 서로 다른 심볼/간격/개수는 서로 다른 캐시 키를 사용한다.
- 동일 키의 동시 요청은 single-flight로 Yahoo Finance를 한 번만 호출한다.
- 반환 데이터가 날짜 오름차순이고 유효한 최신 일봉 10개인지 검증한다.
- 장중 실행 시 Yahoo Finance가 제공하는 당일 미완성 일봉을 포함하고 그 가능성을 응답에 표시한다.
- 일반 종가(`Close`)를 표시 가격과 기간 변동률 계산에 사용하고 수정 종가와 혼동하지 않는다.
- 존재하지 않거나 모호한 종목은 가격을 꾸며내지 않고 확인 가능한 오류/추가 질문을 반환한다.
- Yahoo Finance 타임아웃, 비정상 응답, 빈 데이터가 안전하고 일관된 오류로 변환된다.
- `langgraph dev`가 가격 에이전트 그래프를 로드하고 LangSmith Studio에서 직접 실행할 수 있다.
- 가격 에이전트가 `main_graph`에 연결되지 않은 독립 그래프 상태인지 확인한다.
- 응답은 Markdown 텍스트로 내려가며 가격 차트나 시각화 산출물을 생성하지 않는다.

### E2E 시나리오

- V1 기본 조회: Given Yahoo Finance 성공 응답이 준비되었을 때, When “쿠팡의 최근 10일간 가격”을 요청하면,
  Then `CPNG`, `1d`, `10` 툴콜과 최신 일봉 10개 결과를 반환한다.
- V2 LLM 호출 수: Given 하나의 사용자 요청이 있을 때, When 전체 그래프가 완료되면,
  Then LLM trace는 `extract_request`의 한 번뿐이고 툴 이후 LLM 재호출이 없다.
- V3 Value Object 매핑: Given Yahoo DataFrame 행이 있을 때, When 툴 어댑터가 정규화하면,
  Then 각 행은 `PriceData`이고 다른 노드가 동일 타입으로 읽을 수 있다.
- V4 Value Object 계약: Given 유효/무효 OHLCV와 JSON payload가 있을 때, When `PriceData`를 생성·직렬화·복원하면,
  Then 무효 값은 거부되고 유효 값은 왕복 후 동등하다.
- V5 Studio trace: Given LangGraph Dev에서 그래프를 실행할 때, When 실행 trace를 확인하면,
  Then LLM 툴콜, `ToolNode`, cache hit/miss, ToolMessage 결과가 순서대로 표시된다.
- V6 캐시 hit: Given `CPNG:1d:10:false` 첫 조회가 캐시되었을 때, When TTL 안에 다시 호출하면,
  Then `cache_hit=true`이며 Yahoo 패칭 호출 수는 1이다.
- V7 캐시 만료: Given 캐시 항목의 TTL이 지났을 때, When 같은 키를 호출하면,
  Then `cache_hit=false`이고 Yahoo에서 새 데이터를 패칭한다.
- V8 오류 미캐시: Given 첫 Yahoo 호출이 오류 또는 빈 결과일 때, When 같은 요청을 다시 호출하면,
  Then 첫 결과는 저장되지 않고 두 번째 호출이 Yahoo 패칭을 다시 시도한다.
- V9 키 분리: Given 심볼·간격·개수가 다른 요청들이 있을 때, When 캐시 키를 생성하면,
  Then 각 요청은 충돌하지 않는 정규화 키를 가진다.
- V10 single-flight: Given 동일 키의 동시 cache miss가 여러 개일 때, When 요청들을 함께 실행하면,
  Then Yahoo 패칭은 한 번만 실행되고 모든 호출자는 같은 불변 결과를 받는다.
- V11 정렬/개수: Given 10개보다 많은 역순 일봉이 반환될 때, When 수집 노드가 처리하면,
  Then 유효한 최신 10개만 날짜 오름차순으로 남는다.
- V12 장중 일봉: Given Yahoo 결과에 당일 미완성 일봉이 있을 때, When 최신 10개를 구성하면,
  Then 해당 일봉을 포함하고 `is_partial=true` 및 변경 가능 안내를 남긴다.
- V13 Close 계산: Given 원 `Close`와 `Adj Close`가 다른 일봉이 있을 때, When 응답과 변동률을 계산하면,
  Then 표시 가격과 `(last Close / first Close - 1) * 100`은 원 `Close`만 사용한다.
- V14 잘못된/모호한 종목: Given 티커 툴콜이 없거나 조회 결과가 없을 때, When 그래프를 완료하면,
  Then 가격을 생성하지 않고 확인 가능한 오류 또는 추가 질문 Markdown을 반환한다.
- V15 공급자 오류: Given timeout, rate limit, 비정상 schema가 각각 발생할 때, When 툴이 처리하면,
  Then 안정적인 오류 코드와 재시도 안내로 변환하고 예외 세부정보를 사용자에게 노출하지 않는다.
- V16 LangGraph Dev 로드: Given 프로젝트 설정이 완료되었을 때, When `pnpm dev:langgraph`를 실행하면,
  Then `price_agent` 그래프가 오류 없이 로드되어 Studio에서 직접 실행 가능하다.
- V17 독립 그래프: Given `langgraph.json`을 검사할 때, When graph entry를 비교하면,
  Then `price_agent`는 독립 entry이고 `main_graph` workflow 코드는 변경되지 않는다.
- V18 Markdown/no chart: Given 정상 가격 결과가 있을 때, When 최종 응답을 생성하면,
  Then 날짜 오름차순 Markdown과 최신 종가·변동률 요약만 반환하고 차트 artifact는 생성하지 않는다.

## Skills

### Gradate 단계

- 없음

### Validate 단계

- apb-gap-analysis
- apb-validation-report

### 추천 및 검토 기록

- `apb-react-directory-policy` — DROP: React 전용 디렉터리 정책으로 Python/LangGraph 구현에 맞지 않음.
- `apb-gap-analysis` — KEEP: Gradate 설계와 Python 구현의 모듈·인터페이스·데이터 흐름 일치율 검증에 필요.
- `apb-validation-report` — KEEP: pytest, LangGraph Dev, 캐시/E2E, Gap 결과를 최종 PASS/FAIL 보고서로 통합.
- `apb-unit-test-write` — DROP: Jest/Vitest 전용이며 이 프로젝트 테스트 런타임은 pytest임.
- `apb-static-analysis` — DROP: ESLint/Biome/tsc 중심의 JS/TS 스킬이며 기능 구현은 Python임.
- `apb-code-coverage` — DROP: Node 커버리지 스크립트와 JS/TS 변경 파일만 지원하므로 Python 범위에 맞지 않음.
- `apb-bruno-api-tests` — DROP: 이번 범위에 전용 REST API가 없고 LangGraph 독립 그래프를 직접 검증함.
- `apb-playwright-e2e` — DROP: UI와 브라우저 화면이 없는 그래프/툴 기능임.
