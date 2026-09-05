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


def calculate_ema(
    prices: PriceArrays,
    parameters: Mapping[str, NumericParameter],
) -> RawIndicatorResult:
    resolved = resolve_parameters(
        "EMA",
        parameters,
        {"timeperiod": 20},
        integer_keys={"timeperiod"},
        positive_keys={"timeperiod"},
    )
    output = talib.EMA(prices.close, timeperiod=int(resolved["timeperiod"]))
    return RawIndicatorResult(parameters=resolved, outputs={"ema": output})
