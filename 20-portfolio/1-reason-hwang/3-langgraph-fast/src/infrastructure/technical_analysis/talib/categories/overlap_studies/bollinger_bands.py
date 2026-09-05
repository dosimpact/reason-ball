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


def calculate_bbands(
    prices: PriceArrays,
    parameters: Mapping[str, NumericParameter],
) -> RawIndicatorResult:
    resolved = resolve_parameters(
        "BBANDS",
        parameters,
        {"timeperiod": 20, "nbdevup": 2.0, "nbdevdn": 2.0, "matype": 0},
        integer_keys={"timeperiod", "matype"},
        positive_keys={"timeperiod", "nbdevup", "nbdevdn"},
        non_negative_keys={"matype"},
    )
    if int(resolved["matype"]) > 8:
        raise InvalidIndicatorParameters("BBANDS.matype must be between 0 and 8")
    upper, middle, lower = talib.BBANDS(
        prices.close,
        timeperiod=int(resolved["timeperiod"]),
        nbdevup=float(resolved["nbdevup"]),
        nbdevdn=float(resolved["nbdevdn"]),
        # TA-Lib accepts integer MA codes although its stub requires the MA_Type helper object.
        matype=int(resolved["matype"]),  # pyright: ignore[reportArgumentType]
    )
    return RawIndicatorResult(
        parameters=resolved,
        outputs={"upper": upper, "middle": middle, "lower": lower},
    )
