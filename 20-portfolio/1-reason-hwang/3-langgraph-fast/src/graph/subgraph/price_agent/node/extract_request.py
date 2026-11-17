"""Single-call LLM node that emits the Yahoo Finance tool call."""

from __future__ import annotations

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage

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
    if not messages:
        return {
            "error_code": "invalid_request",
            "error_message": "A price request is required.",
        }
    # Interrupted/restored turns may contain calls without their tool results.
    # Do not send those incomplete protocol pairs back to the model.
    paired = set()
    pending = {}
    for index, message in enumerate(messages):
        if isinstance(message, AIMessage):
            pending = {call["id"]: index for call in message.tool_calls}
        elif isinstance(message, ToolMessage):
            if message.tool_call_id in pending:
                paired.add((pending[message.tool_call_id], message.tool_call_id))
        else:
            pending = {}
    safe_messages = []
    retained_calls = set()
    for index, message in enumerate(messages):
        if isinstance(message, AIMessage):
            calls = [call for call in message.tool_calls if (index, call["id"]) in paired]
            retained_calls.update(call["id"] for call in calls)
            if calls or message.content:
                safe_messages.append(message.model_copy(update={"tool_calls": calls, "additional_kwargs": {k: v for k, v in message.additional_kwargs.items() if k != "tool_calls"}}))
        elif not isinstance(message, ToolMessage) or message.tool_call_id in retained_calls:
            safe_messages.append(message)
    result = await _request_model.ainvoke(
        [SystemMessage(content=TICKER_EXTRACTION_PROMPT), *safe_messages]
    )
    update: PriceAgentState = {"messages": [result], "error_code": None, "error_message": None}
    if not getattr(result, "tool_calls", None):
        update.update(
            error_code="tool_call_missing",
            error_message="The company or ticker could not be identified.",
        )
    return update
