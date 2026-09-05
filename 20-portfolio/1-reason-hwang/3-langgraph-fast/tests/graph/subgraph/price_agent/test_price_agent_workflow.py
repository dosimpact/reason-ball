import importlib
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
import pytest
from langchain_core.messages import AIMessage, HumanMessage

from graph.subgraph.price_agent.state import PriceAgentState
from graph.subgraph.price_agent.tools import yahoo_finance
from graph.subgraph.price_agent.workflow import price_agent_graph

extract_node = importlib.import_module(
    "graph.subgraph.price_agent.node.extract_request"
)


class FakeModel:
    def __init__(self) -> None:
        self.calls = 0

    async def ainvoke(self, messages):
        self.calls += 1
        return AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "get_historical_prices",
                    "args": {"symbol": "CPNG", "interval": "1d", "count": 10},
                    "id": f"call-{self.calls}",
                    "type": "tool_call",
                }
            ],
        )


class FakeTicker:
    calls = 0

    def __init__(self, symbol: str) -> None:
        self.symbol = symbol

    def history(self, **kwargs):
        FakeTicker.calls += 1
        now = datetime.now(ZoneInfo("America/New_York"))
        dates = pd.date_range(end=now.date(), periods=10, freq="B", tz=now.tzinfo)
        return pd.DataFrame(
            {
                "Open": [10.0 + index for index in range(10)],
                "High": [11.0 + index for index in range(10)],
                "Low": [9.0 + index for index in range(10)],
                "Close": [10.0 + index for index in range(10)],
                "Adj Close": [100.0 + index for index in range(10)],
                "Volume": [1000] * 10,
            },
            index=dates,
        )

    def get_history_metadata(self):
        now = datetime.now(ZoneInfo("America/New_York"))
        return {
            "currency": "USD",
            "fullExchangeName": "NYSE",
            "exchangeTimezoneName": "America/New_York",
            "currentTradingPeriod": {
                "regular": {"start": now - timedelta(hours=1), "end": now + timedelta(hours=1)}
            },
        }


@pytest.mark.asyncio
async def test_price_agent_graph_calls_llm_once_and_reuses_cache(monkeypatch) -> None:
    model = FakeModel()
    FakeTicker.calls = 0
    monkeypatch.setattr(extract_node, "_request_model", model)
    monkeypatch.setattr(yahoo_finance.yf, "Ticker", FakeTicker)
    yahoo_finance.clear_price_cache()
    initial: PriceAgentState = {
        "query": "쿠팡의 최근 10일 가격을 알려줘",
        "messages": [HumanMessage(content="쿠팡의 최근 10일 가격을 알려줘")],
        "prices": [],
    }

    first = await price_agent_graph.ainvoke(initial)
    second = await price_agent_graph.ainvoke(initial)

    assert model.calls == 2
    assert FakeTicker.calls == 1
    assert first["cache_hit"] is False
    assert second["cache_hit"] is True
    assert len(first["prices"]) == 10
    assert "최신 종가" in first["response"]
    assert "+90.00%" in first["response"]
