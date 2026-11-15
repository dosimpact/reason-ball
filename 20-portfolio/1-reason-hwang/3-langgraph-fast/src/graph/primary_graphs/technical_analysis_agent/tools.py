"""Two business tools; full arrays travel through graph state, not model arguments."""

from __future__ import annotations

from domains.technical_analysis.catalog import instance_id

import json
from typing import Annotated, Literal

from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command
from pydantic import Field

from domains.technical_analysis.chart_v2 import build_v2
from domains.technical_analysis.report import (
    AgentIndicator,
    default_indicators,
    indicator_signal,
    warmup_count,
)
from graph.shared.value_objects import PriceData
from graph.subgraph.price_agent.tools.yahoo_finance import (
    PriceProviderError,
    fetch_historical_prices,
)
from infrastructure.technical_analysis.talib import TaLibAnalysisEngine


def _reply(name, call_id, payload, **update):
    return Command(
        update={
            **update,
            "messages": [
                ToolMessage(
                    name=name,
                    tool_call_id=call_id,
                    status="error" if "error" in payload else "success",
                    content=json.dumps(payload, ensure_ascii=False, allow_nan=False),
                )
            ],
        }
    )


def load_prices(ticker, interval, count, warmup, fetcher):
    if warmup >= 5000 and fetcher is fetch_historical_prices:
        from graph.subgraph.price_agent.tools.yahoo_finance import fetch_origin_prices
        cached = fetch_origin_prices(ticker, interval, 5000, True)
    else:
        cached = fetcher(ticker, interval, min(5000, count + warmup + 1), True)
    prices = [p for p in cached.prices if not p.is_partial]
    if not prices:
        raise PriceProviderError("empty_data", "완료된 가격 봉이 없습니다.")
    last = prices[-1]
    metadata = {
        "source": "Yahoo Finance",
        "symbol": last.symbol,
        "currency": last.currency,
        "exchange": last.exchange,
        "timezone": last.timezone,
        "auto_adjust": True,
        "fetched_at": last.fetched_at.isoformat() if last.fetched_at else None,
        "cache_hit": cached.cache_hit,
        "interval": interval,
        "source_url": f"https://finance.yahoo.com/quote/{last.symbol}/history/",
    }
    return prices, metadata


def build_tools(*, fetcher=fetch_historical_prices, engine=None):
    engine = engine or TaLibAnalysisEngine()

    @tool
    def get_price_ohlcv(
        ticker: str,
        state: Annotated[dict, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
        interval: Literal["1d", "1wk"] = "1d",
        count: Annotated[int, Field(ge=2, le=200)] = 120,
    ) -> Command:
        """Fetch adjusted Yahoo OHLCV. Use 1d or 1wk, default 120 completed bars. Always call before analysis of a new ticker/interval/count."""
        request = {
            "ticker": ticker.strip().upper(),
            "interval": interval,
            "count": count,
        }
        settings = [
            AgentIndicator.model_validate(item) for item in state.get("indicators", [])
        ] or default_indicators()
        try:
            prices, metadata = load_prices(
                **request, warmup=warmup_count(settings), fetcher=fetcher
            )
        except (PriceProviderError, ValueError) as exc:
            code = (
                exc.code if isinstance(exc, PriceProviderError) else "invalid_request"
            )
            return _reply(
                "get_price_ohlcv",
                tool_call_id,
                {"error": code, "message": str(exc)},
                prices=[],
                price_request=request,
                analysis_result=None,
                analysis_error=str(exc),
            )
        return _reply(
            "get_price_ohlcv",
            tool_call_id,
            {**metadata, "available_bars": len(prices), "display_count": count},
            prices=[p.to_json_dict() for p in prices],
            price_request=request,
            price_metadata=metadata,
            analysis_result=None,
            analysis_error=None,
        )

    @tool
    def analyze_ohlcv_with_talib(
        state: Annotated[dict, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
        indicators: list[AgentIndicator] | None = None,
        all_indicators: bool = False,
    ) -> Command:
        """Calculate selected TA20 indicator instances from stored OHLCV. all_indicators=True selects all 20. Distinct instanceId allows multiple settings for one name. Omit indicators to retain prior settings or use RSI14/SMA20/MACD12,26,9. Supply the complete desired set to change settings."""
        if all_indicators:
            from domains.technical_analysis.catalog import NAMES
            indicators = [AgentIndicator(name=n) for n in NAMES]
        settings = (
            indicators
            if indicators is not None
            else [
                AgentIndicator.model_validate(item)
                for item in state.get("indicators", [])
            ]
            or default_indicators()
        )
        if (
            not settings
            or len(settings) > 40
            or len({s.instanceId or instance_id(s.name,s.request().parameters) for s in settings}) != len(settings)
        ):
            return _reply(
                "analyze_ohlcv_with_talib",
                tool_call_id,
                {"error": "Choose 1–40 unique indicator instances"},
                analysis_result=None,
                analysis_error="지표 설정을 확인하세요.",
            )
        prices = [PriceData.from_json_dict(item) for item in state.get("prices", [])]
        request = state.get("price_request")
        if not prices or not request:
            return _reply(
                "analyze_ohlcv_with_talib",
                tool_call_id,
                {"error": "Call get_price_ohlcv first"},
                analysis_result=None,
                analysis_error="먼저 가격을 조회하세요.",
            )
        metadata = state["price_metadata"]
        warmup = warmup_count(settings)
        target = 5000 if warmup >= 5000 else request["count"] + warmup
        if len(prices) < target:
            try:
                prices, metadata = load_prices(
                    **request, warmup=warmup, fetcher=fetcher
                )
            except (PriceProviderError, ValueError) as exc:
                return _reply(
                    "analyze_ohlcv_with_talib",
                    tool_call_id,
                    {"error": str(exc)},
                    analysis_result=None,
                    analysis_error=str(exc),
                )
        result = engine.analyze(
            prices, request["interval"], [s.request() for s in settings]
        )
        count = request["count"]
        closes = [float(p.close) for p in prices]
        outcomes = []
        for setting, outcome in zip(settings,result.indicators,strict=True):
            item = outcome.model_dump(mode="json")
            item["instanceId"] = setting.instanceId or instance_id(setting.name,outcome.parameters)
            item["signal"] = indicator_signal(
                outcome.name.value, item["series"], closes
            )
            item["series"] = {
                key: values[-count:] for key, values in item["series"].items()
            }
            outcomes.append(item)
        warnings = list(result.warnings)
        if len(prices) < count + warmup:
            warnings.append(
                "요청한 표시 범위와 준비 구간을 모두 확보하지 못했습니다. 초기 지표는 불안정하거나 판단 불가일 수 있습니다."
            )
        report = {
            **metadata,
            "dates": [p.trading_date.isoformat() for p in prices[-count:]],
            "close": closes[-count:],
            "indicators": outcomes,
            "warnings": warnings,
            "requested_count": count,
            "available_count": len(prices),
            "warmup": warmup,
            "chart_snapshot": build_v2(
                prices, metadata, settings, count, result
            ),
        }
        summary = {
            key: value
            for key, value in report.items()
            if key not in {"close", "dates", "indicators", "chart_snapshot"}
        }
        summary["as_of"] = report["dates"][-1]
        summary["indicators"] = [
            {key: value for key, value in item.items() if key != "series"}
            for item in outcomes
        ]
        return _reply(
            "analyze_ohlcv_with_talib",
            tool_call_id,
            summary,
            analysis_result=report,
            analysis_error=None,
            prices=[p.to_json_dict() for p in prices],
            price_metadata=metadata,
            indicators=[s.model_dump() for s in settings],
        )

    return [get_price_ohlcv, analyze_ohlcv_with_talib]


async def execute_analysis_request(state, tools, request):
    """Run the same two tools with trusted args, never a second LLM interpretation."""
    from uuid import uuid4
    from langchain_core.messages import AIMessage
    working=dict(state)
    if request.indicators:
        working['indicators']=[i.model_dump() for i in request.indicators]
    updates={'messages':[]}
    for tool,args in ((tools[0],{'ticker':request.ticker,'interval':request.interval,'count':request.count}),
                      (tools[1],{'indicators':[i.model_dump() for i in request.indicators] if request.indicators else None})):
        call_id=str(uuid4())
        command=await tool.ainvoke({'name':tool.name,'args':{**args,'state':working},'id':call_id,'type':'tool_call'})
        change=command.update
        updates['messages'].append(AIMessage(content='',tool_calls=[{'name':tool.name,'args':args,'id':call_id}]))
        updates['messages'].extend(change.get('messages',[]))
        updates.update({k:v for k,v in change.items() if k!='messages'})
        working.update(change)
        if change.get('analysis_error'):
            break
    updates['messages'].append(AIMessage(content=updates.get('analysis_error') or '분석 계산을 완료했습니다.'))
    return updates
