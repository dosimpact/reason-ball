# ohlcv-talib-analysis-agent Plan

## Goal

사용자가 OHLCV 주가 데이터와 분석 요청을 제공하면, 기술 분석 에이전트가 TA-Lib 기반의
결정론적 도구를 호출하여 지표를 계산하고 그 결과를 근거와 함께 설명한다. 에이전트는
독립적인 LangGraph 그래프로 구현하고 `langgraph dev`에 등록하여 LangGraph Standard
API에서 입력, 노드 전이, 툴 호출, 계산 결과, 최종 응답을 추적하고 테스트할 수 있어야
한다. LangSmith Studio는 동일 API를 사용하는 선택적 시각화 표면으로 취급한다.

## Scope

- Target project root: `20-portfolio/1-reason-hwang/3-langgraph-fast/`
- Target graph package: `20-portfolio/1-reason-hwang/3-langgraph-fast/src/graph/subgraph/technical_analysis/`
- In scope:
  - 프로젝트 공통 `graph.shared.value_objects.PriceData`를 기술 분석의 유일한 가격 입력 계약으로 사용
  - Yahoo Finance 가격 에이전트의 `prices: list[PriceData]` 출력을 기술 분석 그래프가 변환 없이 받는 공통 계약 구성
  - 개별 bar 불변식은 `PriceData`, 시계열 정렬·동일 종목/통화/시간대 검증은 기술 분석 입력 노드가 담당
  - TA-Lib 호출을 캡슐화한 `analyze_ohlcv_with_talib` 범용 툴 하나를 에이전트보다 먼저 구현
  - 한 번의 툴 호출에서 복수 지표 요청을 받아 카테고리별 내부 디스패처가 여러 지표 계산 함수를 실행
  - 공개 LangChain 툴은 하나로 유지하고, 카테고리 디스패처와 지표별 함수는 모델이 직접 호출할 수 없는 내부 인터페이스로 분리
  - 공식 TA-Lib 분류 중 1차 범위인 Overlap Studies, Momentum Indicators, Volatility Indicators, Volume Indicators별 내부 모듈 정의
  - 에이전트와 TA-Lib 사이에 디렉터리·인터페이스 기반 격벽을 두고 역할과 책임을 분리
  - 에이전트 노드와 LangChain 툴에서는 `talib`를 직접 import하거나 TA-Lib 전용 타입을 노출하지 않음
  - TA-Lib 교체 또는 미설치 상태에서도 도메인 계약과 에이전트 테스트가 독립적으로 실행되도록 엔진 인터페이스를 주입
  - 1차 지원 지표를 SMA, EMA, RSI, MACD, Bollinger Bands, ATR, ADX, OBV로 제한
  - 요청 지표와 허용된 파라미터만 계산하며, 계산 결과를 JSON 직렬화 가능한 내부 스키마로 정규화
  - 내부 결과에는 각 지표의 전체 시계열을 유지하고 최신 유효 값, 적용 파라미터, 계산 불가 사유와 필요한 최소 데이터 길이도 반환
  - LLM 컨텍스트에는 최신 값과 설정 가능한 최근 구간만 투영하여 전체 시계열로 인한 토큰 증가 방지
  - 빈 목록, 비단조·중복 거래일, 혼합 종목/통화/시간대와 유효하지 않은 `PriceData`를 입력 경계에서 거부
  - TA-Lib warm-up 구간의 NaN을 임의 값으로 채우지 않고 `null`로 명시
  - 사용자 요청을 분석 지표와 파라미터로 해석하고 툴을 호출하는 LangGraph 에이전트 루프 구성
  - 툴의 수치 결과만 근거로 추세·모멘텀·변동성·거래량을 요약하며 관측과 해석을 구분
  - 계산 실패 또는 데이터 부족 시 수치를 꾸며내지 않고 수정 가능한 오류를 안내
  - `technical_analysis_graph`를 `langgraph.json`에 독립 그래프로 등록하고 `langgraph dev`의 Standard API로 테스트 가능하게 구성
  - 핵심 입력 검증과 각 지표 계산, 그래프 툴 호출 경로에 대한 단위 테스트
- Out of scope:
  - Yahoo Finance 등 외부 공급자로부터 OHLCV를 직접 수집하는 기능
  - 기존 `yahoo-finance-price-agent-subgraph`와의 연결 또는 `main_graph` 편입
  - 실시간 시세, 틱/호가, 데이터 저장소, 캐시, 백테스트, 차트 UI
  - 매수·매도 주문 실행, 목표가, 수익 보장, 개인화 투자 자문
  - TA-Lib의 전체 함수 동적 노출 및 사용자가 임의 함수명이나 코드를 실행하는 기능
  - 신규 REST API 엔드포인트 또는 LangSmith 배포 설정
  - `20-portfolio/1-reason-hwang/3-langgraph-fast/` 밖의 코드 변경

## Verification

- Implementation scope:
  - 기술 분석 도메인 계약, TA-Lib 어댑터, 카테고리별 계산 모듈, LangChain 접합 툴, 프롬프트, 상태, 노드, 워크플로, 패키지 export
  - `langgraph.json` 그래프 등록과 관련 단위·그래프 테스트
  - 구현 및 테스트 변경은 대상 프로젝트 내부로 제한
- Public interfaces:
  - 컴파일된 `technical_analysis_graph`
  - `analyze_ohlcv_with_talib(indicators)` 단일 LangChain 툴; `prices`와 `interval`은 graph state에서 주입
  - `prices`: Yahoo Finance 가격 에이전트와 공유하는 `list[PriceData]`
  - `indicators`: 카테고리, 허용된 지표 이름, 지표별 파라미터로 구성된 복수 요청 목록
  - 툴 출력: 입력 메타데이터, 카테고리별 지표 결과, 전체 시계열, 최신 값, 경고, 구조화된 오류
- Internal interfaces:
  - `TechnicalAnalysisEngine` Protocol: 에이전트 계층이 의존하는 라이브러리 중립 분석 포트
  - `OverlapStudiesDispatcher`: SMA, EMA, Bollinger Bands
  - `MomentumIndicatorsDispatcher`: RSI, MACD, ADX
  - `VolatilityIndicatorsDispatcher`: ATR
  - `VolumeIndicatorsDispatcher`: OBV
  - 각 디스패처는 지표 이름과 검증된 파라미터를 해당 지표 계산 함수로 전달하고 표준 결과로 병합
- Directory bulkhead:
  - `src/domains/technical_analysis/`: 라이브러리 중립 요청·결과 모델, 오류, `TechnicalAnalysisEngine` Protocol
  - `src/infrastructure/technical_analysis/talib/`: TA-Lib 어댑터와 유일하게 `talib` import를 허용하는 경계
  - `src/infrastructure/technical_analysis/talib/categories/overlap_studies/`: SMA, EMA, Bollinger Bands 지표별 모듈
  - `src/infrastructure/technical_analysis/talib/categories/momentum_indicators/`: RSI, MACD, ADX 지표별 모듈
  - `src/infrastructure/technical_analysis/talib/categories/volatility_indicators/`: ATR 지표 모듈
  - `src/infrastructure/technical_analysis/talib/categories/volume_indicators/`: OBV 지표 모듈
  - `src/graph/subgraph/technical_analysis/`: LangGraph 상태, 프롬프트, 노드, 워크플로와 범용 LangChain 툴
  - `src/graph/subgraph/technical_analysis/tools/analyze.py`: 주입된 `TechnicalAnalysisEngine`만 호출하는 에이전트↔분석 엔진 접합부
- Dependency rules:
  - `domains`는 `graph`, `infrastructure`, `talib`, LangChain/LangGraph에 의존하지 않음
  - `infrastructure.technical_analysis.talib`는 도메인 포트를 구현하며 에이전트 상태나 메시지를 알지 못함
  - 에이전트 노드와 접합 툴은 도메인 포트와 모델만 알며 TA-Lib 함수명·NumPy 배열·warm-up 처리 세부사항을 알지 못함
  - 그래프 조립 지점만 TA-Lib 엔진 팩토리를 선택하고 접합 툴에 주입함
  - TA-Lib 반환 배열의 `NaN`→`null` 변환과 다중 출력 정규화는 infrastructure 경계 안에서 완료함
- External dependencies:
  - Python `TA-Lib` 패키지와 운영체제별 네이티브 TA-Lib 바이너리/빌드 의존성
  - NumPy, Pydantic, LangGraph, LangChain 모델/툴 인터페이스
  - 모델 호출을 위한 기존 OAuth proxy 및 환경 설정
- Internal dependencies:
  - `graph.provider.ChatGptOauthProxyProvider`
  - 기존 `src/graph/subgraph` 구조, `starter_graph` 패턴, 루트 `langgraph.json`
  - `pnpm dev:langgraph` 개발 스크립트
- Integration decision:
  - 1단계에서는 기술 분석 에이전트가 완성된 `list[PriceData]`를 직접 입력받으며 가격 조회 책임을 갖지 않음
  - Yahoo Finance 가격 에이전트와 기술 분석 에이전트는 동일 `prices` 상태 필드를 출력·입력 경계로 공유
  - `technical_analysis_graph`를 Standard API에서 직접 실행할 수 있는 독립 그래프로 노출
  - 가격 조회 에이전트 또는 `main_graph`와의 조합은 독립 그래프 검증 후 별도 플랜에서 수행
  - TA-Lib 라이브러리 호출은 어댑터 경계에 격리하고 공식 카테고리 기반 내부 모듈로 나누어 툴·그래프와 네이티브 의존성을 분리
  - 향후 다른 기술 분석 라이브러리를 도입할 때 에이전트와 공개 툴 계약을 바꾸지 않고 `TechnicalAnalysisEngine` 구현만 교체 가능하게 유지
- Risky areas:
  - 여러 `PriceData`가 동일 종목·통화·거래소·시간대인지와 거래일 정렬을 시계열 경계에서 추가 검증해야 하는 점
  - macOS/Linux 및 Python 버전에 따른 TA-Lib 네이티브 바이너리 설치·빌드 차이
  - 지표별 최소 관측치와 warm-up 구간 때문에 최신 유효 값이 없을 수 있는 점
  - 타임스탬프 정렬, 결측치, 거래 정지, 분할·배당 조정 여부가 지표 의미를 바꾸는 점
  - 가격 규모와 거래량이 큰 입력에서 NumPy 부동소수점 변환 및 JSON 직렬화 문제
  - LLM이 툴에 없는 수치나 인과관계, 매매 확신을 추가하지 않도록 근거를 제한해야 하는 점
  - Standard API 입력이 메시지 중심 그래프 상태와 구조화 OHLCV 페이로드를 안정적으로 전달해야 하는 점

## LangGraph Node & Directory Implementation Plan

### Graph state

- `messages`: 사용자 요청, 모델의 툴 호출, 툴 결과, 최종 응답을 누적하는 메시지 reducer 필드
- `prices`: `list[PriceData]`; Standard API 입력 및 Yahoo Finance 공통 상태 계약
- `interval`: 가격 간격 메타데이터; 현재 Yahoo Finance 에이전트는 `1d`를 출력
- `analysis_result`: TA-Lib 전체 시계열과 최신 값을 담는 구조화 결과; LLM 메시지와 분리하여 보존
- `validation_errors`: 가격 객체 입력 검증 실패 목록
- OHLCV 전체 배열은 모델이 생성하는 툴 인자에 포함하지 않고 LangGraph tool runtime으로 상태에서 주입
- 모델에 노출되는 범용 툴 인자는 `indicators`와 각 지표 파라미터만 포함

### Node responsibilities

1. `validate_price`
   - `prices` 목록의 존재 여부, 각 `PriceData` 불변식, 시계열 일관성과 정렬 확인
   - 유효하면 상태를 변경하지 않고 `call_model`로 라우팅
   - 유효하지 않으면 `validation_errors`를 기록하고 `render_input_error`로 라우팅
   - TA-Lib, 모델, 네트워크를 호출하지 않는 결정론적 노드
2. `render_input_error`
   - 구조화된 검증 오류를 사용자가 수정할 수 있는 `AIMessage`로 변환
   - 분석 수치나 투자 판단을 생성하지 않고 즉시 종료
3. `call_model`
   - 기존 `ChatGptOauthProxyProvider` 모델에 단일 `analyze_ohlcv_with_talib` 툴을 바인딩
   - 사용자 요청을 지표 목록과 허용된 파라미터로 변환해 툴 호출을 생성
   - 툴 실행 뒤에는 요약된 `ToolMessage`만 근거로 최종 기술 분석 응답 생성
   - 첫 분석 응답에서 툴을 건너뛰지 않도록 시스템 프롬프트와 테스트로 강제
4. `tools`
   - LangGraph `ToolNode`로 `analyze_ohlcv_with_talib` 툴 호출 실행
   - injected state에서 `prices`와 `interval`을 주입하고 모델이 전달한 복수 지표 요청과 함께 `TechnicalAnalysisEngine` 호출
   - 전체 `analysis_result`는 상태에 기록하고, 최신 값 및 설정된 최근 구간만 `ToolMessage`로 반환
   - 구조화 상태를 갱신할 때 tool call id에 대응하는 `ToolMessage`를 함께 기록

### Routing and flow

```text
START
  ↓
validate_price
  ├─ invalid → render_input_error → END
  └─ valid   → call_model
                  ├─ tool_calls 있음 → tools ─┐
                  │                           │
                  └─ tool_calls 없음 → END    └→ call_model
```

- `route_after_validation`: `validation_errors` 유무에 따라 `render_input_error` 또는 `call_model` 선택
- `tools_condition`: 마지막 AI 메시지의 tool call 유무에 따라 `tools` 또는 `END` 선택
- `tools → call_model` 루프는 모델이 툴 결과를 설명하는 최종 응답을 만들도록 구성
- 임의 무한 루프를 막기 위해 그래프 실행 recursion limit과 한 요청당 분석 툴 호출 정책을 테스트
- 기존 `create_react_agent` 헬퍼에 숨기지 않고 각 노드와 엣지를 `StateGraph`에 명시하여 API stream에서 노드별 동작 확인

### Planned directory tree

```text
src/
├── domains/
│   └── technical_analysis/
│       ├── __init__.py
│       ├── models.py                        # IndicatorRequest, AnalysisResult
│       ├── ports.py                         # TechnicalAnalysisEngine Protocol
│       └── errors.py
├── infrastructure/
│   └── technical_analysis/
│       └── talib/
│           ├── __init__.py                  # TaLibAnalysisEngine만 공개
│           ├── engine.py
│           ├── registry.py
│           ├── normalization.py
│           ├── errors.py
│           └── categories/
│               ├── overlap_studies/
│               │   ├── sma.py
│               │   ├── ema.py
│               │   └── bollinger_bands.py
│               ├── momentum_indicators/
│               │   ├── rsi.py
│               │   ├── macd.py
│               │   └── adx.py
│               ├── volatility_indicators/
│               │   └── atr.py
│               └── volume_indicators/
│                   └── obv.py
└── graph/
    ├── shared/value_objects/
    │   └── price_data_vo.py                 # Yahoo/기술 분석 공통 PriceData
    └── subgraph/
        └── technical_analysis/
            ├── __init__.py
            ├── state.py                     # TechnicalAnalysisState
            ├── workflow.py                  # StateGraph 노드·엣지·컴파일
            ├── composition.py               # 실제 엔진과 툴을 조립하는 유일한 지점
            ├── node/
            │   ├── validate_price.py
            │   ├── render_input_error.py
            │   └── call_model.py
            ├── routing/
            │   └── after_validation.py
            ├── prompts/
            │   └── system.py
            └── tools/
                └── analyze.py               # 단일 공개 LangChain 툴 팩토리
```

### File-level implementation order

1. 공통 `PriceData`와 Yahoo Finance `prices` 상태 계약 확인
2. `domains/technical_analysis`의 모델, 오류, 엔진 Protocol 작성
3. `infrastructure/technical_analysis/talib/categories`의 지표별 계산 함수와 단위 테스트 작성
4. TA-Lib engine, registry, 정규화 계층을 작성하고 카테고리 결과 병합 검증
5. 주입된 엔진과 tool runtime state를 사용하는 범용 LangChain 툴 작성
6. 상태, 입력 검증 노드, 오류 응답 노드, 모델 노드, 라우팅 함수 작성
7. `composition.py`에서 TA-Lib 엔진과 ToolNode를 조립하고 `workflow.py`에서 그래프 컴파일
8. `langgraph.json`에 `technical_analysis_graph` 등록
9. fake 엔진 기반 그래프 테스트, 실제 TA-Lib 통합 테스트, Standard API E2E 순서로 검증

## Validation

- 정상 OHLCV와 기본 파라미터로 요청한 SMA, RSI, MACD가 TA-Lib 기준값과 일치한다.
- 하나의 툴 호출에서 서로 다른 카테고리의 복수 지표를 요청하면 각 내부 디스패처가 실행되고 결과가 누락 없이 병합된다.
- 지표별 시계열 길이가 입력 길이와 같고 warm-up 값은 `null`, 최신 값은 마지막 유효 값이다.
- 전체 시계열은 내부 결과에 유지되지만 LLM 입력에는 최신 값과 설정된 최근 구간만 포함된다.
- 잘못된 OHLCV와 데이터 부족은 구조화된 오류가 되며 그래프 실행이 환각된 분석으로 이어지지 않는다.
- 에이전트가 요청된 지표만 허용된 파라미터로 호출하고 툴 결과에 근거한 설명을 반환한다.
- TA-Lib 예외는 내부 스택을 노출하지 않는 안정적인 도구 오류로 변환된다.
- TA-Lib를 대체한 fake `TechnicalAnalysisEngine`으로 에이전트·툴 테스트가 실행되며 `talib` import는 infrastructure 경계 밖에서 발견되지 않는다.
- 카테고리별 테스트가 해당 디스패처만 대상으로 실행되고 한 카테고리의 변경이 다른 카테고리 계약을 깨지 않는다.
- `langgraph dev`가 `technical_analysis_graph`를 로드하고 Standard API에서 독립 실행할 수 있다.
- 기존 `main_graph` 및 다른 서브그래프의 등록과 동작이 유지된다.

### E2E 시나리오

- E2E-01 — Given TA-Lib 기준 fixture와 SMA, RSI, MACD 기본 파라미터 요청이 있을 때,
  When 분석 엔진을 실행하면,
  Then 각 결과가 동일 입력에 대한 TA-Lib 직접 호출 기준값과 허용 오차 내에서 일치한다.
- E2E-02 — Given 서로 다른 네 카테고리의 SMA, RSI, ATR, OBV 요청이 한 번에 있을 때,
  When 범용 툴을 한 번 호출하면,
  Then 각 카테고리 디스패처 결과가 누락 없이 하나의 `analysis_result`로 병합된다.
- E2E-03 — Given warm-up 구간이 발생하는 충분한 OHLCV가 있을 때,
  When 시계열 지표를 계산하면,
  Then 출력 길이는 입력과 같고 초기 비유효 값은 `null`, `latest`는 마지막 유효 값이다.
- E2E-04 — Given 긴 OHLCV와 복수 지표 요청이 있을 때,
  When ToolNode가 분석을 완료하면,
  Then 전체 시계열은 `analysis_result` 상태에 남고 모델용 `ToolMessage`에는 최신 값과 설정된 최근 구간만 포함된다.
- E2E-05 — Given 혼합 종목/비단조 거래일 또는 최소 관측치보다 부족한 `PriceData` 목록이 있을 때,
  When 그래프를 실행하면,
  Then 구조화된 검증/데이터 부족 오류를 반환하고 계산되지 않은 수치를 생성하지 않는다.
- E2E-06 — Given 충분한 길이의 유효한 일봉 OHLCV와 “20일 SMA, RSI(14), MACD로 분석해줘” 요청이 있을 때,
  When LangGraph Standard API `/runs/stream`에서 `technical_analysis_graph`를 실행하면,
  Then 에이전트는 요청된 세 지표만 허용된 파라미터로 호출하고 계산된 값에 근거한 해석만 반환한다.
- E2E-07 — Given TA-Lib 어댑터가 계산 예외를 발생시키도록 구성됐을 때,
  When 범용 툴 또는 그래프를 실행하면,
  Then 내부 스택을 노출하지 않는 도메인 오류로 변환되고 그래프는 안전한 안내를 반환한다.
- E2E-08 — Given TA-Lib가 없는 테스트 환경과 fake `TechnicalAnalysisEngine`이 있을 때,
  When 그래프·툴 테스트와 import 경계 검사를 실행하면,
  Then 테스트가 통과하고 infrastructure TA-Lib 경계 밖에서는 `talib` import가 발견되지 않는다.
- E2E-09 — Given 한 카테고리의 구현을 격리해 테스트할 때,
  When overlap, momentum, volatility, volume 카테고리 테스트를 각각 실행하면,
  Then 각 테스트는 다른 카테고리 구현 없이 독립적으로 통과한다.
- E2E-10 — Given `langgraph dev`가 실행 중일 때,
  When Standard API `/assistants/search`와 `/runs/stream`을 호출하면,
  Then `technical_analysis_graph`를 독립적으로 선택할 수 있고 노드 전이, 툴 호출 입력·출력, 최종 응답을 추적할 수 있다.
- E2E-11 — Given 기존 `main_graph`와 다른 서브그래프가 등록된 상태에서,
  When 전체 테스트와 LangGraph 그래프 로딩 검사를 실행하면,
  Then 기존 그래프 등록과 동작은 유지되고 기술 분석 그래프만 추가된다.

## Skill Recommendation Review

### Gradate candidates

- `apb-pgv` — KEEP: Gradate 문서 생성, 구현, 자체 설계↔코드 갭 반복을 직접 통제한다.
- `apb-react-directory-policy` — DROP: Python LangGraph 기능이며 React `src/` 구조와 무관하다.
- `apb-tech-proposal` — DROP: 이미 승인된 구현 플랜이 있어 별도 제안서 생성은 중복이다.

### Validate candidates

- `apb-gap-analysis` — KEEP: Gradate 설계의 모듈·인터페이스·데이터 흐름과 실제 Python 구현을 대조한다.
- `apb-validation-report` — KEEP: 테스트, Standard API/dev-server 결과, 갭 테이블을 최종 PASS/FAIL 보고서로 통합한다.
- `apb-unit-test-write` — DROP: 현재 스킬은 Jest/Vitest 전용이며 이 기능은 pytest 기반 Python 모듈이다. 테스트는 프로젝트의 pytest 규칙으로 직접 작성한다.
- `apb-static-analysis` — DROP: 현재 스킬은 JS/TS ESLint·tsc 중심이다. Python 정적 검사는 프로젝트에 있는 Ruff/컴파일 검사를 직접 실행한다.
- `apb-code-coverage` — DROP: 현재 스킬은 JS/TS 파일과 Node coverage 명령 전용이다. 필요 시 Python coverage는 프로젝트 도구로 직접 측정한다.

## Skills

### Gradate 단계

- apb-pgv

### Validate 단계

- apb-gap-analysis
- apb-validation-report
