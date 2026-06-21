"""Example 35: CopilotKit AG-UI agentic chat graph."""

from __future__ import annotations

from typing import Any

from copilotkit import CopilotKitMiddleware
from langchain.agents import create_agent
from langchain_core.tools import tool

from common.llm import create_llm


@tool("get_weather")
def get_weather(location: str) -> dict[str, Any]:
    """Get weather for a location."""
    return {
        "city": location,
        "temperature": 20,
        "conditions": "sunny",
        "humidity": 50,
        "windSpeed": 10,
        "wind_speed": 10,
        "feelsLike": 25,
    }


SYSTEM_PROMPT = (
    "You are a helpful assistant. Use get_weather when the user asks about "
    "weather, and otherwise answer conversationally and concisely."
)


def build_graph():
    return create_agent(
        model=create_llm(),
        tools=[get_weather],
        system_prompt=SYSTEM_PROMPT,
        middleware=[CopilotKitMiddleware()],
    )


graph = build_graph()
