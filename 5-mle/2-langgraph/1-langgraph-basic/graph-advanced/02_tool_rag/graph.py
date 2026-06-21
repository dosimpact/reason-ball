"""
Tool RAG — 50+ tool 중 의미적으로 관련된 top-k 만 LLM 에 bind.

심화주제 §2 직접 구현. tool 수가 늘어나면 모든 tool description 을 매번 LLM 에 주는 것이
프롬프트 비용·정확도 모두 악화시키므로, 사용자 질문에 따라 retrieval 로 사전 필터링합니다.

핵심 메커니즘
-------------
- 각 tool 의 (name + description + examples) 를 Titan v2 임베딩
- 사용자 질문 임베딩과 코사인 유사도 top-k=5 만 선택
- 선택된 tool 만 `llm.bind_tools(...)` 한 뒤 ReAct 실행

그래프 구조
-----------
START ─▶ select_tools ─▶ agent ⇄ tools ─▶ END

테스트 시나리오
---------------
"내일 도쿄 날씨 알려줘" → weather_* tool 들이 우선 선택되는지 검증
"AAPL 주가 어때" → stock_* 우선
"users 테이블 row 보여줘" → db_query_users 등 우선
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Literal

sys.path.insert(0, str(Path(__file__).resolve().parent))

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.tools import BaseTool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm
from tool_catalog import TOOLS_BY_NAME
from tool_index import select_tools


class State(MessagesState):
    selected_tool_names: list[str]


def _last_user_text(state: MessagesState) -> str:
    for m in reversed(state["messages"]):
        if isinstance(m, HumanMessage):
            content = m.content
            if isinstance(content, list):
                return " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            return str(content)
    return ""


def select_tools_node(state: State) -> dict:
    """질문 임베딩 → top-k tool 이름 추출."""
    query = _last_user_text(state)
    if not query:
        return {"selected_tool_names": []}
    selected = select_tools(query, k=5)
    names = [t.name for t in selected]
    print(f"[tool-rag] q={query!r}\n           selected={names}")
    return {"selected_tool_names": names}


def agent_node(state: State) -> dict:
    """선택된 tool 만 bind 해서 LLM 호출."""
    names = state.get("selected_tool_names") or []
    selected: list[BaseTool] = [TOOLS_BY_NAME[n] for n in names if n in TOOLS_BY_NAME]
    llm = create_llm()
    bound = llm.bind_tools(selected) if selected else llm
    system = SystemMessage(
        content=(
            "You are an assistant with a curated tool subset selected by retrieval. "
            "Use a tool when its description matches the user's intent. "
            "If none of the bound tools fit, answer from general knowledge."
        )
    )
    response = bound.invoke([system] + state["messages"])
    return {"messages": [response]}


def make_dynamic_tool_node():
    """selected_tool_names 에 맞춰 매 호출마다 ToolNode 를 재구성."""

    def _run(state: State) -> dict:
        names = state.get("selected_tool_names") or []
        selected = [TOOLS_BY_NAME[n] for n in names if n in TOOLS_BY_NAME]
        node = ToolNode(selected)
        return node.invoke(state)

    return _run


def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "__end__"


def build_graph():
    builder = StateGraph(State)
    builder.add_node("select_tools", select_tools_node)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", make_dynamic_tool_node())

    builder.add_edge(START, "select_tools")
    builder.add_edge("select_tools", "agent")
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    queries = [
        "내일 도쿄 날씨 알려줘",
        "AAPL 주가 어때?",
        "users 테이블 row 보여줘",
        "이거 일본어로 번역해줘",
    ]
    for q in queries:
        print("=" * 60)
        out = graph.invoke({"messages": [HumanMessage(content=q)]})
        last = out["messages"][-1]
        content = last.content
        if isinstance(content, list):
            content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
        print(f"[answer] {content}\n")
