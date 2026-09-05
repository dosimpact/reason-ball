from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from domains.technical_analysis.errors import (
    IndicatorCalculationError,
    IndicatorDataInsufficient,
    TechnicalAnalysisError,
)
from domains.technical_analysis.models import (
    AnalysisResult,
    IndicatorOutcome,
    IndicatorRequest,
)
from graph.shared.value_objects import PriceData
from infrastructure.technical_analysis.talib._types import PriceArrays
from infrastructure.technical_analysis.talib.normalization import normalize_outputs
from infrastructure.technical_analysis.talib.registry import get_indicator_registration


class TaLibAnalysisEngine:
    """TA-Lib adapter implementing the provider-neutral analysis engine port."""

    def analyze(
        self,
        prices: Sequence[PriceData],
        interval: str,
        indicators: Sequence[IndicatorRequest],
    ) -> AnalysisResult:
        if not prices:
            raise ValueError("at least one PriceData item is required")
        arrays = PriceArrays(
            open=np.asarray([float(price.open) for price in prices], dtype=np.float64),
            high=np.asarray([float(price.high) for price in prices], dtype=np.float64),
            low=np.asarray([float(price.low) for price in prices], dtype=np.float64),
            close=np.asarray([float(price.close) for price in prices], dtype=np.float64),
            volume=np.asarray([float(price.volume) for price in prices], dtype=np.float64),
        )
        outcomes = tuple(self._calculate(arrays, request) for request in indicators)
        errors = sum(outcome.status == "error" for outcome in outcomes)
        warning_items: list[str] = []
        if errors:
            warning_items.append(f"{errors} indicator calculation(s) could not be completed")
        if prices[-1].is_partial:
            warning_items.append("the latest price bar is partial")
        return AnalysisResult(
            symbol=prices[0].symbol,
            interval=interval,
            points=len(prices),
            indicators=outcomes,
            warnings=tuple(warning_items),
        )

    @staticmethod
    def _calculate(arrays: PriceArrays, request: IndicatorRequest) -> IndicatorOutcome:
        registration = get_indicator_registration(request.name)
        parameters = dict(request.parameters)
        try:
            raw = registration.calculator(arrays, parameters)
            series, latest = normalize_outputs(
                request.name.value,
                raw,
                expected_length=arrays.length,
            )
            if not latest or all(value is None for value in latest.values()):
                raise IndicatorDataInsufficient(request.name.value)
            return IndicatorOutcome(
                name=request.name,
                category=registration.category,
                status="success",
                parameters=raw.parameters,
                series=series,
                latest=latest,
            )
        except TechnicalAnalysisError as exc:
            return IndicatorOutcome(
                name=request.name,
                category=registration.category,
                status="error",
                parameters=parameters,
                error_code=exc.code,
                error_message=str(exc),
            )
        # This adapter is the exception firewall: no native/library detail may cross it.
        except Exception:  # noqa: BLE001
            safe_error = IndicatorCalculationError(request.name.value)
            return IndicatorOutcome(
                name=request.name,
                category=registration.category,
                status="error",
                parameters=parameters,
                error_code=safe_error.code,
                error_message=str(safe_error),
            )
