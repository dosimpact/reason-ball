"""MCP 형태의 도구 발견과 호출을 에이전트에 연결하는 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects_2.project_13_mcp_tools_agent.agent import run_mcp_agent


class MCPToolsAgentState(TypedDict):
    question: NotRequired[str]
    answer: NotRequired[str]
    tool_name: NotRequired[str | None]
    tool_result: NotRequired[Any]
    error: NotRequired[str]


DEFAULT_QUESTION = "프로젝트 폴더의 파일 목록을 알려줘"


def mcp_agent_node(state: MCPToolsAgentState) -> dict[str, Any]:
    result = run_mcp_agent(state.get("question") or DEFAULT_QUESTION)
    return result


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(MCPToolsAgentState)
builder.add_node("mcp_agent", mcp_agent_node)
builder.add_edge(START, "mcp_agent")
builder.add_edge("mcp_agent", END)

graph = builder.compile()
