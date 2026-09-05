import numpy as np
import talib

from infrastructure.technical_analysis.talib.categories.overlap_studies import (
    calculate_bbands,
    calculate_ema,
    calculate_sma,
)
from tests.technical_analysis_fixtures import make_arrays


def test_overlap_studies_match_direct_talib_calls() -> None:
    arrays = make_arrays()

    sma = calculate_sma(arrays, {"timeperiod": 20})
    ema = calculate_ema(arrays, {"timeperiod": 20})
    bands = calculate_bbands(arrays, {"timeperiod": 20})

    np.testing.assert_allclose(sma.outputs["sma"], talib.SMA(arrays.close, 20), equal_nan=True)
    np.testing.assert_allclose(ema.outputs["ema"], talib.EMA(arrays.close, 20), equal_nan=True)
    expected_bands = talib.BBANDS(arrays.close, 20, 2.0, 2.0, talib.MA_Type.SMA)
    for name, expected in zip(("upper", "middle", "lower"), expected_bands, strict=True):
        np.testing.assert_allclose(bands.outputs[name], expected, equal_nan=True)
