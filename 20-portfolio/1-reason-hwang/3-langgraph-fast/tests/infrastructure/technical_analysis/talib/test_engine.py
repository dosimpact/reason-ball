from __future__ import annotations

from domains.technical_analysis import IndicatorName, IndicatorRequest
from infrastructure.technical_analysis.talib import TaLibAnalysisEngine
from infrastructure.technical_analysis.talib.registry import (
    INDICATOR_REGISTRY,
    IndicatorRegistration,
)
from tests.technical_analysis_fixtures import make_prices


def test_engine_merges_all_supported_indicator_categories() -> None:
    requests = [IndicatorRequest(name=name) for name in IndicatorName]

    result = TaLibAnalysisEngine().analyze(make_prices(), "1d", requests)

    assert [outcome.name for outcome in result.indicators] == list(IndicatorName)
    assert all(outcome.status == "success" for outcome in result.indicators)
    assert {outcome.category.value for outcome in result.indicators} == {
        "overlap_studies",
        "momentum_indicators",
        "volatility_indicators",
        "volume_indicators",
    }
    assert all(
        len(values) == result.points
        for outcome in result.indicators
        for values in outcome.series.values()
    )


def test_engine_returns_insufficient_data_without_inventing_values() -> None:
    result = TaLibAnalysisEngine().analyze(
        make_prices(10),
        "1d",
        [IndicatorRequest(name=IndicatorName.RSI, parameters={"timeperiod": 14})],
    )

    outcome = result.indicators[0]
    assert outcome.status == "error"
    assert outcome.error_code == "INSUFFICIENT_DATA"
    assert outcome.series == {}
    assert outcome.latest == {}


def test_engine_rejects_unknown_parameters_per_indicator() -> None:
    result = TaLibAnalysisEngine().analyze(
        make_prices(),
        "1d",
        [IndicatorRequest(name=IndicatorName.SMA, parameters={"unknown": 1})],
    )

    outcome = result.indicators[0]
    assert outcome.status == "error"
    assert outcome.error_code == "INVALID_INDICATOR_PARAMETERS"
    assert "unknown" in (outcome.error_message or "")


def test_engine_sanitizes_unexpected_adapter_exceptions(monkeypatch) -> None:
    registration = INDICATOR_REGISTRY[IndicatorName.SMA]

    def fail(*args, **kwargs):
        raise RuntimeError("sensitive internal details")

    monkeypatch.setitem(
        INDICATOR_REGISTRY,
        IndicatorName.SMA,
        IndicatorRegistration(registration.category, fail),
    )

    result = TaLibAnalysisEngine().analyze(
        make_prices(),
        "1d",
        [IndicatorRequest(name=IndicatorName.SMA)],
    )

    outcome = result.indicators[0]
    assert outcome.error_code == "INDICATOR_CALCULATION_FAILED"
    assert "sensitive" not in (outcome.error_message or "")
