"""Example 21: intent validation that emits typed UI payloads for missing fields."""

from __future__ import annotations

import re
from operator import add
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


FieldName = Literal["ticker", "market", "period"]
FinalStatus = Literal["needs_feedback", "completed"]


class Option(TypedDict):
    label: str
    value: str
    description: str


class UIRequest(TypedDict):
    id: str
    type: str
    field: FieldName
    title: str
    description: str
    required: bool
    options: list[Option]


class IntentRecord(TypedDict, total=False):
    user_query: str
    ticker: str
    market: str
    period: str
    confidence: float
    source: str


class QuoteSnapshot(TypedDict, total=False):
    ticker: str
    company: str
    market: str
    period: str
    currency: str
    price: float
    change: float
    change_percent: float
    as_of: str
    source: str


class IntentEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    field: str


class IntentFeedbackState(TypedDict, total=False):
    user_query: str
    ticker: str
    market: str
    period: str
    selection: dict[str, str]
    intent: IntentRecord
    missing_fields: list[FieldName]
    ui_requests: list[UIRequest]
    quote_snapshot: QuoteSnapshot
    answer: str
    final: str
    final_status: FinalStatus
    intent_events: Annotated[list[IntentEvent], add]


TICKER_OPTIONS: list[Option] = [
    {"label": "AAPL", "value": "AAPL", "description": "Apple Inc. mock NASDAQ quote."},
    {"label": "NVDA", "value": "NVDA", "description": "NVIDIA Corp. mock NASDAQ quote."},
    {"label": "MSFT", "value": "MSFT", "description": "Microsoft Corp. mock NASDAQ quote."},
    {"label": "TSLA", "value": "TSLA", "description": "Tesla Inc. mock NASDAQ quote."},
]

MARKET_OPTIONS: list[Option] = [
    {"label": "NASDAQ", "value": "NASDAQ", "description": "US technology-heavy exchange."},
    {"label": "NYSE", "value": "NYSE", "description": "US listed equity exchange."},
    {"label": "KRX", "value": "KRX", "description": "Korea Exchange example market."},
]

PERIOD_OPTIONS: list[Option] = [
    {"label": "1D", "value": "1D", "description": "Intraday / latest trading day."},
    {"label": "1W", "value": "1W", "description": "One-week movement."},
    {"label": "1M", "value": "1M", "description": "One-month movement."},
    {"label": "6M", "value": "6M", "description": "Six-month movement."},
]

QUOTE_FIXTURES: dict[str, dict[str, Any]] = {
    "AAPL": {"company": "Apple Inc.", "currency": "USD", "price": 213.47, "change": 1.18, "change_percent": 0.56},
    "NVDA": {"company": "NVIDIA Corp.", "currency": "USD", "price": 142.83, "change": 3.94, "change_percent": 2.84},
    "MSFT": {"company": "Microsoft Corp.", "currency": "USD", "price": 498.12, "change": -0.77, "change_percent": -0.15},
    "TSLA": {"company": "Tesla Inc.", "currency": "USD", "price": 184.09, "change": 4.21, "change_percent": 2.34},
}

TICKER_SYNONYMS = {
    "AAPL": "AAPL",
    "NVDA": "NVDA",
    "MSFT": "MSFT",
    "TSLA": "TSLA",
}


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, field: str = "") -> IntentEvent:
    return {
        "type": "intent_feedback",
        "phase": phase,
        "status": status,
        "detail": detail,
        "field": field,
    }


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(content)


def _selected(state: IntentFeedbackState, field: FieldName) -> str:
    selection = state.get("selection") or {}
    value = state.get(field) or selection.get(field, "")
    return str(value).upper().strip()


def _parse_ticker(text: str) -> str:
    upper = text.upper()
    for word, ticker in TICKER_SYNONYMS.items():
        if re.search(rf"\b{re.escape(word)}\b", upper):
            return ticker
    return ""


def _parse_market(text: str) -> str:
    upper = text.upper()
    for market in ("NASDAQ", "NYSE", "KRX"):
        if re.search(rf"\b{market}\b", upper):
            return market
    if re.search(r"\b(US|USA|AMERICAN)\b", upper):
        return "NASDAQ"
    if re.search(r"\b(KOREA|KOREAN|SEOUL)\b", upper):
        return "KRX"
    return ""


def _parse_period(text: str) -> str:
    upper = text.upper()
    patterns = [
        (r"\b(1D|TODAY|LATEST|DAILY|DAY)\b", "1D"),
        (r"\b(1W|WEEK|WEEKLY)\b", "1W"),
        (r"\b(1M|MONTH|MONTHLY)\b", "1M"),
        (r"\b(6M|SIX MONTH|HALF YEAR)\b", "6M"),
    ]
    for pattern, value in patterns:
        if re.search(pattern, upper):
            return value
    return ""


def _ui_request(field: FieldName, options: list[Option]) -> UIRequest:
    titles = {
        "ticker": "Choose a ticker",
        "market": "Choose a market",
        "period": "Choose a period",
    }
    descriptions = {
        "ticker": "The request needs a supported ticker before the quote can run.",
        "market": "The same ticker can be listed or interpreted in different markets.",
        "period": "Choose the period for the mock quote movement.",
    }
    request_type = {
        "ticker": "ticker_list",
        "market": "market_selector",
        "period": "period_selector",
    }
    return {
        "id": f"{field}-selector",
        "type": request_type[field],
        "field": field,
        "title": titles[field],
        "description": descriptions[field],
        "required": True,
        "options": options,
    }


def parse_intent(state: IntentFeedbackState) -> dict:
    query = state.get("user_query", "Show me the stock price.")
    ticker = _selected(state, "ticker") or _parse_ticker(query)
    market = _selected(state, "market") or _parse_market(query)
    period = _selected(state, "period") or _parse_period(query)
    if ticker and not market:
        market = "NASDAQ"
    if ticker and not period:
        period = ""

    missing: list[FieldName] = []
    if not ticker:
        missing.append("ticker")
    if not market:
        missing.append("market")
    if not period:
        missing.append("period")

    intent: IntentRecord = {
        "user_query": query,
        "ticker": ticker,
        "market": market,
        "period": period,
        "confidence": 0.96 if not missing else 0.58,
        "source": "user_selection" if state.get("selection") else "deterministic_parser",
    }
    event = _event(
        "parse_intent",
        "needs_feedback" if missing else "completed",
        f"Parsed intent with {len(missing)} missing fields.",
        ",".join(missing),
    )
    _writer()(event)
    return {
        "user_query": query,
        "intent": intent,
        "ticker": ticker,
        "market": market,
        "period": period,
        "missing_fields": missing,
        "intent_events": [event],
    }


def route_after_parse(state: IntentFeedbackState) -> str:
    return "request_feedback" if state.get("missing_fields") else "lookup_quote"


def request_feedback(state: IntentFeedbackState) -> dict:
    requests: list[UIRequest] = []
    for field in state.get("missing_fields", []):
        if field == "ticker":
            requests.append(_ui_request("ticker", TICKER_OPTIONS))
        elif field == "market":
            requests.append(_ui_request("market", MARKET_OPTIONS))
        elif field == "period":
            requests.append(_ui_request("period", PERIOD_OPTIONS))
    event = _event("ui_request", "needs_feedback", f"Emitted {len(requests)} generated UI payloads.")
    _writer()(event)
    return {
        "ui_requests": requests,
        "final_status": "needs_feedback",
        "final": "More structured input is required. Use the generated controls to complete the stock intent.",
        "intent_events": [event],
    }


def lookup_quote(state: IntentFeedbackState) -> dict:
    ticker = state.get("ticker", "AAPL")
    fixture = QUOTE_FIXTURES.get(ticker, QUOTE_FIXTURES["AAPL"])
    snapshot: QuoteSnapshot = {
        "ticker": ticker,
        "company": str(fixture["company"]),
        "market": state.get("market", "NASDAQ"),
        "period": state.get("period", "1D"),
        "currency": str(fixture["currency"]),
        "price": float(fixture["price"]),
        "change": float(fixture["change"]),
        "change_percent": float(fixture["change_percent"]),
        "as_of": "mock close 2026-06-16",
        "source": "mock_quote_fixture",
    }
    event = _event("lookup_quote", "completed", f"Loaded mock quote for {ticker}.", "quote_snapshot")
    _writer()(event)
    return {
        "quote_snapshot": snapshot,
        "ui_requests": [],
        "missing_fields": [],
        "intent_events": [event],
    }


def compose_answer(state: IntentFeedbackState) -> dict:
    snapshot = state.get("quote_snapshot", {})
    response = create_llm("fast").invoke(
        [
            SystemMessage(
                content=(
                    "You are a financial UI assistant for a mock-data demo. State that the quote "
                    "is simulated, summarize the selected ticker, market, period, price, and change. "
                    "Do not give investment advice."
                )
            ),
            HumanMessage(content=f"USER REQUEST:\n{state.get('user_query', '')}\n\nQUOTE:\n{snapshot}"),
        ]
    )
    answer = _extract_text(response.content).strip()
    event = _event("compose_answer", "completed", "OpenAI generated the final mock quote response.")
    _writer()(event)
    return {
        "answer": answer,
        "final": answer,
        "final_status": "completed",
        "intent_events": [event],
    }


def build_graph():
    builder = StateGraph(IntentFeedbackState)
    builder.add_node("parse_intent", parse_intent)
    builder.add_node("request_feedback", request_feedback)
    builder.add_node("lookup_quote", lookup_quote)
    builder.add_node("compose_answer", compose_answer)
    builder.add_edge(START, "parse_intent")
    builder.add_conditional_edges(
        "parse_intent",
        route_after_parse,
        {"request_feedback": "request_feedback", "lookup_quote": "lookup_quote"},
    )
    builder.add_edge("request_feedback", END)
    builder.add_edge("lookup_quote", "compose_answer")
    builder.add_edge("compose_answer", END)
    return builder.compile()


graph = build_graph()
