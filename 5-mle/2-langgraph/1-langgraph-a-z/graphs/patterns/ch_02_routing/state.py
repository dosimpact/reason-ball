from __future__ import annotations

from typing import Annotated, Literal, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


RouteLabel = Literal[
    "order_status",
    "product_info",
    "technical_support",
    "clarify",
]


class RoutingState(TypedDict, total=False):
    input: str
    normalized_input: str
    messages: Annotated[list[AnyMessage], add_messages]
    route: RouteLabel | None
    route_reason: str | None
    route_confidence: float | None
    router_raw_output: str | None
    handler_output: str | None
    final_output: str | None
    errors: list[str]
    retry_count: int
    max_retries: int
    min_route_confidence: float
    requires_human_review: bool
