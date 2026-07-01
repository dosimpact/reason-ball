from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects.project_02_search_agent.agent import run_search_agent


class SearchAgentState(TypedDict):
    query: NotRequired[str]
    result: NotRequired[dict[str, Any]]
    answer: NotRequired[str]
    error: NotRequired[str]


DEFAULT_QUERY = "Search for recent LangChain agent examples and summarize useful sources."


def search_node(state: SearchAgentState) -> dict[str, Any]:
    try:
        result = run_search_agent(state.get("query") or DEFAULT_QUERY)
        structured = result.get("structured_response")
        return {
            "result": result,
            "answer": str(structured or result["messages"][-1].content),
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


builder = StateGraph(SearchAgentState)
builder.add_node("search", search_node)
builder.add_edge(START, "search")
builder.add_edge("search", END)

graph = builder.compile()

