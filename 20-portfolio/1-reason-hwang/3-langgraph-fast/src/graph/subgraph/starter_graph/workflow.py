from __future__ import annotations

import os
from typing import cast

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import create_react_agent

from graph.subgraph.starter_graph.state import StarterGraphState
from graph.subgraph.starter_graph.tools import get_weather

SYSTEM_PROMPT = (
    "You are a concise assistant. Use the get_weather tool when the user asks "
    "for weather information. Answer in the user's language."
)


def build_react_agent():
    model = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:18741/v1"),
        api_key=lambda: os.getenv("OPENAI_API_KEY", "chatgpt-oauth-placeholder"),
    )
    return create_react_agent(
        model,
        tools=[get_weather],
        prompt=SYSTEM_PROMPT,
        state_schema=StarterGraphState,
        name="starter_react_agent",
    )


_react_agent = build_react_agent()


async def react_agent(state: StarterGraphState) -> dict[str, list[BaseMessage]]:
    result = await _react_agent.ainvoke({"messages": state["messages"]})
    return {"messages": cast(list[BaseMessage], result["messages"])}


def build_starter_graph():
    graph = StateGraph(StarterGraphState)
    graph.add_node("react_agent", react_agent)
    graph.add_edge(START, "react_agent")
    graph.add_edge("react_agent", END)
    return graph.compile()


starter_graph = build_starter_graph()


async def run_starter_graph(message: str) -> StarterGraphState:
    initial_state: StarterGraphState = {
        "messages": [HumanMessage(content=message)],
    }
    result = await starter_graph.ainvoke(initial_state)
    return cast(StarterGraphState, result)


def get_last_ai_message(state: StarterGraphState) -> str:
    for message in reversed(state["messages"]):
        if isinstance(message, AIMessage):
            content = message.content
            if isinstance(content, str):
                return content
            return str(content)
    return ""
