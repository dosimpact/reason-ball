"""Example 05: ReAct-style tool calling graph for UI inspection."""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm


@tool("calculator")
def calculator(expression: str) -> str:
    """Evaluate a numeric expression using only digits and basic operators."""
    allowed = set("0123456789+-*/.() ")
    if not all(character in allowed for character in expression):
        return "Error: only digits and + - * / . ( ) are allowed."
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))  # noqa: S307
    except Exception as error:  # pragma: no cover - defensive for malformed model args
        return f"Error: {error}"


@tool("lookup_langgraph_term")
def lookup_langgraph_term(topic: str) -> str:
    """Return a short deterministic description for a LangGraph-related topic."""
    terms = {
        "thread": "A LangGraph thread stores state and checkpoint history across runs.",
        "toolnode": "ToolNode executes tool calls requested by an AI message.",
        "react": "ReAct alternates model reasoning actions with tool observations.",
        "langgraph": "LangGraph builds stateful graph workflows around LLM calls and tools.",
    }
    key = topic.lower().strip()
    for term, description in terms.items():
        if term in key:
            return description
    return f"No local entry for {topic}."


TOOLS = [calculator, lookup_langgraph_term]

SYSTEM_PROMPT = (
    "You are the Tool Calling / ReAct UI example. Use the calculator tool for "
    "arithmetic and lookup_langgraph_term for LangGraph terms. After every tool "
    "result, give a concise final answer that explicitly mentions the result. "
    "For 12 * 7, the final answer must include 84."
)


def call_model(state: MessagesState) -> dict:
    llm = create_llm().bind_tools(TOOLS)
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    return {"messages": [response]}


def route_after_agent(state: MessagesState) -> Literal["tools", "__end__"]:
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return "__end__"


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("agent", call_model)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", route_after_agent, {"tools": "tools", "__end__": END})
    builder.add_edge("tools", "agent")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke(
        {"messages": [HumanMessage(content="Use the calculator tool to multiply 12 by 7.")]}
    )
    print(out["messages"][-1].content)
