"""Thread-safe process-local TTL/LRU price cache."""

from __future__ import annotations

import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from threading import RLock

from graph.shared.cache.price_cache import CacheLookup
from graph.shared.value_objects import PriceData


@dataclass(frozen=True, slots=True)
class _CacheEntry:
    value: tuple[PriceData, ...]
    created_at: float
    expires_at: float


class InMemoryPriceCache:
    """Bounded process-local cache with monotonic TTL expiration."""

    def __init__(
        self,
        maxsize: int = 128,
        *,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if maxsize < 1:
            raise ValueError("maxsize must be at least 1")
        self.maxsize = maxsize
        self._clock = clock
        self._entries: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._lock = RLock()

    def get(self, key: str) -> CacheLookup:
        now = self._clock()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return CacheLookup(hit=False)
            if entry.expires_at <= now:
                self._entries.pop(key, None)
                return CacheLookup(hit=False)
            self._entries.move_to_end(key)
            return CacheLookup(
                hit=True,
                value=entry.value,
                age_seconds=max(0.0, now - entry.created_at),
            )

    def set(
        self,
        key: str,
        value: tuple[PriceData, ...],
        ttl_seconds: float,
    ) -> None:
        if not key:
            raise ValueError("cache key must not be empty")
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        if not value:
            return
        now = self._clock()
        with self._lock:
            self._entries[key] = _CacheEntry(
                value=tuple(value),
                created_at=now,
                expires_at=now + ttl_seconds,
            )
            self._entries.move_to_end(key)
            while len(self._entries) > self.maxsize:
                self._entries.popitem(last=False)

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._entries.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)
