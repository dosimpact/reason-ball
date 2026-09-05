"""Yahoo Finance adapter and LangChain tool for daily price data."""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

import yfinance as yf
from langchain_core.tools import tool

from graph.shared.cache import InMemoryPriceCache, cached_price_data
from graph.shared.value_objects import PriceData


@dataclass(frozen=True, slots=True)
class PriceToolArtifact:
    prices: tuple[PriceData, ...]
    symbol: str
    currency: str | None
    exchange: str | None
    fetched_at: datetime | None
    cache_hit: bool
    cache_key: str | None
    error_code: str | None = None
    error_message: str | None = None


class PriceProviderError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.safe_message = message


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, value)


def _env_float(name: str, default: float, minimum: float = 0.1) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, value)


PRICE_CACHE_TTL_SECONDS = _env_float("PRICE_CACHE_TTL_SECONDS", 60.0)
PRICE_CACHE_MAXSIZE = _env_int("PRICE_CACHE_MAXSIZE", 128)
_price_cache = InMemoryPriceCache(maxsize=PRICE_CACHE_MAXSIZE)


def clear_price_cache() -> None:
    """Clear the process-local cache, primarily for deterministic tests."""

    _price_cache.clear()


def _decimal_or_none(value: object) -> Decimal | None:
    if value is None:
        return None
    try:
        numeric = float(str(value))
    except (TypeError, ValueError):
        return None
    if not math.isfinite(numeric):
        return None
    return Decimal(str(value))


def _metadata_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value
    to_python = getattr(value, "to_pydatetime", None)
    if callable(to_python):
        result = to_python()
        return result if isinstance(result, datetime) else None
    return None


def _is_partial_bar(
    trading_date: date,
    metadata: dict[str, Any],
    *,
    now: datetime | None = None,
) -> bool:
    timezone_name = str(metadata.get("exchangeTimezoneName") or "UTC")
    exchange_now = now or datetime.now(ZoneInfo(timezone_name))
    if exchange_now.tzinfo is None:
        exchange_now = exchange_now.replace(tzinfo=ZoneInfo(timezone_name))
    exchange_now = exchange_now.astimezone(ZoneInfo(timezone_name))
    if trading_date != exchange_now.date():
        return False
    regular = metadata.get("currentTradingPeriod", {}).get("regular", {})
    regular_start = _metadata_datetime(regular.get("start"))
    regular_end = _metadata_datetime(regular.get("end"))
    if regular_start is None or regular_end is None:
        return True
    return regular_start <= exchange_now < regular_end


def _history_period(count: int) -> str:
    if count <= 20:
        return "1mo"
    if count <= 60:
        return "3mo"
    return "6mo"


def _provider_error(exc: Exception) -> PriceProviderError:
    name = type(exc).__name__.lower()
    message = str(exc).lower()
    if "ratelimit" in name or "rate limit" in message or "too many requests" in message:
        return PriceProviderError(
            "provider_rate_limited",
            "Yahoo Finance rate limit was reached. Please retry shortly.",
        )
    if "timeout" in name or "timed out" in message:
        return PriceProviderError(
            "provider_timeout",
            "Yahoo Finance did not respond in time. Please retry.",
        )
    return PriceProviderError(
        "provider_error",
        "Yahoo Finance price lookup failed. Please retry.",
    )


def _fetch_historical_prices_uncached(
    symbol: str,
    interval: str,
    count: int,
    auto_adjust: bool,
) -> tuple[PriceData, ...]:
    normalized_symbol = symbol.strip().upper()
    if normalized_symbol in {"", "UNKNOWN"}:
        raise PriceProviderError(
            "invalid_request",
            "A recognizable company name or ticker is required.",
        )
    if interval != "1d":
        raise PriceProviderError("invalid_request", "Only daily price bars are supported.")
    if not 1 <= count <= 30:
        raise PriceProviderError("invalid_request", "Price count must be between 1 and 30.")

    try:
        ticker = yf.Ticker(normalized_symbol)
        frame = ticker.history(
            period=_history_period(count),
            interval=interval,
            auto_adjust=auto_adjust,
            actions=False,
            repair=False,
            timeout=10,
        )
        metadata = dict(ticker.get_history_metadata() or {})
    except Exception as exc:
        raise _provider_error(exc) from exc

    if frame is None or frame.empty:
        raise PriceProviderError(
            "symbol_not_found",
            f"No Yahoo Finance daily prices were found for {normalized_symbol}.",
        )

    currency = str(metadata.get("currency") or "USD").upper()
    exchange = metadata.get("fullExchangeName") or metadata.get("exchangeName")
    exchange_name = str(exchange) if exchange else None
    index_timezone = getattr(frame.index, "tz", None)
    timezone_name = str(
        metadata.get("exchangeTimezoneName") or index_timezone or "UTC"
    )
    fetched_at = datetime.now(UTC)
    records: list[PriceData] = []
    rows = list(frame.sort_index().iterrows())
    for position, (index, row) in enumerate(rows):
        open_price = _decimal_or_none(row.get("Open"))
        high_price = _decimal_or_none(row.get("High"))
        low_price = _decimal_or_none(row.get("Low"))
        close_price = _decimal_or_none(row.get("Close"))
        if (
            open_price is None
            or high_price is None
            or low_price is None
            or close_price is None
        ):
            continue
        adjusted_close = _decimal_or_none(row.get("Adj Close"))
        volume_value = row.get("Volume", 0)
        try:
            numeric_volume = float(str(volume_value))
            volume = int(numeric_volume) if math.isfinite(numeric_volume) else 0
        except (TypeError, ValueError):
            volume = 0
        index_datetime = _metadata_datetime(index)
        if index_datetime is None:
            continue
        trading_date = index_datetime.date()
        is_last = position == len(rows) - 1
        try:
            record = PriceData(
                symbol=normalized_symbol,
                trading_date=trading_date,
                timezone=timezone_name,
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                adjusted_close=adjusted_close,
                volume=volume,
                currency=currency,
                exchange=exchange_name,
                fetched_at=fetched_at,
                is_partial=is_last and _is_partial_bar(trading_date, metadata),
            )
        except ValueError as exc:
            raise PriceProviderError(
                "invalid_provider_data",
                "Yahoo Finance returned invalid daily price data.",
            ) from exc
        records.append(record)

    if not records:
        raise PriceProviderError(
            "empty_data",
            f"Yahoo Finance returned no usable daily prices for {normalized_symbol}.",
        )
    return tuple(records[-count:])


fetch_historical_prices = cached_price_data(
    cache=_price_cache,
    ttl_seconds=PRICE_CACHE_TTL_SECONDS,
)(_fetch_historical_prices_uncached)


def _artifact_content(artifact: PriceToolArtifact) -> str:
    payload = {
        "symbol": artifact.symbol,
        "currency": artifact.currency,
        "exchange": artifact.exchange,
        "fetched_at": (
            None if artifact.fetched_at is None else artifact.fetched_at.isoformat()
        ),
        "cache_hit": artifact.cache_hit,
        "cache_key": artifact.cache_key,
        "error_code": artifact.error_code,
        "error_message": artifact.error_message,
        "prices": [price.to_json_dict() for price in artifact.prices],
    }
    return json.dumps(payload, ensure_ascii=False)


def _get_historical_prices(
    symbol: str,
    interval: str = "1d",
    count: int = 10,
) -> tuple[str, PriceToolArtifact]:
    """Get the latest Yahoo Finance daily price bars for a company ticker."""

    normalized_symbol = symbol.strip().upper()
    try:
        cached = fetch_historical_prices(normalized_symbol, interval, count, False)
    except PriceProviderError as exc:
        artifact = PriceToolArtifact(
            prices=(), symbol=normalized_symbol, currency=None, exchange=None,
            fetched_at=None, cache_hit=False, cache_key=None,
            error_code=exc.code, error_message=exc.safe_message,
        )
        return _artifact_content(artifact), artifact
    except (OSError, RuntimeError, TypeError, ValueError) as exc:
        error = _provider_error(exc)
        artifact = PriceToolArtifact(
            prices=(), symbol=normalized_symbol, currency=None, exchange=None,
            fetched_at=None, cache_hit=False, cache_key=None,
            error_code=error.code, error_message=error.safe_message,
        )
        return _artifact_content(artifact), artifact

    first = cached.prices[0]
    artifact = PriceToolArtifact(
        prices=cached.prices,
        symbol=first.symbol,
        currency=first.currency,
        exchange=first.exchange,
        fetched_at=first.fetched_at,
        cache_hit=cached.cache_hit,
        cache_key=cached.cache_key,
    )
    return _artifact_content(artifact), artifact


get_historical_prices = tool(
    "get_historical_prices",
    response_format="content_and_artifact",
)(_get_historical_prices)
