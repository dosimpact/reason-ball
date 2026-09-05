"""State contract for the price-agent graph."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

from graph.shared.value_objects import PriceData


class PriceAgentState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    query: str
    symbol: str
    interval: str
    count: int
    prices: list[PriceData]
    currency: str
    exchange: str | None
    fetched_at: datetime | None
    cache_hit: bool
    cache_key: str
    error_code: str | None
    error_message: str | None
    response: str
