from __future__ import annotations


class TechnicalAnalysisError(Exception):
    """Base exception carrying a stable error code for graph/tool boundaries."""

    def __init__(self, message: str, *, code: str = "TECHNICAL_ANALYSIS_ERROR") -> None:
        super().__init__(message)
        self.code = code


class InvalidIndicatorParameters(TechnicalAnalysisError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="INVALID_INDICATOR_PARAMETERS")


class UnsupportedIndicator(TechnicalAnalysisError):
    def __init__(self, indicator: str) -> None:
        super().__init__(
            f"Unsupported technical indicator: {indicator}",
            code="UNSUPPORTED_INDICATOR",
        )


class IndicatorCalculationError(TechnicalAnalysisError):
    def __init__(self, indicator: str) -> None:
        super().__init__(
            f"TA-Lib could not calculate {indicator}",
            code="INDICATOR_CALCULATION_FAILED",
        )


class IndicatorDataInsufficient(TechnicalAnalysisError):
    def __init__(self, indicator: str) -> None:
        super().__init__(
            f"Not enough OHLCV observations to calculate {indicator}",
            code="INSUFFICIENT_DATA",
        )
