"""검색 도구를 사용하는 LangChain 에이전트 흐름을 보여주는 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

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


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(SearchAgentState)
builder.add_node("search", search_node)
builder.add_edge(START, "search")
builder.add_edge("search", END)

graph = builder.compile()

