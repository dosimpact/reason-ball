from __future__ import annotations

from dataclasses import asdict
from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from langgraph_fast.domains.tenk.retrieval import RetrievalService
from langgraph_fast.graph.tenk.state import TenkGraphState


def build_tenk_graph():
    graph = StateGraph(TenkGraphState)
    graph.add_node("retrieve_and_answer", retrieve_and_answer)
    graph.add_edge(START, "retrieve_and_answer")
    graph.add_edge("retrieve_and_answer", END)
    return graph.compile()


def retrieve_and_answer(state: TenkGraphState) -> dict[str, Any]:
    service = RetrievalService()
    try:
        answer, result = service.answer(query=state["query"], selected_filing=state.get("selected_filing"))
    finally:
        service.close()
    return {
        "intent": result.intent,
        "answer": answer,
        "evidence": [asdict(evidence) for evidence in result.evidence_bundle],
    }


async def run_tenk_graph(query: str, selected_filing: dict[str, Any] | None = None) -> TenkGraphState:
    app = build_tenk_graph()
    initial_state: TenkGraphState = {
        "query": query,
        "selected_filing": selected_filing,
        "intent": "",
        "answer": "",
        "evidence": [],
    }
    return cast(TenkGraphState, await app.ainvoke(initial_state))
