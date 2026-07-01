from __future__ import annotations

from typing import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects.project_03_agents_under_the_hood.langchain_tool_calling import (
    run_agent,
)


class AgentLoopState(TypedDict):
    question: NotRequired[str]
    answer: NotRequired[str]
    error: NotRequired[str]


DEFAULT_QUESTION = "What is the price of a laptop after applying a gold discount?"


def run_agent_loop_node(state: AgentLoopState) -> dict[str, str]:
    try:
        answer = run_agent(state.get("question") or DEFAULT_QUESTION)
        return {"answer": str(answer), "error": ""}
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


builder = StateGraph(AgentLoopState)
builder.add_node("run_agent_loop", run_agent_loop_node)
builder.add_edge(START, "run_agent_loop")
builder.add_edge("run_agent_loop", END)

graph = builder.compile()

