from datetime import date
from decimal import Decimal

from graph.shared.cache import InMemoryPriceCache
from graph.shared.value_objects import PriceData


class FakeClock:
    def __init__(self) -> None:
        self.value = 0.0

    def __call__(self) -> float:
        return self.value


def make_price(symbol: str) -> PriceData:
    return PriceData(
        symbol=symbol,
        trading_date=date(2026, 8, 28),
        timezone="UTC",
        open=Decimal(1),
        high=Decimal(2),
        low=Decimal(1),
        close=Decimal(2),
        adjusted_close=Decimal(2),
        volume=1,
        currency="USD",
    )


def test_cache_hit_and_ttl_expiry() -> None:
    clock = FakeClock()
    cache = InMemoryPriceCache(clock=clock)
    value = (make_price("CPNG"),)
    cache.set("key", value, ttl_seconds=60)

    clock.value = 59
    lookup = cache.get("key")
    assert lookup.hit is True
    assert lookup.value == value
    assert lookup.age_seconds == 59

    clock.value = 60
    assert cache.get("key").hit is False
    assert len(cache) == 0


def test_cache_evicts_least_recently_used_entry() -> None:
    clock = FakeClock()
    cache = InMemoryPriceCache(maxsize=2, clock=clock)
    cache.set("a", (make_price("A"),), 60)
    cache.set("b", (make_price("B"),), 60)
    assert cache.get("a").hit is True

    cache.set("c", (make_price("C"),), 60)

    assert cache.get("a").hit is True
    assert cache.get("b").hit is False
    assert cache.get("c").hit is True


def test_cache_does_not_store_empty_values_and_supports_clear() -> None:
    cache = InMemoryPriceCache()
    cache.set("empty", (), 60)
    assert cache.get("empty").hit is False

    cache.set("value", (make_price("CPNG"),), 60)
    cache.clear()
    assert len(cache) == 0
