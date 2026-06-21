"""Example 04: graph designed to compare LangGraph stream modes."""

from __future__ import annotations

import time
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


class StreamingState(TypedDict, total=False):
    prompt: str
    prepared_prompt: str
    answer: str
    final: str
    progress: list[dict[str, Any]]


def _progress_event(node: str, phase: str, progress: float, detail: str) -> dict[str, Any]:
    return {
        "node": node,
        "phase": phase,
        "progress": progress,
        "detail": detail,
    }


def _append_progress(state: StreamingState, event: dict[str, Any]) -> list[dict[str, Any]]:
    return state.get("progress", []) + [event]


def prepare_prompt(state: StreamingState) -> dict:
    prompt = state.get(
        "prompt",
        "Explain how LangGraph streaming helps a React UI.",
    )
    prepared_prompt = (
        "Answer for a developer learning LangGraph SDK streaming modes. "
        f"Prompt: {prompt}. Keep it under 55 words."
    )
    event = _progress_event(
        "prepare_prompt",
        "prepared",
        0.25,
        "Prompt normalized for the model call.",
    )
    get_stream_writer()(event)
    time.sleep(0.05)
    return {
        "prompt": prompt,
        "prepared_prompt": prepared_prompt,
        "progress": _append_progress(state, event),
    }


def call_model(state: StreamingState) -> dict:
    start_event = _progress_event(
        "call_model",
        "model_start",
        0.5,
        "OpenAI call started.",
    )
    get_stream_writer()(start_event)

    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the Streaming UI example. Explain concrete runtime "
                    "signals without exposing hidden reasoning."
                )
            ),
            HumanMessage(content=state["prepared_prompt"]),
        ]
    )
    answer = response.content if isinstance(response.content, str) else str(response.content)

    done_event = _progress_event(
        "call_model",
        "model_done",
        0.8,
        "OpenAI response received.",
    )
    get_stream_writer()(done_event)
    return {
        "answer": answer,
        "progress": _append_progress(state, start_event) + [done_event],
    }


def finalize(state: StreamingState) -> dict:
    event = _progress_event(
        "finalize",
        "complete",
        1.0,
        "Final state assembled.",
    )
    get_stream_writer()(event)
    final = f"Streaming UI result: {state.get('answer', '')}"
    return {
        "final": final,
        "progress": _append_progress(state, event),
    }


def build_graph():
    builder = StateGraph(StreamingState)
    builder.add_node("prepare_prompt", prepare_prompt)
    builder.add_node("call_model", call_model)
    builder.add_node("finalize", finalize)
    builder.add_edge(START, "prepare_prompt")
    builder.add_edge("prepare_prompt", "call_model")
    builder.add_edge("call_model", "finalize")
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {
            "prompt": "Explain streaming modes in LangGraph.",
            "progress": [],
        }
    )
    print(out["final"])
