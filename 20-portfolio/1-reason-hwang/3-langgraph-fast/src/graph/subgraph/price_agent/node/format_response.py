"""Deterministic Markdown formatter for price-agent output."""

from __future__ import annotations

import re
from decimal import Decimal

from langchain_core.messages import AIMessage

from graph.shared.value_objects import PriceData
from graph.subgraph.price_agent.state import PriceAgentState

KOREAN_RE = re.compile(r"[가-힣]")
ERROR_MESSAGES_KO = {
    "invalid_request": "회사명이나 티커를 확인할 수 없습니다. 요청을 더 구체적으로 입력해 주세요.",
    "tool_call_missing": "회사명이나 티커를 추출하지 못했습니다. 티커를 함께 입력해 주세요.",
    "symbol_not_found": "해당 종목의 가격 데이터를 찾지 못했습니다. 회사명이나 티커를 확인해 주세요.",
    "empty_data": "조회 가능한 가격 데이터가 없습니다.",
    "provider_timeout": "Yahoo Finance 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.",
    "provider_rate_limited": "Yahoo Finance 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
    "provider_error": "Yahoo Finance 가격 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    "invalid_provider_data": "Yahoo Finance가 유효하지 않은 가격 데이터를 반환했습니다.",
    "invalid_tool_artifact": "가격 조회 결과를 처리하지 못했습니다.",
}
ERROR_MESSAGES_EN = {
    "invalid_request": "Please provide a recognizable company name or ticker.",
    "tool_call_missing": "The company or ticker could not be extracted.",
    "symbol_not_found": "No price data was found. Please verify the company or ticker.",
    "empty_data": "No usable price data is available.",
    "provider_timeout": "Yahoo Finance timed out. Please retry shortly.",
    "provider_rate_limited": "Yahoo Finance rate limit was reached. Please retry shortly.",
    "provider_error": "Yahoo Finance price lookup failed. Please retry.",
    "invalid_provider_data": "Yahoo Finance returned invalid price data.",
    "invalid_tool_artifact": "The price lookup result could not be processed.",
}


def _currency_value(value: Decimal, currency: str) -> str:
    symbols = {"USD": "$", "KRW": "₩", "JPY": "¥", "EUR": "€", "GBP": "£"}
    prefix = symbols.get(currency, f"{currency} ")
    return f"{prefix}{value:,.2f}"


def _change_percent(prices: list[PriceData]) -> Decimal | None:
    if len(prices) < 2 or prices[0].close == 0:
        return None
    return (prices[-1].close / prices[0].close - Decimal(1)) * Decimal(100)


def _error_response(state: PriceAgentState, korean: bool) -> str:
    code = state.get("error_code") or "provider_error"
    messages = ERROR_MESSAGES_KO if korean else ERROR_MESSAGES_EN
    return messages.get(code, messages["provider_error"])


def format_response(state: PriceAgentState) -> PriceAgentState:
    query = state.get("query", "")
    korean = bool(KOREAN_RE.search(query))
    prices = sorted(state.get("prices", []), key=lambda price: price.trading_date)
    if state.get("error_code") or not prices:
        response = _error_response(state, korean)
        return {"response": response, "messages": [AIMessage(content=response)]}

    symbol = state.get("symbol") or prices[-1].symbol
    currency = state.get("currency") or prices[-1].currency
    change = _change_percent(prices)
    latest = prices[-1]
    if korean:
        lines = [f"### {symbol} 최근 {len(prices)}개 일봉 ({currency})", ""]
        for price in prices:
            partial = " — 장중 미완성, 변동 가능" if price.is_partial else ""
            lines.append(
                f"- `{price.trading_date.isoformat()}`: "
                f"{_currency_value(price.close, currency)}{partial}"
            )
        lines.extend(
            [
                "",
                f"**최신 종가:** {_currency_value(latest.close, currency)}",
                "**기간 변동률:** "
                + ("계산 불가" if change is None else f"{change:+.2f}%"),
            ]
        )
        if latest.is_partial:
            lines.append("\n> 마지막 값은 장중 일봉으로 시장 상황에 따라 변경될 수 있습니다.")
    else:
        lines = [f"### {symbol} latest {len(prices)} daily bars ({currency})", ""]
        for price in prices:
            partial = " — intraday and subject to change" if price.is_partial else ""
            lines.append(
                f"- `{price.trading_date.isoformat()}`: "
                f"{_currency_value(price.close, currency)}{partial}"
            )
        lines.extend(
            [
                "",
                f"**Latest close:** {_currency_value(latest.close, currency)}",
                "**Period change:** "
                + ("N/A" if change is None else f"{change:+.2f}%"),
            ]
        )
        if latest.is_partial:
            lines.append("\n> The last value is intraday and may change during the session.")
    response = "\n".join(lines)
    return {"response": response, "messages": [AIMessage(content=response)]}
