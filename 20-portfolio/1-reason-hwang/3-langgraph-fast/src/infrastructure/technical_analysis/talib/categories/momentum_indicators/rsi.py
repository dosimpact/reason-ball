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


def calculate_rsi(
    prices: PriceArrays,
    parameters: Mapping[str, NumericParameter],
) -> RawIndicatorResult:
    resolved = resolve_parameters(
        "RSI",
        parameters,
        {"timeperiod": 14},
        integer_keys={"timeperiod"},
        positive_keys={"timeperiod"},
    )
    output = talib.RSI(prices.close, timeperiod=int(resolved["timeperiod"]))
    return RawIndicatorResult(parameters=resolved, outputs={"rsi": output})
