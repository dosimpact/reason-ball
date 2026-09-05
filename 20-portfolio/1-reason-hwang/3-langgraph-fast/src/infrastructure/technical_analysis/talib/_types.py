from __future__ import annotations

from dataclasses import dataclass
from typing import TypeAlias

import numpy as np
from numpy.typing import NDArray

from domains.technical_analysis.models import NumericParameter

FloatArray: TypeAlias = NDArray[np.float64]


@dataclass(frozen=True, slots=True)
class PriceArrays:
    open: FloatArray
    high: FloatArray
    low: FloatArray
    close: FloatArray
    volume: FloatArray

    @property
    def length(self) -> int:
        return len(self.close)


@dataclass(frozen=True, slots=True)
class RawIndicatorResult:
    parameters: dict[str, NumericParameter]
    outputs: dict[str, FloatArray]
