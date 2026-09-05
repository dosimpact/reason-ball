# yahoo-finance-price-agent-subgraph Validate

## Scope

- `20-portfolio/1-reason-hwang/3-langgraph-fast/` 안에 독립 `price_agent` LangGraph를 구현한다.
- 한 번의 LLM 호출로 회사명/티커와 `1d`, 최신 10개 조건을 Yahoo Finance 툴콜로 변환한다.
- `yfinance` 결과를 공유 불변 `PriceData` VO로 정규화하고 raw `Close`를 사용한다.
- TTL/LRU 인메모리 캐시, 정규화 키, 성공 결과 전용 저장, per-key single-flight를 제공한다.
- 당일 미완성 일봉을 포함하며 날짜 오름차순 Markdown, 최신 종가, 기간 변동률을 반환한다.
- `langgraph.json`에 독립 그래프로 등록하되 기존 `main_graph`에는 연결하지 않는다.
- 영속 DB 캐시, 차트, 주문/투자 추천, 두 번째 에이전트는 범위에서 제외한다.

## Validation Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| 쿠팡 요청을 `CPNG`으로 해석해 최신 일봉 10개 반환 | SKIP | 모킹 그래프와 live CPNG adapter는 통과했으나 실제 LLM proxy가 미가동이다. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| 요청당 LLM 호출은 추출 단계에서 정확히 1회 | PASS | call-count 및 전체 workflow 테스트. [test_extract_request.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_extract_request.py) |
| Yahoo 결과를 재사용 가능한 `PriceData`로 변환 | PASS | adapter/collector 타입 테스트. [test_yahoo_finance_tool.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_yahoo_finance_tool.py) |
| VO 불변조건 및 JSON 왕복 동등성 | PASS | 8개 VO 테스트. [test_price_data_vo.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/value_objects/test_price_data_vo.py) |
| Studio trace에서 실제 LLM 툴콜과 ToolMessage 확인 | SKIP | Dev/assistant 등록은 통과했으나 실제 LLM trace는 proxy 미가동으로 실행하지 못했다. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| 동일 키 TTL 내 재조회가 cache hit, provider 1회 | PASS | workflow/tool cache 테스트와 live 2회 smoke. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| TTL 만료 후 새 패칭 | PASS | monotonic fake-clock 테스트. [test_in_memory_price_cache.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_in_memory_price_cache.py) |
| 오류 및 빈 결과 미캐시 | PASS | decorator error/empty 테스트. [test_price_data_cache_decorator.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_price_data_cache_decorator.py) |
| 심볼/간격/개수별 캐시 키 분리 | PASS | symbol, interval, count, auto-adjust 키 테스트. [test_price_data_cache_decorator.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_price_data_cache_decorator.py) |
| 동일 키 동시 miss single-flight | PASS | 4-thread 동시성 테스트. [test_price_data_cache_decorator.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_price_data_cache_decorator.py) |
| 날짜 오름차순 최신 일봉 10개 | PASS | adapter와 collector 정렬 테스트, live Yahoo smoke. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| 당일 미완성 일봉 포함 및 안내 | PASS | partial metadata adapter/formatter 테스트와 live smoke. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| 표시/변동률에 raw `Close` 사용 | PASS | `Adj Close`가 다른 fixture로 formatter 검증. [test_format_response.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_format_response.py) |
| 잘못된/모호한 종목에 안전한 오류 | PASS | missing tool call, invalid symbol, formatter error 테스트. [test_extract_request.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_extract_request.py) |
| timeout/rate-limit/schema/empty를 구조화 오류로 변환 | PASS | provider 오류별 테스트. [test_yahoo_finance_tool.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_yahoo_finance_tool.py) |
| LangGraph Dev가 `price_agent`를 로드 | PASS | port 53291 startup 및 `/assistants/search` 확인. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| `main_graph`와 분리된 독립 graph entry | PASS | 독립 등록 및 main workflow diff 없음. [langgraph.json](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/langgraph.json) |
| Markdown 텍스트만 반환하고 차트 미생성 | PASS | deterministic formatter 테스트. [test_format_response.py](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_format_response.py) |

Summary: **16 PASS / 0 FAIL / 2 SKIP**

## Gap Table

| Plan/Design Item | Implementation Evidence | Result |
| --- | --- | --- |
| Shared `PriceData` VO | VO module, explicit export, 8 unit tests | Matched |
| Cache Protocol + TTL/LRU/single-flight | protocol, in-memory backend, decorator, concurrency tests | Matched |
| Yahoo Finance tool and typed artifact | yfinance adapter, structured content/artifact/errors, live smoke | Matched |
| Single-call LLM extraction node | required tool binding, one `ainvoke`, call-count test | Matched |
| Collection and deterministic formatter | typed artifact collection, raw Close Markdown tests | Matched |
| Independent graph and LangGraph config | compiled workflow, independent config entry, Dev load smoke | Matched |
| Tests for V1-V18 | 28 feature tests; 93 passed project-wide | Matched |

Match rate: **100% (7/7)**. Missing: 0. Extra: 0. Gate: PASS.

## E2E Results

| Scenario | Tool | Result | Log/Evidence |
| --- | --- | --- | --- |
| V1 기본 조회 | pytest + live Yahoo | SKIP | 실제 LLM proxy 미가동; 나머지 경로는 통과. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| V2 LLM 호출 수 | pytest | PASS | [extract test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_extract_request.py) |
| V3 VO 매핑 | pytest | PASS | [tool test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_yahoo_finance_tool.py) |
| V4 VO 계약 | pytest | PASS | [VO test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/value_objects/test_price_data_vo.py) |
| V5 Studio trace | LangGraph Dev | SKIP | proxy 미가동. [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| V6 cache hit | pytest + live Yahoo | PASS | [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| V7 cache expiry | pytest | PASS | [cache test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_in_memory_price_cache.py) |
| V8 오류 미캐시 | pytest | PASS | [decorator test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_price_data_cache_decorator.py) |
| V9 키 분리 | pytest | PASS | [decorator test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_price_data_cache_decorator.py) |
| V10 single-flight | pytest | PASS | [decorator test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/shared/cache/test_price_data_cache_decorator.py) |
| V11 정렬/개수 | pytest + live Yahoo | PASS | [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| V12 장중 일봉 | pytest + live Yahoo | PASS | [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| V13 Close 계산 | pytest | PASS | [formatter test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_format_response.py) |
| V14 잘못된 종목 | pytest | PASS | [tool test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_yahoo_finance_tool.py) |
| V15 공급자 오류 | pytest | PASS | [tool test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_yahoo_finance_tool.py) |
| V16 Dev 로드 | LangGraph Dev/API | PASS | [evidence](./yahoo-finance-price-agent-subgraph.evidence.md) |
| V17 독립 그래프 | config/diff inspection | PASS | [langgraph.json](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/langgraph.json) |
| V18 Markdown/no chart | pytest | PASS | [formatter test](../../../20-portfolio/1-reason-hwang/3-langgraph-fast/tests/graph/subgraph/price_agent/test_format_response.py) |

E2E summary: **16 PASS / 0 FAIL / 2 SKIP**

## Skill Usage Log

- [x] `apb-pgv` — Plan → Gradate → Validate 상태 전이와 산출물 생성
- [x] `apb-gap-analysis` — 설계 7개 묶음과 구현을 비교하여 100% 일치 확인
- [x] `apb-validation-report` — 체크리스트/E2E 점수화와 최종 gate 작성
- [ ] `apb-static-analysis` — Python 프로젝트에 맞지 않는 JS/TS 전용 skill이어서 제외; 프로젝트의 Pyright와 feature-scoped Ruff를 직접 실행
- [ ] `apb-code-coverage` — JS/TS 전용 skill이어서 제외

## Action Items

- [ ] 로컬 OAuth proxy를 `127.0.0.1:2890`에 시작한 후 Studio에서 “쿠팡의 최근 10일 가격”을 실행해 V1/V5를 PASS로 갱신한다.
- [ ] 별도 범위에서 기존 repository-wide Ruff 54건을 정리한다. 이번 feature 경로의 Ruff 결과는 PASS다.

## Verdict

**CONDITIONAL PASS** — 설계 일치율 100%, 기능 테스트 28개 및 전체 프로젝트 테스트·타입체크·빌드는 통과했고 실제 Yahoo/Dev 로드도 확인했다. 다만 로컬 LLM proxy가 실행 중이 아니어서 실제 회사명 해석과 Studio tool-call trace 2개 항목은 SKIP으로 남는다.
