"""Regression: the explicit daily/weekly task cannot end at a promise."""

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from graph.primary_graphs.talib_agent.completion import (
    comparison_requirements,
    missing_comparisons,
)
from graph.primary_graphs.talib_agent.tools import build_tools
from graph.primary_graphs.talib_agent.workflow import build_talib_agent
from tests.test_talib_agent_graph import call, fetcher


async def no_validation_errors(program):
    return []


async def no_followups(*args):
    return {"followUps": [], "followUpsStatus": "ready"}


class ComparisonAgent:
    def __init__(self):
        self.calls = 0
        self.tools = build_tools(fetcher=fetcher)

    async def ainvoke(self, state):
        self.calls += 1
        interval = "1d" if self.calls == 1 else "1wk"
        fetched = await call(
            self.tools, "get_price_ohlcv", state, ticker="AAPL", interval=interval
        )
        updated = {**state, **fetched}
        calculated = await call(
            self.tools,
            "run_talib_functions",
            updated,
            requests=[
                {
                    "id": f"{interval}-{name}",
                    "function": name,
                    "parameters": {"timeperiod": 14 if name == "RSI" else 20},
                    "inputs": {"price": {"dataset": "AAPL", "field": "close"}},
                }
                for name in ("RSI", "SMA")
            ],
        )
        return {
            **updated,
            **calculated,
            "messages": [
                *state["messages"],
                AIMessage(
                    id=f"answer-{self.calls}",
                    content="이제 주봉을 계산하겠습니다."
                    if self.calls == 1
                    else "일봉과 주봉 비교 완료",
                ),
            ],
        }


@pytest.mark.asyncio
async def test_partial_daily_answer_continues_once_and_keeps_both_intervals():
    agent = ComparisonAgent()
    graph = build_talib_agent(
        agent=agent, validator=no_validation_errors, followups=no_followups
    )
    result = await graph.ainvoke(
        {
            "messages": [
                HumanMessage(content="AAPL 일봉·주봉 RSI와 SMA를 계산하고 비교해줘")
            ]
        }
    )
    assert agent.calls == 2
    assert set(result["current_result_ids"]) == {
        "1d-RSI",
        "1d-SMA",
        "1wk-RSI",
        "1wk-SMA",
    }
    assert result["datasets"]["AAPL:1d"]["metadata"]["interval"] == "1d"
    assert result["datasets"]["AAPL:1wk"]["metadata"]["interval"] == "1wk"
    assert (
        result["result_requests"]["1d-RSI"]["inputs"]["price"]["dataset"] == "AAPL:1d"
    )
    assert (
        result["result_requests"]["1wk-RSI"]["inputs"]["price"]["dataset"] == "AAPL:1wk"
    )
    assert (
        missing_comparisons(comparison_requirements(result["messages"]), result) == []
    )
    assert (
        result["presentation"]
        and "1d-RSI" in result["presentation"]["program"]
        and "1wk-RSI" in result["presentation"]["program"]
    )
    assert not any(message.type == "system" for message in result["messages"])


@pytest.mark.asyncio
async def test_incomplete_comparison_is_bounded_and_explicit_not_a_success_claim():
    class Agent:
        calls = 0

        async def ainvoke(self, state):
            self.calls += 1
            return {
                "messages": [
                    *state["messages"],
                    AIMessage(content="곧 주봉을 계산하겠습니다."),
                ]
            }

    agent = Agent()
    result = await build_talib_agent(
        agent=agent, validator=no_validation_errors, followups=no_followups
    ).ainvoke({"messages": [HumanMessage(content="AAPL daily and weekly RSI 비교")]})
    assert agent.calls == 2
    assert "완료되지 않았습니다" in result["messages"][-1].content
    assert result["presentation"] is None


@pytest.mark.asyncio
async def test_actual_data_error_does_not_repeat_the_failed_fetch():
    class Agent:
        calls = 0

        async def ainvoke(self, state):
            self.calls += 1
            return {
                "analysis_error": "price unavailable",
                "messages": [AIMessage(content="가격 조회 실패")],
            }

    agent = Agent()
    result = await build_talib_agent(agent=agent, followups=no_followups).ainvoke(
        {"messages": [HumanMessage(content="AAPL 일봉 주봉 RSI 계산")]}
    )
    assert agent.calls == 1
    assert "미계산 항목" in result["messages"][-1].content


def test_completion_guard_only_applies_to_explicit_two_interval_requests():
    assert comparison_requirements([HumanMessage(content="AAPL 일봉 RSI")]) == []
    assert comparison_requirements([HumanMessage(content="RSI와 SMA란?")]) == []
    assert set(
        comparison_requirements([HumanMessage(content="AAPL 일봉·주봉 RSI/SMA 비교")])
    ) == {("1d", "RSI"), ("1wk", "RSI"), ("1d", "SMA"), ("1wk", "SMA")}


@pytest.mark.asyncio
async def test_refresh_or_failure_of_one_interval_preserves_the_other_results():
    tools = build_tools(fetcher=fetcher)
    daily = await call(tools, "get_price_ohlcv", {}, ticker="AAPL", interval="1d")
    calculated = await call(
        tools,
        "run_talib_functions",
        daily,
        requests=[
            {
                "id": "daily",
                "function": "RSI",
                "inputs": {"price": {"dataset": "AAPL", "field": "close"}},
            }
        ],
    )
    daily = {**daily, **calculated}
    weekly = await call(tools, "get_price_ohlcv", daily, ticker="AAPL", interval="1wk")
    state = {**daily, **weekly}
    assert weekly["current_result_ids"] == ["daily"]
    assert "daily" in weekly["results"]
    refreshed = await call(
        tools, "get_price_ohlcv", state, ticker="AAPL", interval="1wk"
    )
    assert "daily" in refreshed["results"]

    def fail(*args):
        raise ValueError("unavailable weekly data")

    failed = await call(
        build_tools(fetcher=fail),
        "get_price_ohlcv",
        {**state, **refreshed},
        ticker="AAPL",
        interval="1wk",
    )
    assert "AAPL:1d" in failed["datasets"] and "AAPL:1wk" not in failed["datasets"]
    assert failed["current_result_ids"] == ["daily"]
    assert "daily" in failed["results"]
    assert calculated["messages"][-1].content.find('"origin"') >= 0


def test_original_starter_period_suffixes_require_both_functions_at_both_intervals():
    question = "AAPL 일봉 120개로 RSI14와 SMA20을 먼저 계산한 뒤 주봉 120개로 같은 지표를 계산해 차이를 비교해 줘. 앞선 결과를 설명한 후 주기를 바꿔 줘."
    assert set(comparison_requirements([HumanMessage(content=question)])) == {
        ("1d", "RSI"),
        ("1wk", "RSI"),
        ("1d", "SMA"),
        ("1wk", "SMA"),
    }
    assert (
        comparison_requirements([HumanMessage(content="일봉과 주봉 RSI는 무엇인가요?")])
        == []
    )
