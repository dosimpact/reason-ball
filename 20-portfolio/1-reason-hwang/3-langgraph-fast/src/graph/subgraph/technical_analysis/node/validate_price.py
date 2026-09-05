from __future__ import annotations

from itertools import pairwise

from graph.shared.value_objects import PriceData
from graph.subgraph.technical_analysis.state import TechnicalAnalysisState


def validate_price(state: TechnicalAnalysisState) -> dict[str, object]:
    raw_prices = state.get("prices")
    if not isinstance(raw_prices, (list, tuple)) or not raw_prices:
        return {"validation_errors": ["prices: at least one PriceData item is required"]}

    prices: list[PriceData] = []
    for index, item in enumerate(raw_prices):
        try:
            if isinstance(item, PriceData):
                price = item
            elif isinstance(item, dict):
                price = PriceData.from_json_dict(item)
            else:
                raise TypeError("must be a PriceData object or serialized object")
        except (KeyError, TypeError, ValueError) as exc:
            return {"validation_errors": [f"prices.{index}: {exc}"]}
        prices.append(price)

    consistency_fields = ("symbol", "timezone", "currency", "exchange")
    first = prices[0]
    for field_name in consistency_fields:
        expected = getattr(first, field_name)
        if any(getattr(price, field_name) != expected for price in prices[1:]):
            return {
                "validation_errors": [
                    f"prices: all items must have the same {field_name}"
                ]
            }

    if any(
        current.trading_date <= previous.trading_date
        for previous, current in pairwise(prices)
    ):
        return {
            "validation_errors": [
                "prices: trading_date values must be strictly increasing and unique"
            ]
        }

    interval = str(state.get("interval") or "1d").strip()
    if not interval:
        return {"validation_errors": ["interval: must not be empty"]}

    return {
        "prices": [price.to_json_dict() for price in prices],
        "interval": interval,
        "validation_errors": [],
        "analysis_result": None,
    }
