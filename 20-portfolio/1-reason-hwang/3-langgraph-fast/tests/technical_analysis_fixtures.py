from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import numpy as np

from graph.shared.value_objects import PriceData
from infrastructure.technical_analysis.talib._types import PriceArrays


def make_prices(points: int = 80) -> tuple[PriceData, ...]:
    start = date(2026, 1, 1)
    close = tuple(
        100.0 + index * 0.35 + ((index % 7) - 3) * 0.45 for index in range(points)
    )
    open_ = tuple(value - 0.15 for value in close)
    return tuple(
        PriceData(
            symbol="TEST",
            trading_date=start + timedelta(days=index),
            timezone="UTC",
            open=Decimal(str(open_[index])),
            high=Decimal(str(max(open_[index], close[index]) + 1.0)),
            low=Decimal(str(min(open_[index], close[index]) - 1.0)),
            close=Decimal(str(close[index])),
            adjusted_close=None,
            volume=1_000 + index * 11,
            currency="USD",
            exchange="TEST",
        )
        for index in range(points)
    )


def make_arrays(points: int = 80) -> PriceArrays:
    prices = make_prices(points)
    return PriceArrays(
        open=np.asarray([float(price.open) for price in prices], dtype=np.float64),
        high=np.asarray([float(price.high) for price in prices], dtype=np.float64),
        low=np.asarray([float(price.low) for price in prices], dtype=np.float64),
        close=np.asarray([float(price.close) for price in prices], dtype=np.float64),
        volume=np.asarray([float(price.volume) for price in prices], dtype=np.float64),
    )
