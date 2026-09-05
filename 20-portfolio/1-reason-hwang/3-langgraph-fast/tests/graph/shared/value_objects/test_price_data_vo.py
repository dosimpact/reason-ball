from dataclasses import FrozenInstanceError
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from graph.shared.value_objects import PriceData


def make_price(**overrides) -> PriceData:
    values = {
        "symbol": " cpng ",
        "trading_date": date(2026, 8, 28),
        "timezone": "America/New_York",
        "open": Decimal("16.10"),
        "high": Decimal("16.80"),
        "low": Decimal("16.00"),
        "close": Decimal("16.50"),
        "adjusted_close": Decimal("16.40"),
        "volume": 100,
        "currency": " usd ",
        "exchange": "NYSE",
        "fetched_at": datetime(2026, 8, 28, 14, 0, tzinfo=UTC),
        "is_partial": True,
    }
    values.update(overrides)
    return PriceData(**values)


def test_price_data_normalizes_and_is_immutable() -> None:
    price = make_price()

    assert price.symbol == "CPNG"
    assert price.currency == "USD"
    with pytest.raises(FrozenInstanceError):
        price.close = Decimal(17)  # type: ignore[misc]


def test_price_data_json_round_trip_preserves_value() -> None:
    price = make_price()

    restored = PriceData.from_json_dict(price.to_json_dict())

    assert restored == price
    assert isinstance(restored.close, Decimal)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"symbol": ""}, "symbol"),
        ({"currency": ""}, "currency"),
        ({"low": Decimal(17)}, "low"),
        ({"volume": -1}, "volume"),
        ({"timezone": "Not/AZone"}, "timezone"),
    ],
)
def test_price_data_rejects_invalid_values(overrides, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        make_price(**overrides)


def test_price_data_requires_timezone_aware_fetch_time() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        make_price(fetched_at=datetime(2026, 8, 28, 14, 0))  # noqa: DTZ001
