"""Example 07: checkpointed state history with visible state mutations."""

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


class CheckpointHistoryState(TypedDict, total=False):
    topic: str
    prompt: str
    draft: str
    final: str
    stage: str
    revision_count: int
    key_takeaways: list[str]
    history_events: list[dict[str, Any]]


def _append_event(
    state: CheckpointHistoryState,
    *,
    node: str,
    detail: str,
) -> list[dict[str, Any]]:
    events = state.get("history_events", [])
    return events + [
        {
            "index": len(events) + 1,
            "node": node,
            "detail": detail,
        }
    ]


def prepare_request(state: CheckpointHistoryState) -> dict:
    topic = state.get("topic", "checkpoint history for LangGraph debugging")
    prompt = (
        "Explain why checkpoint history helps debug LangGraph runs. "
        f"Focus on this topic: {topic}. Keep the answer under 50 words."
    )
    return {
        "topic": topic,
        "prompt": prompt,
        "stage": "prepared",
        "revision_count": 1,
        "history_events": _append_event(
            state,
            node="prepare_request",
            detail="Input normalized and model prompt prepared.",
        ),
    }


def draft_answer(state: CheckpointHistoryState) -> dict:
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the Checkpoint State History UI example. "
                    "Return a concise, concrete explanation for SDK learners."
                )
            ),
            HumanMessage(content=state["prompt"]),
        ]
    )
    draft = response.content if isinstance(response.content, str) else str(response.content)
    return {
        "draft": draft,
        "stage": "drafted",
        "revision_count": state.get("revision_count", 1) + 1,
        "history_events": _append_event(
            state,
            node="draft_answer",
            detail="OpenAI returned a draft explanation.",
        ),
    }


def finalize_answer(state: CheckpointHistoryState) -> dict:
    topic = state.get("topic", "checkpoint history")
    draft = state.get("draft", "")
    final = f"Checkpoint history for {topic}: {draft}"
    return {
        "final": final,
        "stage": "finalized",
        "revision_count": state.get("revision_count", 2) + 1,
        "key_takeaways": [
            "Each checkpoint captures state after a graph step.",
            "History lets the UI inspect older values without rerunning.",
            "Diffs make state changes easier to explain.",
        ],
        "history_events": _append_event(
            state,
            node="finalize_answer",
            detail="Final response and learning takeaways assembled.",
        ),
    }


def build_graph():
    builder = StateGraph(CheckpointHistoryState)
    builder.add_node("prepare_request", prepare_request)
    builder.add_node("draft_answer", draft_answer)
    builder.add_node("finalize_answer", finalize_answer)
    builder.add_edge(START, "prepare_request")
    builder.add_edge("prepare_request", "draft_answer")
    builder.add_edge("draft_answer", "finalize_answer")
    builder.add_edge("finalize_answer", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import MemorySaver

    demo_builder = StateGraph(CheckpointHistoryState)
    demo_builder.add_node("prepare_request", prepare_request)
    demo_builder.add_node("draft_answer", draft_answer)
    demo_builder.add_node("finalize_answer", finalize_answer)
    demo_builder.add_edge(START, "prepare_request")
    demo_builder.add_edge("prepare_request", "draft_answer")
    demo_builder.add_edge("draft_answer", "finalize_answer")
    demo_builder.add_edge("finalize_answer", END)
    local = demo_builder.compile(checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": "checkpoint-demo"}}
    out = local.invoke({"topic": "debugging state changes"}, config=cfg)
    print(out["final"])
