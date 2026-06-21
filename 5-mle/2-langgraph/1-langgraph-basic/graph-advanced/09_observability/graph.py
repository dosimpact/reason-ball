"""
09 — Observability (LangSmith trace + 자체 토큰/비용 메트릭).

LangSmith 환경변수가 켜져 있으면 모든 LLM/노드 호출이 자동 trace.
추가로 state.metrics 에 input_tokens / output_tokens / cost_estimate 를 누적
저장해 LangSmith 없이도 단독 실행에서 비용을 가늠할 수 있게 한다.

핵심 메커니즘
-------------
- LangSmith: LANGCHAIN_TRACING_V2=true / LANGCHAIN_API_KEY=... 만 있으면 SDK 자동 후킹
- 자체 메트릭: agent 노드가 LLM 응답의 usage_metadata 를 읽어 state.metrics 에 추가
- PRICING dict: 모델별 1k-token 가격 (USD) 으로 cost_estimate 계산
- (선택) Prometheus pushgateway 연동은 README 의 Optional 섹션 참고

그래프 구조
-----------
START ─▶ agent ⇄ tools ─▶ END
        (agent 노드가 매 LLM 호출 후 metrics 갱신)

테스트 시나리오
---------------
1) (선택) export LANGCHAIN_TRACING_V2=true LANGCHAIN_API_KEY=...
2) python graph.py
3) 콘솔에 turn 별 토큰 / 누적 비용 출력 확인
4) LangSmith UI 에서 trace 트리 시각화 확인
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Annotated, TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parent))

from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from langchain_core.tools import BaseTool
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from common.llm import create_llm, DEFAULT_MODEL
from tools import TOOLS
from metrics import PRICING, estimate_cost, merge_metrics, MetricsRecord


class State(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    metrics: list[MetricsRecord]   # 매 LLM 호출 후 1개씩 append
    total_cost_usd: float


SYSTEM_PROMPT = (
    "You are a helpful AI assistant. Use tools when appropriate. "
    "Keep answers concise."
)


def _make_agent():
    llm = create_llm()
    bound = llm.bind_tools(TOOLS)
    model_alias = DEFAULT_MODEL

    def call_model(state: State) -> dict:
        msgs = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
        resp = bound.invoke(msgs)

        # usage_metadata 는 langchain-core 가 표준화해서 채워줌
        usage = getattr(resp, "usage_metadata", None) or {}
        in_tok = int(usage.get("input_tokens", 0))
        out_tok = int(usage.get("output_tokens", 0))
        cost = estimate_cost(model_alias, in_tok, out_tok)

        record: MetricsRecord = {
            "model": model_alias,
            "input_tokens": in_tok,
            "output_tokens": out_tok,
            "cost_usd": cost,
        }
        new_metrics = list(state.get("metrics", [])) + [record]
        return {
            "messages": [resp],
            "metrics": new_metrics,
            "total_cost_usd": sum(m["cost_usd"] for m in new_metrics),
        }

    return call_model


def _should_continue(state: State):
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "__end__"


def build_graph():
    b = StateGraph(State)
    b.add_node("agent", _make_agent())
    b.add_node("tools", ToolNode(TOOLS))
    b.add_edge(START, "agent")
    b.add_conditional_edges("agent", _should_continue, {"tools": "tools", "__end__": END})
    b.add_edge("tools", "agent")
    return b.compile()


graph = build_graph()


if __name__ == "__main__":
    questions = [
        "지금 몇 시야?",
        "방금 알려준 시간에서 3시간 뒤는?",
        "12 * (7 + 5) 는?",
    ]
    state: dict = {"messages": []}
    for i, q in enumerate(questions, 1):
        state["messages"] = state.get("messages", []) + [HumanMessage(content=q)]
        state = graph.invoke(state)
        last = state["messages"][-1].content
        if isinstance(last, list):
            last = " ".join(b.get("text", "") for b in last if isinstance(b, dict))
        print(f"\n[turn {i}] Q: {q}")
        print(f"        A: {last}")
        last_metric = state["metrics"][-1] if state.get("metrics") else None
        if last_metric:
            print(
                f"        tokens: in={last_metric['input_tokens']} "
                f"out={last_metric['output_tokens']} "
                f"cost=${last_metric['cost_usd']:.6f}"
            )

    print("\n=== summary ===")
    print(f"LLM 호출 횟수: {len(state.get('metrics', []))}")
    print(f"누적 비용: ${state.get('total_cost_usd', 0.0):.6f}")
    print(f"가격표 (per 1k tokens, USD): {PRICING}")
