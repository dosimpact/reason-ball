import asyncio

from langchain_core.messages import AIMessage

from graph.primary_graphs.simple_llm import workflow
from graph.primary_graphs.simple_llm.node import llm as node
from graph.primary_graphs.simple_llm.tools import get_weather
from graph.primary_graphs.simple_llm.tools.weather import fetch_weather_summary


class FakeReactAgent:
    async def ainvoke(self, state):
        return {
            "messages": [
                *state["messages"],
                AIMessage(content="The current weather is clear."),
            ]
        }


def test_simple_llm_exposes_weather_tool() -> None:
    assert get_weather.name == "get_weather"
    assert fetch_weather_summary.__module__ == (
        "graph.primary_graphs.simple_llm.tools.weather"
    )


def test_run_simple_llm_returns_ai_message(monkeypatch) -> None:
    monkeypatch.setattr(node, "_react_agent", FakeReactAgent())

    result = asyncio.run(workflow.run_simple_llm("What is the weather in Seoul?"))

    assert workflow.get_last_ai_message(result) == "The current weather is clear."
