from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass

from domains.technical_analysis.errors import UnsupportedIndicator
from domains.technical_analysis.models import (
    IndicatorCategory,
    IndicatorName,
    NumericParameter,
)
from infrastructure.technical_analysis.talib._types import (
    PriceArrays,
    RawIndicatorResult,
)
from infrastructure.technical_analysis.talib.categories.momentum_indicators import (
    calculate_adx,
    calculate_macd,
    calculate_rsi,
)
from infrastructure.technical_analysis.talib.categories.overlap_studies import (
    calculate_bbands,
    calculate_ema,
    calculate_sma,
)
from infrastructure.technical_analysis.talib.categories.volatility_indicators import (
    calculate_atr,
)
from infrastructure.technical_analysis.talib.categories.volume_indicators import (
    calculate_obv,
)

Calculator = Callable[[PriceArrays, Mapping[str, NumericParameter]], RawIndicatorResult]


@dataclass(frozen=True, slots=True)
class IndicatorRegistration:
    category: IndicatorCategory
    calculator: Calculator


INDICATOR_REGISTRY: dict[IndicatorName, IndicatorRegistration] = {
    IndicatorName.SMA: IndicatorRegistration(
        IndicatorCategory.OVERLAP_STUDIES, calculate_sma
    ),
    IndicatorName.EMA: IndicatorRegistration(
        IndicatorCategory.OVERLAP_STUDIES, calculate_ema
    ),
    IndicatorName.BBANDS: IndicatorRegistration(
        IndicatorCategory.OVERLAP_STUDIES, calculate_bbands
    ),
    IndicatorName.RSI: IndicatorRegistration(
        IndicatorCategory.MOMENTUM_INDICATORS, calculate_rsi
    ),
    IndicatorName.MACD: IndicatorRegistration(
        IndicatorCategory.MOMENTUM_INDICATORS, calculate_macd
    ),
    IndicatorName.ADX: IndicatorRegistration(
        IndicatorCategory.MOMENTUM_INDICATORS, calculate_adx
    ),
    IndicatorName.ATR: IndicatorRegistration(
        IndicatorCategory.VOLATILITY_INDICATORS, calculate_atr
    ),
    IndicatorName.OBV: IndicatorRegistration(
        IndicatorCategory.VOLUME_INDICATORS, calculate_obv
    ),
}


def get_indicator_registration(name: IndicatorName) -> IndicatorRegistration:
    try:
        return INDICATOR_REGISTRY[name]
    except KeyError as exc:
        raise UnsupportedIndicator(str(name)) from exc
