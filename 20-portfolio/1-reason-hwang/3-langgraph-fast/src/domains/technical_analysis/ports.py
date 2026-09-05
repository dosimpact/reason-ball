from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol, runtime_checkable

from domains.technical_analysis.models import AnalysisResult, IndicatorRequest
from graph.shared.value_objects import PriceData


@runtime_checkable
class TechnicalAnalysisEngine(Protocol):
    def analyze(
        self,
        prices: Sequence[PriceData],
        interval: str,
        indicators: Sequence[IndicatorRequest],
    ) -> AnalysisResult: ...
