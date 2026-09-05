import numpy as np

from infrastructure.technical_analysis.talib._types import RawIndicatorResult
from infrastructure.technical_analysis.talib.normalization import normalize_outputs


def test_normalization_preserves_length_and_converts_nan_to_none() -> None:
    raw = RawIndicatorResult(
        parameters={"timeperiod": 2},
        outputs={"value": np.asarray([np.nan, 1.5, 2.5], dtype=np.float64)},
    )

    series, latest = normalize_outputs("TEST", raw, expected_length=3)

    assert series == {"value": (None, 1.5, 2.5)}
    assert latest == {"value": 2.5}
