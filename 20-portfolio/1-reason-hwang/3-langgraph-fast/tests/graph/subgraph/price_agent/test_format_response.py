# pyright: reportTypedDictNotRequiredAccess=false

import pytest

pytestmark = pytest.mark.asyncio

from datetime import date
from decimal import Decimal
from langchain_core.messages import HumanMessage

from graph.shared.value_objects import PriceData
from graph.subgraph.price_agent.node.format_response import format_response


def make_price(day: int, close: str, adjusted: str, *, partial: bool = False) -> PriceData:
    price = Decimal(close)
    return PriceData(
        symbol="CPNG",
        trading_date=date(2026, 8, day),
        timezone="America/New_York",
        open=price,
        high=price + Decimal(1),
        low=price - Decimal(1),
        close=price,
        adjusted_close=Decimal(adjusted),
        volume=100,
        currency="USD",
        is_partial=partial,
    )


class FakeModel:
    def __init__(self):
        self.messages = []

    async def ainvoke(self, messages):
        from langchain_core.messages import AIMessage
        self.messages = messages
        return AIMessage(content="조회 결과 설명")


async def test_formatter_calls_model_with_latest_request_and_evidence(monkeypatch):
    import importlib
    import json
    node = importlib.import_module("graph.subgraph.price_agent.node.format_response")
    model = FakeModel()
    monkeypatch.setattr(node, "_response_model", model)
    result = await format_response({
        "messages": [HumanMessage(content="Earlier"), HumanMessage(content="쿠팡 가격")],
        "symbol": "CPNG", "currency": "USD",
        "prices": [make_price(28, "12", "101", partial=True)],
    })
    assert model.messages[1].content == "쿠팡 가격"
    evidence = json.loads(model.messages[2].content.split("\n", 1)[1])
    assert evidence["prices"][0]["close"] == "12"
    assert evidence["prices"][0]["is_partial"] is True
    assert result["response"] == "조회 결과 설명"
    assert result["messages"][0].content == result["response"]


async def test_formatter_passes_error_without_stale_prices(monkeypatch):
    import importlib
    import json
    node = importlib.import_module("graph.subgraph.price_agent.node.format_response")
    model = FakeModel()
    monkeypatch.setattr(node, "_response_model", model)
    await format_response({"error_code": "symbol_not_found", "prices": [make_price(28, "12", "101")]})
    evidence = json.loads(model.messages[2].content.split("\n", 1)[1])
    assert evidence["error_code"] == "symbol_not_found"
    assert evidence["prices"] == []
