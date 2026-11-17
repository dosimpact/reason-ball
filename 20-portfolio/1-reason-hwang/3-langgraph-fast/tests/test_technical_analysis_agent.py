import json
from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np
import pytest
import talib
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from domains.technical_analysis.presentation import presentation_input
from domains.technical_analysis.report import AgentIndicator, crossing, indicator_signal
from graph.primary_graphs.technical_analysis_agent.state import TechnicalAgentState
from graph.primary_graphs.technical_analysis_agent.tools import build_tools
from graph.primary_graphs.technical_analysis_agent.workflow import (
    build_technical_analysis_agent,
)
from graph.shared.cache import CachedPriceData
from graph.subgraph.price_agent.tools.yahoo_finance import (
    PriceProviderError,
    _is_partial_bar,
    _is_partial_week,
)
from tests.technical_analysis_fixtures import make_prices


def fixture_fetcher(symbol, interval, count, adjusted):
    assert adjusted is True
    return CachedPriceData(
        prices=make_prices(count),
        cache_hit=False,
        cache_key=f"{symbol}:{interval}:{count}",
    )


def call(tool, args, state):
    return tool.invoke(
        {
            "name": tool.name,
            "args": {**args, "state": state},
            "id": "test-call",
            "type": "tool_call",
        }
    ).update


def report_state():
    fetch, analyze = build_tools(fetcher=fixture_fetcher)
    state = call(fetch, {"ticker": "TEST"}, {})
    state.update(call(analyze, {}, state))
    return state


def test_full_series_and_signals_match_talib():
    state = report_state()
    report = state["analysis_result"]
    closes = np.array([float(p["close"]) for p in state["prices"]])
    expected = {
        "RSI": talib.RSI(closes, 14),
        "SMA": talib.SMA(closes, 20),
        "MACD": talib.MACD(closes)[0],
    }
    assert len(report["dates"]) == 120
    for indicator in report["indicators"]:
        key = indicator["name"].lower()
        np.testing.assert_allclose(
            indicator["series"][key], expected[indicator["name"]][-120:]
        )
        assert indicator["signal"]["state"] != "판단 불가"
    presentation = presentation_input(state)
    assert report["chart_snapshot"]["schemaVersion"] == 2
    assert presentation["presentation_context"]["chartQuery"]["ticker"] == "TEST"
    assert presentation["presentation_context"]["chartFallback"]["bars"] == []
    assert "series" not in presentation["answer"]["indicators"][0]



@pytest.mark.parametrize(
    "value,label", [(70, "과매수"), (30, "과매도"), (50, "중립"), (None, "판단 불가")]
)
def test_rsi_boundaries(value, label):
    assert indicator_signal("RSI", {"rsi": [value]}, [1])["state"] == label


@pytest.mark.parametrize(
    "previous,current,label",
    [
        (0, 1, "상향 교차"),
        (0, -1, "하향 교차"),
        (1, 0, "교차 없음"),
        (None, 1, "판단 불가"),
    ],
)
def test_crossing(previous, current, label):
    assert crossing(previous, current) == label


def test_reject_unsupported_and_invalid_parameters():
    with pytest.raises(ValidationError):
        AgentIndicator(name="UNSUPPORTED")
    with pytest.raises(ValidationError):
        AgentIndicator(name="MACD", fastperiod=30, slowperiod=20)


def test_week_finalizes_next_monday():
    zone = ZoneInfo("America/New_York")
    monday = datetime(2026, 11, 2, tzinfo=zone).date()
    metadata = {"exchangeTimezoneName": str(zone)}
    assert _is_partial_week(
        monday, metadata, now=datetime(2026, 11, 6, 18, tzinfo=zone)
    )
    assert not _is_partial_week(
        monday, metadata, now=datetime(2026, 11, 9, 0, tzinfo=zone)
    )
    day = datetime(2026, 11, 6, tzinfo=zone)
    metadata["currentTradingPeriod"] = {
        "regular": {"start": day.replace(hour=9), "end": day.replace(hour=16)}
    }
    assert _is_partial_bar(day.date(), metadata, now=day.replace(hour=8))
    assert not _is_partial_bar(day.date(), metadata, now=day.replace(hour=17))


def test_failure_clears_previous_report_and_prices():
    def fail(*args):
        raise PriceProviderError("provider_timeout", "timeout")

    fetch, _ = build_tools(fetcher=fail)
    result = call(fetch, {"ticker": "FAIL"}, report_state())
    assert result["prices"] == []
    assert result["analysis_result"] is None
    assert result["messages"][0].status == "error"


def test_tool_status_reflects_success_and_missing_price_error():
    fetch, analyze = build_tools(fetcher=fixture_fetcher)
    state = call(fetch, {"ticker": "TEST"}, {})
    assert state["messages"][0].status == "success"
    result = call(analyze, {}, state)
    assert result["messages"][0].status == "success"
    missing = call(analyze, {}, {})
    assert missing["messages"][0].status == "error"


def test_settings_change_fetches_more_history_and_retains_weekly():
    calls = []

    def fetcher(*args):
        calls.append(args)
        return fixture_fetcher(*args)

    fetch, analyze = build_tools(fetcher=fetcher)
    state = call(fetch, {"ticker": "TEST", "interval": "1wk"}, {})
    state.update(
        call(analyze, {"indicators": [{"name": "SMA", "timeperiod": 200}]}, state)
    )
    assert calls[-1][1:3] == ("1wk", 1121)
    assert state["analysis_result"]["indicators"][0]["parameters"] == {
        "timeperiod": 200
    }


@pytest.mark.asyncio
async def test_graph_presents_then_clears_stale_result():
    async def business(state):
        if state["messages"][-1].content == "hello":
            return {"messages": [AIMessage(content="hello")]}
        return {**report_state(), "messages": [AIMessage(content="analysis")]}

    graph = StateGraph(TechnicalAgentState)
    graph.add_node("business", business)
    graph.add_edge(START, "business")
    graph.add_edge("business", END)

    async def validator(program):
        assert "FinancialChart(" in program
        return []

    app = build_technical_analysis_agent(model=PresentationModel(), agent=graph.compile(), validator=validator)
    state = await app.ainvoke({"messages": [HumanMessage(content="analyze")]})
    assert state["presentation"]["id"]
    state["messages"].append(HumanMessage(content="hello"))
    result = await app.ainvoke(state)
    assert result["presentation"] is None
    assert result["analysis_result"] is None


def test_maximum_display_fits_openui_validator_limit():
    fetch, analyze = build_tools(fetcher=fixture_fetcher)
    state = call(fetch, {"ticker": "TEST", "count": 200}, {})
    state.update(call(analyze, {}, state))
    program = json.dumps(presentation_input(state), ensure_ascii=False, allow_nan=False)
    assert len(state["analysis_result"]["dates"]) == 200
    assert len(program) <= 60000


def test_missing_history_stays_null_and_warns():
    def short_history(*args):
        return CachedPriceData(
            prices=make_prices(5), cache_hit=False, cache_key="short"
        )

    fetch, analyze = build_tools(fetcher=short_history)
    state = call(fetch, {"ticker": "TEST"}, {})
    state.update(call(analyze, {}, state))
    report = state["analysis_result"]
    assert report["warnings"]
    assert len(report["dates"]) == 5
    assert all(item["signal"]["state"] == "판단 불가" for item in report["indicators"])
    assert "NaN" not in json.dumps(presentation_input(state), allow_nan=False)


@pytest.mark.asyncio
async def test_invalid_openui_has_text_fallback():
    async def business(state):
        return {**report_state(), "messages": [AIMessage(content="analysis")]}

    graph = StateGraph(TechnicalAgentState)
    graph.add_node("business", business)
    graph.add_edge(START, "business")
    graph.add_edge("business", END)

    async def reject(program):
        return ["invalid"]

    app = build_technical_analysis_agent(model=PresentationModel(), agent=graph.compile(), validator=reject)
    state = await app.ainvoke({"messages": [HumanMessage(content="analyze")]})
    assert state["presentation"] is None
    assert "시각화 생성에 실패" in state["messages"][-1].content
    assert state["analysis_result"]["dates"][-1] in state["messages"][-1].content


class PresentationModel:
    def __init__(self, error=None):
        self.messages = []
        self.error = error

    def with_structured_output(self, schema):
        return self

    async def ainvoke(self, messages):
        self.messages.append(list(messages))
        if self.error:
            raise self.error
        return {"program": 'root = Col([FinancialChart(chart)], 3)\nchart = Query("technical_analysis_chart", {}, {"bars":[],"indicators":[]})'}


@pytest.mark.asyncio
async def test_model_receives_actual_question_explanation_and_compact_data():
    async def business(state):
        return {**report_state(), "messages": [AIMessage(content="RSI 근거 설명")]}
    graph = StateGraph(TechnicalAgentState)
    graph.add_node("business", business)
    graph.add_edge(START, "business")
    graph.add_edge("business", END)
    async def validator(program):
        return []
    model = PresentationModel()
    app = build_technical_analysis_agent(model=model, agent=graph.compile(), validator=validator)
    result = await app.ainvoke({"messages": [HumanMessage(content="TEST RSI 차트 설명해줘")]})
    assert result["presentation"]
    payload = json.loads(model.messages[0][1].content)
    assert payload["question"] == "TEST RSI 차트 설명해줘"
    assert payload["answer"]["explanation"] == "RSI 근거 설명"
    assert payload["presentationContext"]["chartFallback"]["bars"] == []
    assert "series" not in payload["answer"]["indicators"][0]


@pytest.mark.asyncio
async def test_provider_failure_preserves_analysis_and_falls_back():
    async def business(state):
        return report_state()
    graph = StateGraph(TechnicalAgentState)
    graph.add_node("business", business)
    graph.add_edge(START, "business")
    graph.add_edge("business", END)
    app = build_technical_analysis_agent(model=PresentationModel(RuntimeError("offline")), agent=graph.compile())
    result = await app.ainvoke({"messages": [HumanMessage(content="TEST 분석")]})
    assert result["analysis_result"]
    assert result["presentation"] is None
    assert "시각화 생성에 실패" in result["messages"][-1].content
