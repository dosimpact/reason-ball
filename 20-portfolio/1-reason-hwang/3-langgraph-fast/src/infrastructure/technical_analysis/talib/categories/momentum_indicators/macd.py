from __future__ import annotations

from collections.abc import Mapping

import talib

from domains.technical_analysis.errors import InvalidIndicatorParameters
from domains.technical_analysis.models import NumericParameter
from infrastructure.technical_analysis.talib._types import (
    PriceArrays,
    RawIndicatorResult,
)
from infrastructure.technical_analysis.talib.categories._shared import (
    resolve_parameters,
)


def calculate_macd(
    prices: PriceArrays,
    parameters: Mapping[str, NumericParameter],
) -> RawIndicatorResult:
    resolved = resolve_parameters(
        "MACD",
        parameters,
        {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9},
        integer_keys={"fastperiod", "slowperiod", "signalperiod"},
        positive_keys={"fastperiod", "slowperiod", "signalperiod"},
    )
    if resolved["fastperiod"] >= resolved["slowperiod"]:
        raise InvalidIndicatorParameters("MACD.fastperiod must be less than slowperiod")
    macd, signal, histogram = talib.MACD(
        prices.close,
        fastperiod=int(resolved["fastperiod"]),
        slowperiod=int(resolved["slowperiod"]),
        signalperiod=int(resolved["signalperiod"]),
    )
    return RawIndicatorResult(
        parameters=resolved,
        outputs={"macd": macd, "signal": signal, "histogram": histogram},
    )
