"""Example 08: replay a thread from a selected checkpoint."""

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


class TimeTravelReplayState(TypedDict, total=False):
    topic: str
    replay_instruction: str
    run_label: str
    source_checkpoint_id: str
    prompt: str
    draft: str
    final: str
    stage: str
    revision_count: int
    branch_summary: str
    comparison_points: list[str]
    history_events: list[dict[str, Any]]


def _append_event(
    state: TimeTravelReplayState,
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


def prepare_replay(state: TimeTravelReplayState) -> dict:
    topic = state.get("topic", "checkpoint replay debugging")
    instruction = state.get(
        "replay_instruction",
        "Compare the replay branch with the original checkpoint path.",
    )
    run_label = state.get("run_label", "original")
    source_checkpoint_id = state.get("source_checkpoint_id", "latest")
    prompt = (
        "Explain this LangGraph time-travel replay branch for SDK learners.\n"
        f"Run label: {run_label}\n"
        f"Source checkpoint: {source_checkpoint_id}\n"
        f"Topic: {topic}\n"
        f"Replay instruction: {instruction}\n"
        "Keep the answer under 55 words and make the branch outcome concrete."
    )
    return {
        "topic": topic,
        "replay_instruction": instruction,
        "run_label": run_label,
        "source_checkpoint_id": source_checkpoint_id,
        "prompt": prompt,
        "stage": "prepared",
        "revision_count": 1,
        "history_events": _append_event(
            state,
            node="prepare_replay",
            detail=f"Prepared {run_label} branch prompt.",
        ),
    }


def draft_replay(state: TimeTravelReplayState) -> dict:
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the Time Travel Replay UI example. "
                    "Describe replay and fork behavior concretely for a developer."
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
            node="draft_replay",
            detail="OpenAI returned branch-specific replay text.",
        ),
    }


def finalize_replay(state: TimeTravelReplayState) -> dict:
    run_label = state.get("run_label", "original")
    topic = state.get("topic", "checkpoint replay")
    source_checkpoint_id = state.get("source_checkpoint_id", "latest")
    draft = state.get("draft", "")
    branch_summary = (
        f"{run_label} branch from checkpoint {source_checkpoint_id} finished with topic: {topic}"
    )
    final = f"{run_label.upper()} REPLAY RESULT: {draft}"
    return {
        "final": final,
        "stage": "finalized",
        "revision_count": state.get("revision_count", 2) + 1,
        "branch_summary": branch_summary,
        "comparison_points": [
            f"run_label={run_label}",
            f"source_checkpoint_id={source_checkpoint_id}",
            f"topic={topic}",
        ],
        "history_events": _append_event(
            state,
            node="finalize_replay",
            detail="Replay branch finalized for side-by-side comparison.",
        ),
    }


def build_graph():
    builder = StateGraph(TimeTravelReplayState)
    builder.add_node("prepare_replay", prepare_replay)
    builder.add_node("draft_replay", draft_replay)
    builder.add_node("finalize_replay", finalize_replay)
    builder.add_edge(START, "prepare_replay")
    builder.add_edge("prepare_replay", "draft_replay")
    builder.add_edge("draft_replay", "finalize_replay")
    builder.add_edge("finalize_replay", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import MemorySaver

    demo_builder = StateGraph(TimeTravelReplayState)
    demo_builder.add_node("prepare_replay", prepare_replay)
    demo_builder.add_node("draft_replay", draft_replay)
    demo_builder.add_node("finalize_replay", finalize_replay)
    demo_builder.add_edge(START, "prepare_replay")
    demo_builder.add_edge("prepare_replay", "draft_replay")
    demo_builder.add_edge("draft_replay", "finalize_replay")
    demo_builder.add_edge("finalize_replay", END)
    local = demo_builder.compile(checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": "time-travel-demo"}}
    out = local.invoke({"topic": "debugging replay branches"}, config=cfg)
    print(out["final"])
