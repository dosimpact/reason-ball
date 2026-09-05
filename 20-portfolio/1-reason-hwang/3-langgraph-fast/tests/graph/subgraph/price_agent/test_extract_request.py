import importlib

import pytest
from langchain_core.messages import AIMessage, HumanMessage

extract_node = importlib.import_module(
    "graph.subgraph.price_agent.node.extract_request"
)


class FakeModel:
    def __init__(self, response: AIMessage) -> None:
        self.response = response
        self.calls = 0
        self.messages = []

    async def ainvoke(self, messages):
        self.calls += 1
        self.messages = messages
        return self.response


@pytest.mark.asyncio
async def test_extract_request_calls_model_once_and_emits_tool_call(monkeypatch) -> None:
    response = AIMessage(
        content="",
        tool_calls=[
            {
                "name": "get_historical_prices",
                "args": {"symbol": "CPNG", "interval": "1d", "count": 10},
                "id": "call-1",
                "type": "tool_call",
            }
        ],
    )
    model = FakeModel(response)
    monkeypatch.setattr(extract_node, "_request_model", model)

    result = await extract_node.extract_request(
        {"query": "쿠팡 최근 10일", "messages": [HumanMessage(content="쿠팡 최근 10일")]}
    )

    assert model.calls == 1
    assert result["messages"][0].tool_calls[0]["args"]["symbol"] == "CPNG"
    assert result.get("error_code") is None


@pytest.mark.asyncio
async def test_extract_request_marks_missing_tool_call(monkeypatch) -> None:
    model = FakeModel(AIMessage(content="I cannot identify it"))
    monkeypatch.setattr(extract_node, "_request_model", model)

    result = await extract_node.extract_request(
        {"query": "그 회사 가격", "messages": [HumanMessage(content="그 회사 가격")]}
    )

    assert result["error_code"] == "tool_call_missing"
