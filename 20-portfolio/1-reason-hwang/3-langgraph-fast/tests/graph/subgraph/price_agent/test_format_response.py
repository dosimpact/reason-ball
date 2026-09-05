# pyright: reportTypedDictNotRequiredAccess=false

from datetime import date
from decimal import Decimal

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


def test_formatter_uses_close_not_adjusted_close() -> None:
    result = format_response(
        {
            "query": "쿠팡 최근 가격",
            "symbol": "CPNG",
            "currency": "USD",
            "prices": [make_price(27, "10", "100"), make_price(28, "12", "101", partial=True)],
        }
    )

    assert "$10.00" in result["response"]
    assert "$12.00" in result["response"]
    assert "+20.00%" in result["response"]
    assert "$100.00" not in result["response"]
    assert "장중 미완성" in result["response"]
    assert "```" not in result["response"]


def test_formatter_returns_safe_error_markdown() -> None:
    result = format_response(
        {"query": "없는 종목", "prices": [], "error_code": "symbol_not_found"}
    )

    assert "찾지 못했습니다" in result["response"]
    assert len(result["messages"]) == 1
