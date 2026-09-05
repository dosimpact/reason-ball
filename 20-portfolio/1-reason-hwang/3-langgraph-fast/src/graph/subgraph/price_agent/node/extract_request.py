"""Single-call LLM node that emits the Yahoo Finance tool call."""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from graph.provider import ChatGptOauthProxyProvider
from graph.subgraph.price_agent.prompts import TICKER_EXTRACTION_PROMPT
from graph.subgraph.price_agent.state import PriceAgentState
from graph.subgraph.price_agent.tools import get_historical_prices


def build_request_model():
    model = ChatGptOauthProxyProvider().chat_model()
    return model.bind_tools([get_historical_prices], tool_choice="required")


_request_model = build_request_model()


async def extract_request(state: PriceAgentState) -> PriceAgentState:
    messages = list(state.get("messages", []))
    query = state.get("query", "").strip()
    if not messages and query:
        messages = [HumanMessage(content=query)]
    if not messages:
        return {
            "error_code": "invalid_request",
            "error_message": "A price request is required.",
        }
    result = await _request_model.ainvoke(
        [SystemMessage(content=TICKER_EXTRACTION_PROMPT), *messages]
    )
    update: PriceAgentState = {"messages": [result]}
    if not getattr(result, "tool_calls", None):
        update.update(
            error_code="tool_call_missing",
            error_message="The company or ticker could not be identified.",
        )
    return update
