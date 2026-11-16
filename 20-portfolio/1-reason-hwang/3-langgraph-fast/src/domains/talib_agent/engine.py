"""Public execution API; native library access remains in infrastructure."""

from infrastructure.technical_analysis.talib.native_engine import (
    execute_batch,
    required_lookback,
)

__all__ = ["execute_batch", "required_lookback"]
