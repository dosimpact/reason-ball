import asyncio

from langchain_core.messages import AIMessage

from graph.subgraph.starter_graph import workflow


class FakeReactAgent:
    async def ainvoke(self, state):
        return {"messages": [*state["messages"], AIMessage(content="starter response")]}


def test_run_starter_graph_returns_ai_message(monkeypatch) -> None:
    monkeypatch.setattr(workflow, "_react_agent", FakeReactAgent())

    result = asyncio.run(workflow.run_starter_graph("hello"))

    assert workflow.get_last_ai_message(result) == "starter response"
