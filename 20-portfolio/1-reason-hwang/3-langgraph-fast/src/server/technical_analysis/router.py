"""Model-free Yahoo/TA-Lib chart reads for OpenUI Query."""

import json

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response

from domains.technical_analysis.catalog import instance_id
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
    schema_version: Annotated[int, Query(ge=1, le=2)] = 1,
    instances: Annotated[str | None, Query(max_length=20000)] = None,
    indicators: Annotated[str, Query(max_length=500)] = "SMA,RSI,MACD",
    sma_period: Annotated[int, Query(ge=2, le=200)] = 20,
    rsi_period: Annotated[int, Query(ge=2, le=200)] = 14,
    macd_fast: Annotated[int, Query(ge=2, le=200)] = 12,
    macd_slow: Annotated[int, Query(ge=3, le=200)] = 26,
    macd_signal: Annotated[int, Query(ge=2, le=200)] = 9,
):
    if schema_version == 2:
        from domains.technical_analysis.catalog import NAMES
        from domains.technical_analysis.chart_v2 import build_v2
        try:
            raw = json.loads(instances) if instances is not None else [{"name":n} for n in (NAMES if indicators.lower()=="all" else indicators.upper().split(","))]
            if not isinstance(raw,list) or not 0<=len(raw)<=40 or (not raw and instances is None):
                raise ValueError("Choose 0–40 instances; an empty explicit list requests prices only")
            settings=[AgentIndicator.model_validate(item) for item in raw]
            ids=[s.instanceId or instance_id(s.name,s.request().parameters) for s in settings]
            if len(set(ids))!=len(ids):
                raise ValueError("Duplicate instance IDs or identical implicit instances")
        except (ValueError,TypeError) as error:
            raise HTTPException(422,str(error)) from error
        response.headers["Cache-Control"]="no-store"
        try:
            prices,metadata=load_prices(ticker.upper(),interval,count,warmup_count(settings),fetch_historical_prices)
            result=TaLibAnalysisEngine().analyze(prices,interval,[s.request() for s in settings])
            return build_v2(prices,metadata,settings,count,result)
        except PriceProviderError as error:
            raise HTTPException(404 if error.code in {"symbol_not_found","empty_data"} else 503,{"code":error.code,"message":error.safe_message}) from error
    if instances is not None:
        raise HTTPException(422,"instances requires schema_version=2")
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


@router.get("/catalog")
def indicator_catalog():
    from domains.technical_analysis.catalog import catalog
    return catalog()
