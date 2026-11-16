"""Public catalog API; native library access remains in infrastructure."""

from infrastructure.technical_analysis.talib.native_catalog import catalog, describe

__all__ = ["catalog", "describe"]
