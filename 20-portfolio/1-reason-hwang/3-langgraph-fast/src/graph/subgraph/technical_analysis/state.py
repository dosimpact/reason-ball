from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

from graph.shared.value_objects import PriceData


class TechnicalAnalysisState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    prices: list[PriceData | dict[str, Any]]
    interval: str
    analysis_result: dict[str, Any] | None
    validation_errors: list[str]
