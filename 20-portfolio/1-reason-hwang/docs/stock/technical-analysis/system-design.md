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

기존 TA-Lib 엔진의 다른 지표는 유지하며 새 도구 스키마만 RSI/SMA/MACD로 제한한다. 시그널과 화면 데이터 구성은 `domains/technical_analysis/report.py`, `presentation.py`의 순수 로직이다. 캐시 키는 ticker·interval·조회 개수·auto_adjust를 구분한다. 가격 어댑터 내부 최대 조회 개수는 5000이다. 표시 개수는 OpenUI validator의 60000자 제한을 고려해 200개로 제한한다. 데이터 배열은 독립 변수로 선언해 MACD 선/막대 차트가 공유한다.

## OpenUI와 Host 계약

공통 `build_output_graph`의 선택적 `program_builder` 주입을 사용한다. 기술적 분석은 결정적 OpenUI 프로그램을 생성한 후 기존 Host parser/catalog validator로 검증한다. 다른 호출자의 기본 LLM UI 생성 경로는 유지한다. 이 방식은 모델이 차트 수치를 재작성하지 않게 한다.

최종 values의 `presentation = {id, program}`을 Host가 현재 assistant message ID에 연결한다. values는 snapshot으로 교체하며 delta처럼 누적하지 않는다. 그래프 선택 목록은 채팅 계약이 확인된 starter_graph, simple_llm, technical_analysis_agent와 환경변수로 지정된 기본 assistant다. 모든 등록 서브그래프를 채팅 대상으로 노출하지 않는다.

## 실행과 검증

프로젝트 루트에서 별도 터미널로 실행한다.

```sh
pnpm -C 3-langgraph-fast dev:langgraph
pnpm -C 1-fe-host dev
```

기본 runtime은 2024, Host는 2800이다. 모델 설정은 Python 패키지 `.env`의 기존 OpenAI 호환 설정을 사용한다. UI validator 기본값은 Host 2800이며 `SEC_CHAT_UI_VALIDATOR_URL`로 변경할 수 있다. 사용자 UI는 `http://127.0.0.1:2800/chat`이다.

```sh
pnpm -C 3-langgraph-fast test tests/test_technical_analysis_agent.py tests/graph/subgraph/price_agent tests/infrastructure/technical_analysis tests/graph/shared/cache
pnpm -C 1-fe-host typecheck
pnpm -C 1-fe-host lint
pnpm -C 1-fe-host exec vitest run --project storybook --maxWorkers=1 --no-file-parallelism src/_pages/chat/ui/GraphSelector.stories.tsx src/_pages/chat/ui/ChatMessageList.stories.tsx
# from 3-langgraph-fast/bruno-api-tests:
../node_modules/.bin/bru run 19-technical-analysis --env local --env-var baseUrl=http://127.0.0.1:2024
```

Bruno는 실제 Yahoo·모델·Host validator 연결이 필요하다. 테스트용 thread/assistant를 생성하고 삭제한다. 필수 검증과 정리 원칙은 [검증 지도](../../validation/INDEX.md), 실행 증거는 [flow](../../flow/2026-11-08-technical-analysis-agent.md)에 기록한다.
