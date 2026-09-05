from __future__ import annotations

import json
from typing import Annotated, Any

from langchain_core.messages import ToolMessage
from langchain_core.tools import BaseTool, InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from domains.technical_analysis.models import AnalysisResult, IndicatorRequest
from domains.technical_analysis.ports import TechnicalAnalysisEngine
from graph.shared.value_objects import PriceData


def _compact_result(result: AnalysisResult, recent_points: int) -> dict[str, Any]:
    indicators: list[dict[str, Any]] = []
    for outcome in result.indicators:
        compact = {
            "name": outcome.name.value,
            "category": outcome.category.value,
            "status": outcome.status,
            "parameters": outcome.parameters,
            "latest": outcome.latest,
            "error_code": outcome.error_code,
            "error_message": outcome.error_message,
        }
        if outcome.status == "success":
            compact["recent"] = {
                name: values[-recent_points:] for name, values in outcome.series.items()
            }
        indicators.append(compact)
    return {
        "symbol": result.symbol,
        "interval": result.interval,
        "points": result.points,
        "indicators": indicators,
        "warnings": result.warnings,
    }


def create_analyze_ohlcv_tool(
    engine: TechnicalAnalysisEngine,
    *,
    recent_points: int = 5,
) -> BaseTool:
    if recent_points < 1:
        raise ValueError("recent_points must be at least one")

    @tool("analyze_ohlcv_with_talib")
    def analyze_ohlcv_with_talib(
        indicators: list[IndicatorRequest],
        state: Annotated[dict[str, Any], InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
    ) -> Command:
        """Calculate one or more supported TA-Lib indicators for injected OHLCV state."""

        raw_prices = state.get("prices") or []
        prices = tuple(
            item if isinstance(item, PriceData) else PriceData.from_json_dict(item)
            for item in raw_prices
        )
        interval = str(state.get("interval") or "1d")
        result = engine.analyze(prices, interval, indicators)
        full_result = result.model_dump(mode="json")
        compact_result = _compact_result(result, recent_points)
        return Command(
            update={
                "analysis_result": full_result,
                "messages": [
                    ToolMessage(
                        content=json.dumps(compact_result, ensure_ascii=False),
                        tool_call_id=tool_call_id,
                        name="analyze_ohlcv_with_talib",
                    )
                ],
            }
        )

    return analyze_ohlcv_with_talib
