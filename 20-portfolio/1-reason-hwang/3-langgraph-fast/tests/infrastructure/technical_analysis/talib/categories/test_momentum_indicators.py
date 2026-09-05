import numpy as np
import talib

from infrastructure.technical_analysis.talib.categories.momentum_indicators import (
    calculate_adx,
    calculate_macd,
    calculate_rsi,
)
from tests.technical_analysis_fixtures import make_arrays


def test_momentum_indicators_match_direct_talib_calls() -> None:
    arrays = make_arrays()

    rsi = calculate_rsi(arrays, {"timeperiod": 14})
    macd = calculate_macd(arrays, {"fastperiod": 12, "slowperiod": 26, "signalperiod": 9})
    adx = calculate_adx(arrays, {"timeperiod": 14})

    np.testing.assert_allclose(rsi.outputs["rsi"], talib.RSI(arrays.close, 14), equal_nan=True)
    expected_macd = talib.MACD(arrays.close, 12, 26, 9)
    for name, expected in zip(("macd", "signal", "histogram"), expected_macd, strict=True):
        np.testing.assert_allclose(macd.outputs[name], expected, equal_nan=True)
    np.testing.assert_allclose(
        adx.outputs["adx"],
        talib.ADX(arrays.high, arrays.low, arrays.close, 14),
        equal_nan=True,
    )
