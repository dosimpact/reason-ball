"""Example 03: multi-node graph for execution timeline visualisation."""

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


class TimelineState(TypedDict, total=False):
    topic: str
    prompt: str
    draft: str
    final: str
    steps: list[str]
    node_updates: list[dict[str, Any]]


def _append_update(
    state: TimelineState,
    *,
    node: str,
    status: str,
    detail: str,
) -> list[dict[str, Any]]:
    return state.get("node_updates", []) + [
        {"node": node, "status": status, "detail": detail}
    ]


def prepare_topic(state: TimelineState) -> dict:
    topic = state.get("topic", "LangGraph SDK")
    prompt = (
        "Explain this topic for a developer learning LangGraph SDK UI patterns: "
        f"{topic}. Keep the answer under 40 words."
    )
    return {
        "topic": topic,
        "prompt": prompt,
        "steps": state.get("steps", []) + ["prepare_topic"],
        "node_updates": _append_update(
            state,
            node="prepare_topic",
            status="done",
            detail=f"Prepared prompt for topic: {topic}",
        ),
    }


def call_model(state: TimelineState) -> dict:
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the timeline example node. Produce a concise, concrete "
                    "developer-facing explanation."
                )
            ),
            HumanMessage(content=state["prompt"]),
        ]
    )
    draft = response.content if isinstance(response.content, str) else str(response.content)
    return {
        "draft": draft,
        "steps": state.get("steps", []) + ["call_model"],
        "node_updates": _append_update(
            state,
            node="call_model",
            status="done",
            detail="OpenAI model returned a draft explanation.",
        ),
    }


def finalize(state: TimelineState) -> dict:
    topic = state.get("topic", "LangGraph SDK")
    draft = state.get("draft", "")
    final = f"Timeline result for {topic}: {draft}"
    return {
        "final": final,
        "steps": state.get("steps", []) + ["finalize"],
        "node_updates": _append_update(
            state,
            node="finalize",
            status="done",
            detail="Final response assembled from graph state.",
        ),
    }


def build_graph():
    builder = StateGraph(TimelineState)
    builder.add_node("prepare_topic", prepare_topic)
    builder.add_node("call_model", call_model)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "prepare_topic")
    builder.add_edge("prepare_topic", "call_model")
    builder.add_edge("call_model", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke({"topic": "streaming graph updates", "steps": [], "node_updates": []})
    print(out["final"])
