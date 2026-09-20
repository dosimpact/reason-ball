from __future__ import annotations

from typing import cast

from langchain_core.messages import BaseMessage
from langgraph.prebuilt import create_react_agent

from graph.primary_graphs.simple_llm.state import SimpleLlmState
from graph.primary_graphs.simple_llm.tools import get_weather
from graph.provider import ChatGptOauthProxyProvider

SYSTEM_PROMPT = (
    "You are a concise assistant. Use the get_weather tool whenever the user asks "
    "for current weather. Answer in the user's language."
)


def build_react_agent():
    return create_react_agent(
        ChatGptOauthProxyProvider().chat_model(),
        tools=[get_weather],
        prompt=SYSTEM_PROMPT,
        state_schema=SimpleLlmState,
        name="simple_llm_react_agent",
    )


_react_agent = build_react_agent()


async def call_llm(state: SimpleLlmState) -> dict[str, list[BaseMessage]]:
    result = await _react_agent.ainvoke({"messages": state["messages"]})
    return {"messages": cast(list[BaseMessage], result["messages"])}
