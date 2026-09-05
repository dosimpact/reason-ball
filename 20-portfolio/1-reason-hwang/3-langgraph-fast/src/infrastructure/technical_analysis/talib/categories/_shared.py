from __future__ import annotations

from collections.abc import Mapping
from collections.abc import Set as AbstractSet

from domains.technical_analysis.errors import InvalidIndicatorParameters
from domains.technical_analysis.models import NumericParameter


def resolve_parameters(
    indicator: str,
    supplied: Mapping[str, NumericParameter],
    defaults: Mapping[str, NumericParameter],
    *,
    integer_keys: AbstractSet[str] = frozenset(),
    positive_keys: AbstractSet[str] = frozenset(),
    non_negative_keys: AbstractSet[str] = frozenset(),
) -> dict[str, NumericParameter]:
    unknown = sorted(set(supplied) - set(defaults))
    if unknown:
        raise InvalidIndicatorParameters(
            f"{indicator} does not accept parameter(s): {', '.join(unknown)}"
        )

    resolved = dict(defaults)
    resolved.update(supplied)

    for key in integer_keys:
        value = resolved[key]
        if isinstance(value, bool) or int(value) != value:
            raise InvalidIndicatorParameters(f"{indicator}.{key} must be an integer")
        resolved[key] = int(value)

    for key in positive_keys:
        if resolved[key] <= 0:
            raise InvalidIndicatorParameters(f"{indicator}.{key} must be greater than zero")

    for key in non_negative_keys:
        if resolved[key] < 0:
            raise InvalidIndicatorParameters(f"{indicator}.{key} must not be negative")

    return resolved
