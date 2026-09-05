import numpy as np
import talib

from infrastructure.technical_analysis.talib.categories.volume_indicators import (
    calculate_obv,
)
from tests.technical_analysis_fixtures import make_arrays


def test_volume_indicators_match_direct_talib_calls() -> None:
    arrays = make_arrays()

    obv = calculate_obv(arrays, {})

    np.testing.assert_allclose(
        obv.outputs["obv"],
        talib.OBV(arrays.close, arrays.volume),
        equal_nan=True,
    )
