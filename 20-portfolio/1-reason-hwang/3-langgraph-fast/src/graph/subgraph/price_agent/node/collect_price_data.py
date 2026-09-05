"""Collect typed Yahoo Finance tool artifacts into graph state."""

from __future__ import annotations

from langchain_core.messages import ToolMessage

from graph.subgraph.price_agent.state import PriceAgentState
from graph.subgraph.price_agent.tools import PriceToolArtifact


def collect_price_data(state: PriceAgentState) -> PriceAgentState:
    tool_message = next(
        (
            message
            for message in reversed(state.get("messages", []))
            if isinstance(message, ToolMessage)
        ),
        None,
    )
    if tool_message is None or not isinstance(tool_message.artifact, PriceToolArtifact):
        return {
            "prices": [],
            "error_code": "invalid_tool_artifact",
            "error_message": "The Yahoo Finance tool returned an invalid result.",
        }

    artifact = tool_message.artifact
    if artifact.error_code is not None:
        return {
            "symbol": artifact.symbol,
            "prices": [],
            "cache_hit": artifact.cache_hit,
            "cache_key": artifact.cache_key or "",
            "error_code": artifact.error_code,
            "error_message": artifact.error_message,
        }

    prices = sorted(artifact.prices, key=lambda price: price.trading_date)
    if not prices:
        return {
            "symbol": artifact.symbol,
            "prices": [],
            "error_code": "empty_data",
            "error_message": "No usable daily price data was returned.",
        }
    prices = prices[-30:]
    return {
        "symbol": artifact.symbol,
        "interval": "1d",
        "count": len(prices),
        "prices": prices,
        "currency": artifact.currency or prices[0].currency,
        "exchange": artifact.exchange,
        "fetched_at": artifact.fetched_at,
        "cache_hit": artifact.cache_hit,
        "cache_key": artifact.cache_key or "",
        "error_code": None,
        "error_message": None,
    }
