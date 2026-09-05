from __future__ import annotations

from collections.abc import Mapping

import talib

from domains.technical_analysis.models import NumericParameter
from infrastructure.technical_analysis.talib._types import (
    PriceArrays,
    RawIndicatorResult,
)
from infrastructure.technical_analysis.talib.categories._shared import (
    resolve_parameters,
)


def calculate_obv(
    prices: PriceArrays,
    parameters: Mapping[str, NumericParameter],
) -> RawIndicatorResult:
    resolved = resolve_parameters("OBV", parameters, {})
    output = talib.OBV(prices.close, prices.volume)
    return RawIndicatorResult(parameters=resolved, outputs={"obv": output})
