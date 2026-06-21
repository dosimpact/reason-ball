# 09 — Observability (LangSmith + 자체 토큰/비용 메트릭)

## 1. 한 줄 소개
ReAct 그래프에 LangSmith trace 자동 통합 + state 안에 토큰/비용을 누적 기록하는 운영 가시성 패턴.

## 2. 왜 필요한가
LangGraph 가 프로덕션에 들어가면 즉시 다음을 알아야 한다:
- 어느 노드가 느린가 (p95 latency)
- LLM 토큰을 얼마나 쓰는가 (월 비용)
- Tool 실패율
- recursion_limit 근접 사이클

LangSmith 만 켜면 trace 트리가 자동으로 잡힌다. 그러나 trace 만으로는
"이번 turn 의 비용 = 얼마" 같은 즉답이 어렵기 때문에 **state.metrics** 도 함께 쌓는다.

## 3. 어떻게 해결하는가
- **LangSmith 자동 trace**: `LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY` 만 있으면 SDK 가
  모든 노드/LLM 호출을 자동 후킹. 코드 변경 0줄.
- **자체 메트릭**: `agent` 노드가 LLM 응답의 `usage_metadata` 를 읽어
  `MetricsRecord` 1개를 `state.metrics` 에 append.
- **비용 추정**: `metrics.PRICING` dict (모델별 1k-token 가격) 로 즉석 계산.
- **누적**: `state.total_cost_usd` 가 turn 마다 갱신.

## 4. 그래프 구조
```
START ─▶ agent ⇄ tools ─▶ END
         │
         └─ (매 호출 후) state.metrics.append({tokens, cost})
                        state.total_cost_usd 갱신
```

## 5. 실행 방법
```bash
uv sync --extra advanced
cp graph-advanced/09_observability/.env.example .env

# (옵션) LangSmith 활성화 — 키가 없어도 단독 실행은 정상 작동
# .env 의 LANGCHAIN_TRACING_V2 / LANGCHAIN_API_KEY / LANGCHAIN_PROJECT 채우기

uv run python graph-advanced/09_observability/graph.py
# 또는
uv run langgraph dev --config langgraph-advanced.json
```

## 6. 검증 시나리오
**시나리오 A — 로컬 메트릭만**
1. LANGCHAIN_API_KEY 비워두고 `python graph.py`
2. turn 별로 `tokens: in=... out=... cost=$...` 출력 확인
3. 마지막에 누적 비용 + 가격표 출력

**시나리오 B — LangSmith UI**
1. .env 에 LANGCHAIN_TRACING_V2=true / API_KEY 세팅
2. `python graph.py` 실행
3. https://smith.langchain.com → 프로젝트 `langgraph-advanced-09` 에서:
   - 노드별 latency 트리
   - 각 LLM 호출의 input/output token
   - tool 호출 결과 / 에러

**시나리오 C — 모델 변경 비용 비교**
- `LANGGRAPH_MODEL=fast python graph.py` vs `=smart python graph.py`
- 동일 질문에서 누적 비용 차이를 확인 (가격표 dict 의 직관과 일치하는지)

## 7. 트레이드오프 / 운영 주의
- **가격표는 수동 갱신**: AWS 가 가격을 바꾸면 `metrics.PRICING` 만 업데이트. 지표는 어디까지나 추정치.
- **usage_metadata 누락**: 일부 응답(에러 / streaming 중간) 은 usage 가 비어있을 수 있음 → 0 으로 카운트.
- **LangSmith 비용**: 트래픽이 크면 LangSmith 자체 요금이 발생. 샘플링 (`LANGCHAIN_TRACING_SAMPLE_RATE`) 검토.
- **민감정보**: trace 에 사용자 입력 그대로 올라감. PII 필터/redaction 노드 권장.
- **state 비대화**: metrics 가 누적되므로 긴 thread 에서 state 가 커짐. 운영에서는 N개 단위로 flush 또는 외부 메트릭 서버로 푸시.

## Optional — Prometheus Pushgateway 스니펫
배포 환경에서 별도 시스템에 메트릭을 보내고 싶다면 (이 프로젝트는 docker compose 미포함):

```python
# pip install prometheus-client
from prometheus_client import CollectorRegistry, Counter, push_to_gateway

registry = CollectorRegistry()
tok_in = Counter("llm_input_tokens_total", "Input tokens", ["model"], registry=registry)
tok_out = Counter("llm_output_tokens_total", "Output tokens", ["model"], registry=registry)
cost = Counter("llm_cost_usd_total", "Estimated cost (USD)", ["model"], registry=registry)

def push(record):
    tok_in.labels(record["model"]).inc(record["input_tokens"])
    tok_out.labels(record["model"]).inc(record["output_tokens"])
    cost.labels(record["model"]).inc(record["cost_usd"])
    push_to_gateway("pushgateway:9091", job="langgraph", registry=registry)
```
agent 노드에서 record 생성 후 `push(record)` 한 줄 추가.

## 8. 부모 graph/NN_*.py 와의 관계
- 베이스: `graph/03_tool_node.py` (ReAct) + `graph/20_history_reducer.py` (state 에 부가 데이터 누적 패턴)
- 추가: LangSmith 환경변수 자동 후킹 + 비용 추정 dict
- 본 프로젝트는 운영 가시성의 **최소 단위**. 실서비스는 OpenTelemetry / Datadog / Grafana 와의 통합을 고려.
