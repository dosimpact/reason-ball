"""Model-free Yahoo/TA-Lib chart reads for OpenUI Query."""

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response

from domains.technical_analysis.chart import build_chart_snapshot
from domains.technical_analysis.report import AgentIndicator, warmup_count
from graph.primary_graphs.technical_analysis_agent.tools import load_prices
from graph.subgraph.price_agent.tools.yahoo_finance import (
    PriceProviderError,
    fetch_historical_prices,
)
from infrastructure.technical_analysis.talib import TaLibAnalysisEngine

router = APIRouter(prefix="/technical-analysis", tags=["technical-analysis"])


@router.get("/chart")
def chart(
    response: Response,
    ticker: Annotated[
        str, Query(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9.^=_\-]+$")
    ],
    interval: Literal["1d", "1wk"] = "1d",
    count: Annotated[int, Query(ge=2, le=200)] = 120,
    indicators: Annotated[str, Query(max_length=12)] = "SMA,RSI,MACD",
    sma_period: Annotated[int, Query(ge=2, le=200)] = 20,
    rsi_period: Annotated[int, Query(ge=2, le=200)] = 14,
    macd_fast: Annotated[int, Query(ge=2, le=200)] = 12,
    macd_slow: Annotated[int, Query(ge=3, le=200)] = 26,
    macd_signal: Annotated[int, Query(ge=2, le=200)] = 9,
):
    names = indicators.upper().split(",")
    if (
        not names
        or len(set(names)) != len(names)
        or any(n not in {"SMA", "RSI", "MACD"} for n in names)
    ):
        raise HTTPException(422, "Choose distinct SMA, RSI, MACD indicators")
    if "MACD" in names and macd_fast >= macd_slow:
        raise HTTPException(422, "MACD fast period must be less than slow period")
    settings = [
        AgentIndicator(
            name=name,
            timeperiod=(sma_period if name == "SMA" else rsi_period)
            if name != "MACD"
            else None,
            fastperiod=macd_fast,
            slowperiod=macd_slow,
            signalperiod=macd_signal,
        )
        for name in names
    ]
    response.headers["Cache-Control"] = "no-store"
    try:
        prices, metadata = load_prices(
            ticker.upper(),
            interval,
            count,
            warmup_count(settings),
            fetch_historical_prices,
        )
        result = TaLibAnalysisEngine().analyze(
            prices, interval, [s.request() for s in settings]
        )
        return build_chart_snapshot(prices, metadata, settings, count, result)
    except PriceProviderError as exc:
        status = 404 if exc.code in {"symbol_not_found", "empty_data"} else 503
        raise HTTPException(
            status, {"code": exc.code, "message": exc.safe_message}
        ) from exc
