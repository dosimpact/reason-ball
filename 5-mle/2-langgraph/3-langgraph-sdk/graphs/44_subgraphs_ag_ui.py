"""Example 44: CopilotKit AG-UI subgraph coordination graph."""

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


def _preview(text: str, limit: int = 96) -> str:
    cleaned = " ".join(str(text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rstrip()}..."


@tool("run_subgraph_workers")
def run_subgraph_workers(task: str) -> dict[str, Any]:
    """Run deterministic worker subgraphs and aggregate their results."""
    prompt = _preview(task or "Prepare a release readiness brief for a LangGraph SDK demo.")
    workers = [
        {
            "id": "research_subgraph",
            "name": "Research subgraph",
            "task": "Collect the concrete facts needed for the answer.",
            "status": "completed",
            "progress": 1,
            "partial_result": "Found three stable facts and one assumption to verify.",
            "result": f"Source task: {prompt}. Key fact: the user needs a concise AG-UI coordination demo.",
        },
        {
            "id": "analysis_subgraph",
            "name": "Analysis subgraph",
            "task": "Turn facts into risks, priorities, and ordering.",
            "status": "completed",
            "progress": 1,
            "partial_result": "Ranked output quality ahead of breadth.",
            "result": "Recommendation: keep worker state explicit, deterministic, and easy to inspect.",
        },
        {
            "id": "writing_subgraph",
            "name": "Writing subgraph",
            "task": "Compose the parent-facing final response.",
            "status": "completed",
            "progress": 1,
            "partial_result": "Drafted a short synthesis from the worker outputs.",
            "result": "Final response should name each worker contribution and the parent aggregation.",
        },
    ]
    return {
        "run_id": "subgraphs-demo-44",
        "task": prompt,
        "parent_state": {
            "route": "parallel_workers",
            "active_worker_count": len(workers),
            "aggregation_status": "completed",
        },
        "workers": workers,
        "failed_workers": [],
        "aggregate": (
            "The parent graph routed the task through research, analysis, and writing subgraphs, "
            "then aggregated their completed outputs into one response."
        ),
    }


SYSTEM_PROMPT = (
    "You are the Subgraphs AG-UI demo agent. For any user task, call "
    "run_subgraph_workers exactly once. After the tool returns, summarize the parent "
    "state, each worker result, and the aggregate in concise language."
)


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[run_subgraph_workers],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
