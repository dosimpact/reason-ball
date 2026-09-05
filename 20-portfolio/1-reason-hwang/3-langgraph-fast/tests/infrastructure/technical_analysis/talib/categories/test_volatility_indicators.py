import numpy as np
import talib

from infrastructure.technical_analysis.talib.categories.volatility_indicators import (
    calculate_atr,
)
from tests.technical_analysis_fixtures import make_arrays


def test_volatility_indicators_match_direct_talib_calls() -> None:
    arrays = make_arrays()

    atr = calculate_atr(arrays, {"timeperiod": 14})

    np.testing.assert_allclose(
        atr.outputs["atr"],
        talib.ATR(arrays.high, arrays.low, arrays.close, 14),
        equal_nan=True,
    )
