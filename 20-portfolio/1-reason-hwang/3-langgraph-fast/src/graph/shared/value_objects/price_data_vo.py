"""Shared immutable price data value object."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import TypeAlias
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

JSONScalar: TypeAlias = str | int | bool | None


def _decimal(value: object, field_name: str) -> Decimal:
    try:
        result = value if isinstance(value, Decimal) else Decimal(str(value))
    except (ValueError, TypeError) as exc:
        raise ValueError(f"{field_name} must be a decimal value") from exc
    if not result.is_finite():
        raise ValueError(f"{field_name} must be finite")
    return result


@dataclass(frozen=True, slots=True)
class PriceData:
    """Shared immutable price data value object for one daily market bar."""

    symbol: str
    trading_date: date
    timezone: str
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    adjusted_close: Decimal | None
    volume: int
    currency: str
    exchange: str | None = None
    fetched_at: datetime | None = None
    is_partial: bool = False

    def __post_init__(self) -> None:
        symbol = self.symbol.strip().upper()
        currency = self.currency.strip().upper()
        timezone = self.timezone.strip()
        exchange = self.exchange.strip() if self.exchange else None
        if not symbol:
            raise ValueError("symbol must not be empty")
        if not currency:
            raise ValueError("currency must not be empty")
        if not timezone:
            raise ValueError("timezone must not be empty")
        try:
            ZoneInfo(timezone)
        except ZoneInfoNotFoundError as exc:
            raise ValueError(f"unknown timezone: {timezone}") from exc
        if isinstance(self.trading_date, datetime) or not isinstance(self.trading_date, date):
            raise TypeError("trading_date must be a date")

        open_price = _decimal(self.open, "open")
        high_price = _decimal(self.high, "high")
        low_price = _decimal(self.low, "low")
        close_price = _decimal(self.close, "close")
        adjusted_close = (
            None
            if self.adjusted_close is None
            else _decimal(self.adjusted_close, "adjusted_close")
        )
        if min(open_price, high_price, low_price, close_price) < 0:
            raise ValueError("OHLC prices must not be negative")
        if low_price > high_price:
            raise ValueError("low must not exceed high")
        if adjusted_close is not None and adjusted_close < 0:
            raise ValueError("adjusted_close must not be negative")
        volume = int(self.volume)
        if volume < 0:
            raise ValueError("volume must not be negative")
        if self.fetched_at is not None and self.fetched_at.tzinfo is None:
            raise ValueError("fetched_at must be timezone-aware")

        object.__setattr__(self, "symbol", symbol)
        object.__setattr__(self, "currency", currency)
        object.__setattr__(self, "timezone", timezone)
        object.__setattr__(self, "exchange", exchange)
        object.__setattr__(self, "open", open_price)
        object.__setattr__(self, "high", high_price)
        object.__setattr__(self, "low", low_price)
        object.__setattr__(self, "close", close_price)
        object.__setattr__(self, "adjusted_close", adjusted_close)
        object.__setattr__(self, "volume", volume)

    def to_json_dict(self) -> dict[str, JSONScalar]:
        """Serialize without losing Decimal or date semantics."""

        return {
            "symbol": self.symbol,
            "trading_date": self.trading_date.isoformat(),
            "timezone": self.timezone,
            "open": str(self.open),
            "high": str(self.high),
            "low": str(self.low),
            "close": str(self.close),
            "adjusted_close": (
                None if self.adjusted_close is None else str(self.adjusted_close)
            ),
            "volume": self.volume,
            "currency": self.currency,
            "exchange": self.exchange,
            "fetched_at": (
                None if self.fetched_at is None else self.fetched_at.isoformat()
            ),
            "is_partial": self.is_partial,
        }

    @classmethod
    def from_json_dict(cls, payload: Mapping[str, object]) -> PriceData:
        """Restore a value serialized by :meth:`to_json_dict`."""

        fetched_at_value = payload.get("fetched_at")
        adjusted_close_value = payload.get("adjusted_close")
        return cls(
            symbol=str(payload["symbol"]),
            trading_date=date.fromisoformat(str(payload["trading_date"])),
            timezone=str(payload["timezone"]),
            open=_decimal(payload["open"], "open"),
            high=_decimal(payload["high"], "high"),
            low=_decimal(payload["low"], "low"),
            close=_decimal(payload["close"], "close"),
            adjusted_close=(
                None
                if adjusted_close_value is None
                else _decimal(adjusted_close_value, "adjusted_close")
            ),
            volume=int(str(payload["volume"])),
            currency=str(payload["currency"]),
            exchange=(
                None if payload.get("exchange") is None else str(payload["exchange"])
            ),
            fetched_at=(
                None
                if fetched_at_value is None
                else datetime.fromisoformat(str(fetched_at_value))
            ),
            is_partial=bool(payload.get("is_partial", False)),
        )
