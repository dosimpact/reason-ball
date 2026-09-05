"""Reusable TTL cache decorator for immutable price fetches."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from functools import wraps
from threading import Event, Lock
from typing import ParamSpec

from graph.shared.cache.price_cache import PriceCache
from graph.shared.value_objects import PriceData

P = ParamSpec("P")


@dataclass(frozen=True, slots=True)
class CachedPriceData:
    prices: tuple[PriceData, ...]
    cache_hit: bool
    cache_key: str
    cache_age_seconds: float | None = None
    shared_inflight: bool = False


@dataclass(slots=True)
class _Flight:
    event: Event = field(default_factory=Event)
    result: tuple[PriceData, ...] | None = None
    error: BaseException | None = None


def build_price_cache_key(
    symbol: str,
    interval: str,
    count: int,
    *,
    auto_adjust: bool,
    provider: str = "yahoo-finance",
) -> str:
    normalized_symbol = symbol.strip().upper()
    normalized_interval = interval.strip().lower()
    if not normalized_symbol:
        raise ValueError("symbol must not be empty")
    if not normalized_interval:
        raise ValueError("interval must not be empty")
    if count < 1:
        raise ValueError("count must be at least 1")
    return (
        f"{provider}:{normalized_symbol}:{normalized_interval}:{count}:"
        f"{str(auto_adjust).lower()}"
    )


def cached_price_data(
    *,
    cache: PriceCache,
    ttl_seconds: float,
    provider: str = "yahoo-finance",
) -> Callable[
    [Callable[[str, str, int, bool], tuple[PriceData, ...]]],
    Callable[[str, str, int, bool], CachedPriceData],
]:
    """Cache successful immutable results and coalesce concurrent misses."""

    flights: dict[str, _Flight] = {}
    flights_lock = Lock()

    def decorator(
        func: Callable[[str, str, int, bool], tuple[PriceData, ...]],
    ) -> Callable[[str, str, int, bool], CachedPriceData]:
        @wraps(func)
        def wrapper(
            symbol: str,
            interval: str = "1d",
            count: int = 10,
            auto_adjust: bool = False,
        ) -> CachedPriceData:
            key = build_price_cache_key(
                symbol,
                interval,
                count,
                auto_adjust=auto_adjust,
                provider=provider,
            )
            lookup = cache.get(key)
            if lookup.hit and lookup.value is not None:
                return CachedPriceData(
                    prices=lookup.value,
                    cache_hit=True,
                    cache_key=key,
                    cache_age_seconds=lookup.age_seconds,
                )

            with flights_lock:
                flight = flights.get(key)
                if flight is None:
                    flight = _Flight()
                    flights[key] = flight
                    leader = True
                else:
                    leader = False

            if not leader:
                flight.event.wait()
                if flight.error is not None:
                    raise flight.error
                if flight.result is None:
                    raise RuntimeError("single-flight completed without a result")
                return CachedPriceData(
                    prices=flight.result,
                    cache_hit=False,
                    cache_key=key,
                    shared_inflight=True,
                )

            try:
                prices = tuple(func(symbol.strip().upper(), interval, count, auto_adjust))
                flight.result = prices
                if prices:
                    cache.set(key, prices, ttl_seconds)
                return CachedPriceData(
                    prices=prices,
                    cache_hit=False,
                    cache_key=key,
                )
            except BaseException as exc:
                flight.error = exc
                raise
            finally:
                flight.event.set()
                with flights_lock:
                    flights.pop(key, None)

        return wrapper

    return decorator
