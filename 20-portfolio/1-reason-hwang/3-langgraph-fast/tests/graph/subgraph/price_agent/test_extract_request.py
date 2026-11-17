import importlib

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

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


@pytest.mark.asyncio
async def test_extract_drops_unanswered_historical_calls_and_clears_old_error(monkeypatch):
    model = FakeModel(AIMessage(content="", tool_calls=[{
        "name": "get_historical_prices", "args": {"symbol": "AAPL"}, "id": "new"
    }]))
    monkeypatch.setattr(extract_node, "_request_model", model)
    orphan = AIMessage(content="", tool_calls=[{
        "name": "get_historical_prices", "args": {"symbol": "CPNG"}, "id": "missing"
    }])
    result = await extract_node.extract_request({
        "messages": [HumanMessage(content="쿠팡 가격"), orphan, HumanMessage(content="애플 가격")],
        "error_code": "provider_error",
    })
    assert all(not getattr(m, "tool_calls", []) for m in model.messages)
    assert model.messages[-1].content == "애플 가격"
    assert orphan.tool_calls[0]["id"] == "missing"
    assert result["error_code"] is None


@pytest.mark.asyncio
async def test_extract_keeps_complete_tool_pairs(monkeypatch):
    model = FakeModel(AIMessage(content="unknown"))
    monkeypatch.setattr(extract_node, "_request_model", model)
    call = AIMessage(content="", tool_calls=[{
        "name": "get_historical_prices", "args": {"symbol": "CPNG"}, "id": "paired"
    }])
    output = ToolMessage(content="CPNG prices", tool_call_id="paired")
    await extract_node.extract_request({"messages": [
        HumanMessage(content="쿠팡 가격"), call, output, HumanMessage(content="이번엔 애플")
    ]})
    assert model.messages[2].tool_calls[0]["id"] == "paired"
    assert model.messages[3].tool_call_id == "paired"
