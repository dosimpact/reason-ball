"""
Eval Harness — golden dataset 기반 ReAct 그래프 평가용 그래프.

심화주제 §8 직접 구현. 기본 ReAct 그래프이며, `run.py` 에서 batch 평가에 사용됩니다.

그래프 구조
-----------
START ─▶ agent ⇄ tools ─▶ END
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Literal

sys.path.insert(0, str(Path(__file__).resolve().parent))

from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm
from tools import TOOLS

SYSTEM_PROMPT = (
    "You are a helpful assistant. Use the available tools when appropriate. "
    "Be concise and accurate."
)


def make_agent_node():
    llm = create_llm().bind_tools(TOOLS)

    def call_model(state: MessagesState) -> dict:
        response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
        return {"messages": [response]}

    return call_model


def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "__end__"


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("agent", make_agent_node())
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke({"messages": [HumanMessage(content="지금 몇 시야?")]})
    print(out["messages"][-1].content)
