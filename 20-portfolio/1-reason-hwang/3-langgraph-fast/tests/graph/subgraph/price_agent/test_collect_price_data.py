# pyright: reportTypedDictNotRequiredAccess=false

from datetime import UTC, date, datetime
from decimal import Decimal

from langchain_core.messages import ToolMessage

from graph.shared.value_objects import PriceData
from graph.subgraph.price_agent.node.collect_price_data import collect_price_data
from graph.subgraph.price_agent.tools import PriceToolArtifact


def make_price(day: int) -> PriceData:
    return PriceData(
        symbol="CPNG",
        trading_date=date(2026, 8, day),
        timezone="America/New_York",
        open=Decimal(10),
        high=Decimal(12),
        low=Decimal(9),
        close=Decimal(str(day)),
        adjusted_close=Decimal(100),
        volume=100,
        currency="USD",
        exchange="NYSE",
        fetched_at=datetime(2026, 8, 28, tzinfo=UTC),
    )


def test_collect_price_data_sorts_typed_artifact() -> None:
    artifact = PriceToolArtifact(
        prices=(make_price(12), make_price(10), make_price(11)),
        symbol="CPNG",
        currency="USD",
        exchange="NYSE",
        fetched_at=datetime(2026, 8, 28, tzinfo=UTC),
        cache_hit=True,
        cache_key="key",
    )
    message = ToolMessage(content="{}", tool_call_id="call-1", artifact=artifact)

    result = collect_price_data({"messages": [message]})

    assert [price.trading_date.day for price in result["prices"]] == [10, 11, 12]
    assert result["cache_hit"] is True
    assert result["error_code"] is None


def test_collect_price_data_propagates_tool_error() -> None:
    artifact = PriceToolArtifact(
        prices=(), symbol="BAD", currency=None, exchange=None, fetched_at=None,
        cache_hit=False, cache_key=None, error_code="symbol_not_found",
        error_message="not found",
    )
    message = ToolMessage(content="{}", tool_call_id="call-1", artifact=artifact)

    result = collect_price_data({"messages": [message]})

    assert result["error_code"] == "symbol_not_found"
    assert result["prices"] == []
