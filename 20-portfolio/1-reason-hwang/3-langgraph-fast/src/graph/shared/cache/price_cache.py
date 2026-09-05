"""Cache protocol for reusable immutable price data."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from graph.shared.value_objects import PriceData


@dataclass(frozen=True, slots=True)
class CacheLookup:
    hit: bool
    value: tuple[PriceData, ...] | None = None
    age_seconds: float | None = None


class PriceCache(Protocol):
    """Backend-neutral cache contract for price tuples."""

    def get(self, key: str) -> CacheLookup: ...

    def set(
        self,
        key: str,
        value: tuple[PriceData, ...],
        ttl_seconds: float,
    ) -> None: ...

    def invalidate(self, key: str) -> None: ...

    def clear(self) -> None: ...
