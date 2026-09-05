from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Event
from time import sleep

import pytest

from graph.shared.cache import (
    InMemoryPriceCache,
    build_price_cache_key,
    cached_price_data,
)
from graph.shared.value_objects import PriceData


def make_price(symbol: str) -> PriceData:
    return PriceData(
        symbol=symbol,
        trading_date=date(2026, 8, 28),
        timezone="UTC",
        open=Decimal(1),
        high=Decimal(2),
        low=Decimal(1),
        close=Decimal(2),
        adjusted_close=None,
        volume=1,
        currency="USD",
    )


def test_decorator_caches_success_and_normalizes_key() -> None:
    calls = 0
    cache = InMemoryPriceCache()

    @cached_price_data(cache=cache, ttl_seconds=60)
    def fetch(symbol: str, interval: str, count: int, auto_adjust: bool):
        nonlocal calls
        calls += 1
        return (make_price(symbol),)

    first = fetch(" cpng ", "1d", 10, False)
    second = fetch("CPNG", "1d", 10, False)

    assert first.cache_hit is False
    assert second.cache_hit is True
    assert calls == 1
    assert second.cache_key == "yahoo-finance:CPNG:1d:10:false"


def test_decorator_does_not_cache_errors_or_empty_results() -> None:
    calls = 0
    cache = InMemoryPriceCache()

    @cached_price_data(cache=cache, ttl_seconds=60)
    def fetch(symbol: str, interval: str, count: int, auto_adjust: bool):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("temporary")
        return ()

    with pytest.raises(RuntimeError, match="temporary"):
        fetch("CPNG", "1d", 10, False)
    assert fetch("CPNG", "1d", 10, False).prices == ()
    assert fetch("CPNG", "1d", 10, False).prices == ()
    assert calls == 3


def test_distinct_request_parameters_create_distinct_keys() -> None:
    assert build_price_cache_key("CPNG", "1d", 10, auto_adjust=False) != (
        build_price_cache_key("AAPL", "1d", 10, auto_adjust=False)
    )
    assert build_price_cache_key("CPNG", "1d", 10, auto_adjust=False) != (
        build_price_cache_key("CPNG", "1d", 5, auto_adjust=False)
    )
    assert build_price_cache_key("CPNG", "1d", 10, auto_adjust=False) != (
        build_price_cache_key("CPNG", "1wk", 10, auto_adjust=False)
    )
    assert build_price_cache_key("CPNG", "1d", 10, auto_adjust=False) != (
        build_price_cache_key("CPNG", "1d", 10, auto_adjust=True)
    )


def test_single_flight_coalesces_concurrent_misses() -> None:
    calls = 0
    started = Event()
    release = Event()
    cache = InMemoryPriceCache()

    @cached_price_data(cache=cache, ttl_seconds=60)
    def fetch(symbol: str, interval: str, count: int, auto_adjust: bool):
        nonlocal calls
        calls += 1
        started.set()
        assert release.wait(timeout=2)
        return (make_price(symbol),)

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(fetch, "CPNG", "1d", 10, False) for _ in range(4)]
        assert started.wait(timeout=1)
        sleep(0.05)
        release.set()
        results = [future.result(timeout=2) for future in futures]

    assert calls == 1
    assert all(result.prices[0].symbol == "CPNG" for result in results)
    assert any(result.shared_inflight for result in results)
