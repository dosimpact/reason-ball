from __future__ import annotations

import math

from domains.technical_analysis.errors import IndicatorCalculationError
from infrastructure.technical_analysis.talib._types import RawIndicatorResult


def normalize_outputs(
    indicator: str,
    raw: RawIndicatorResult,
    *,
    expected_length: int,
) -> tuple[dict[str, tuple[float | None, ...]], dict[str, float | None]]:
    series: dict[str, tuple[float | None, ...]] = {}
    latest: dict[str, float | None] = {}

    for output_name, values in raw.outputs.items():
        if len(values) != expected_length:
            raise IndicatorCalculationError(indicator)
        normalized = tuple(
            float(value) if math.isfinite(float(value)) else None for value in values
        )
        series[output_name] = normalized
        latest[output_name] = next(
            (value for value in reversed(normalized) if value is not None),
            None,
        )

    return series, latest
