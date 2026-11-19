"""Native messages boundary, actual tools, durable follow-ups and inline output."""

import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import InMemorySaver

from graph.primary_graphs.talib_agent.tools import build_tools, invalidate_results
from graph.primary_graphs.talib_agent.workflow import (
    build_talib_agent,
    business_input,
    business_update,
)
from graph.shared.value_objects import PriceData


class PresentationModel:
    def __init__(self, error=None):
        self.calls = []
        self.error = error

    def with_structured_output(self, schema):
        return self

    async def ainvoke(self, messages):
        self.calls.append(messages)
        if self.error:
            raise self.error
        payload = json.loads(messages[-1].content)
        context = payload["presentationContext"]
        identifiers = [r["id"] for r in context["results"]]
        return {"program": "root = Text(" + json.dumps(", ".join(identifiers)) + ")"}


def fetcher(ticker, interval, count, adjusted):
    return SimpleNamespace(
        prices=[
            PriceData(
                symbol=ticker,
                trading_date=date(2024, 1, 1) + timedelta(days=i),
                timezone="UTC",
                open=Decimal(i + 10),
                high=Decimal(i + 12),
                low=Decimal(i + 9),
                close=Decimal(i + 11),
                adjusted_close=Decimal(i + 11),
                volume=100,
                currency="USD",
                fetched_at=datetime(2026, 11, 16, tzinfo=UTC),
            )
            for i in range(count)
        ]
    )


async def call(tools, name, state, **args):
    selected = next(t for t in tools if t.name == name)
    result = await selected.ainvoke(
        {
            "name": name,
            "args": {"state": state, **args},
            "id": name,
            "type": "tool_call",
        }
    )
    return result.update


@pytest.mark.asyncio
async def test_tools_real_native_arrays_private_chaining_and_long_warmup():
    calls = []

    def prices(*args):
        calls.append(args)
        return fetcher(*args)

    tools = build_tools(fetcher=prices)
    state = await call(tools, "get_price_ohlcv", {}, ticker="AAPL")
    assert len(state["datasets"]["AAPL"]["close"]) == 600
    assert "close" not in json.loads(state["messages"][-1].content)
    first = await call(
        tools,
        "run_talib_functions",
        state,
        requests=[
            {
                "id": "long",
                "function": "SMA",
                "parameters": {"timeperiod": 800},
                "inputs": {"price": {"dataset": "AAPL", "field": "close"}},
            }
        ],
    )
    assert calls[-1][2] == 920
    assert first["results"]["long"]["status"] == "success"
    assert first["results"]["long"]["outputs"]["real"]["lastBarValue"] is not None
    assert "values" not in first["messages"][-1].content
    second = await call(
        tools,
        "run_talib_functions",
        {**state, **first},
        requests=[
            {
                "id": "chain",
                "function": "EMA",
                "parameters": {"timeperiod": 5},
                "inputs": {"price": {"result": "long", "output": "real"}},
            }
        ],
    )
    assert second["results"]["chain"]["status"] == "success"
    combined = {**state, **first, **second}
    added = await call(tools, "get_price_ohlcv", combined, ticker="MSFT")
    assert "long" in added["results"] and "chain" in added["results"]
    replaced = await call(
        tools, "get_price_ohlcv", {**combined, **added}, ticker="AAPL"
    )
    assert "long" not in replaced["results"] and "chain" not in replaced["results"]


def test_invalidation_dependency_closure_preserves_independent_results():
    state = {
        "datasets": {"A": {}, "B": {}},
        "results": {key: {} for key in ["a", "b", "chain"]},
        "result_requests": {
            "a": {"inputs": {"price": {"dataset": "A"}}},
            "b": {"inputs": {"price": {"dataset": "B"}}},
            "chain": {"inputs": {"price": {"result": "a"}}},
        },
    }
    assert set(invalidate_results(state, "A")[0]) == {"b"}


@pytest.mark.asyncio
async def test_messages_only_public_input_and_private_agent_adapter_multi_turn():
    tools = build_tools(fetcher=fetcher)

    class Agent:
        async def ainvoke(self, state):
            user = state["messages"][-1].content
            if user == "explain":
                return {
                    "messages": [
                        *state["messages"],
                        AIMessage(id="explanation", content="설명만 합니다."),
                    ],
                    "files": {"secret": "private"},
                    "todos": [],
                }
            first = await call(tools, "get_price_ohlcv", state, ticker="AAPL")
            second = await call(
                tools,
                "run_talib_functions",
                {**state, **first},
                requests=[
                    {
                        "id": "rsi",
                        "function": "RSI",
                        "inputs": {"price": {"dataset": "AAPL", "field": "close"}},
                    }
                ],
            )
            return {
                **first,
                **second,
                "messages": [
                    *state["messages"],
                    AIMessage(id="answer", content="계산 완료"),
                ],
            }

    async def validator(program):
        assert program.startswith("root = Text(")
        return []

    async def follows(*args):
        return {
            "followUps": ["기간 변경", "다른 함수", "입력 설명"],
            "followUpsStatus": "ready",
        }

    model = PresentationModel()
    graph = build_talib_agent(
        model=model, agent=Agent(), validator=validator, followups=follows
    )
    assert set(graph.get_input_jsonschema()["properties"]) == {"messages"}
    persisted = graph.builder.compile(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "owned-talib"}}
    first = await persisted.ainvoke(
        {"messages": [HumanMessage(id="h1", content="calculate")]}, config
    )
    assert first["presentation"] and first["followUpsStatus"] == "ready"
    assert len(model.calls) == 1
    evidence = json.loads(model.calls[0][-1].content)["presentationContext"]
    assert evidence["results"][0]["id"] == "rsi"
    assert len(evidence["results"][0]["outputs"]["real"]["points"]) <= 120
    assert len(first["datasets"]["AAPL"]["dates"]) == 600
    second = await persisted.ainvoke(
        {"messages": [HumanMessage(id="h2", content="explain")]}, config
    )
    assert second["presentation"] is None and second["current_result_ids"] == []
    assert (
        "rsi" in second["results"] and "files" not in second and "todos" not in second
    )
    ids = [m.id for m in second["messages"]]
    assert len(ids) == len(set(ids))
    new = await persisted.ainvoke(
        {"messages": [HumanMessage(content="explain")]},
        {"configurable": {"thread_id": "new-talib"}},
    )
    assert not new.get("datasets")


def test_message_adapter_keeps_ids_and_excludes_private_fields():
    state = {
        "messages": [HumanMessage(id="h", content="hi")],
        "datasets": {"A": {"close": [1, 2]}},
    }
    supplied = business_input(state)
    assert supplied["messages"][0].id == "h"
    output = business_update(
        state,
        {
            "messages": supplied["messages"] + [AIMessage(id="a", content="hello")],
            "files": {"x": "y"},
        },
    )
    assert [m.id for m in output["messages"]] == ["a"] and "files" not in output


@pytest.mark.asyncio
async def test_validation_failure_does_not_publish_unvalidated_program():
    class Agent:
        async def ainvoke(self, state):
            return {
                "messages": [AIMessage(content="done")],
                "results": {
                    "x": {
                        "id": "x",
                        "function": "ADD",
                        "status": "success",
                        "dates": ["2026-01-01"],
                        "outputs": {"real": {"values": [1], "lastBarValue": 1}},
                    }
                },
                "current_result_ids": ["x"],
            }

    async def validator(program):
        return ["invalid"]

    async def follows(*args):
        return {"followUps": [], "followUpsStatus": "unavailable"}

    result = await build_talib_agent(
        model=PresentationModel(), agent=Agent(), validator=validator, followups=follows
    ).ainvoke({"messages": [HumanMessage(content="go")]})
    assert result["presentation"] is None
    assert "검증" in result["messages"][-1].content


@pytest.mark.asyncio
async def test_missing_request_id_uses_engine_assigned_id():
    tools = build_tools()
    result = await call(
        tools,
        "run_talib_functions",
        {},
        requests=[
            {
                "function": "ADD",
                "inputs": {
                    "price0": {"values": [1, 2], "dates": ["2026-01-01", "2026-01-02"]},
                    "price1": {"values": [3, 4], "dates": ["2026-01-01", "2026-01-02"]},
                },
            }
        ],
    )
    identifier = next(iter(result["results"]))
    assert result["result_requests"][identifier]["id"] == identifier
    assert result["results"][identifier]["status"] == "success"


@pytest.mark.asyncio
async def test_oversized_presentation_falls_back_without_discarding_results(
    monkeypatch,
):
    from graph.primary_graphs.talib_agent import workflow

    def oversized(state):
        raise ValueError("too large")

    monkeypatch.setattr(workflow, "build_presentation_context", oversized)

    class Agent:
        async def ainvoke(self, state):
            return {
                "messages": [AIMessage(content="Computed result summary")],
                "results": {"x": {"id": "x"}},
                "current_result_ids": ["x"],
            }

    async def follows(*args):
        return {"followUps": [], "followUpsStatus": "unavailable"}

    result = await build_talib_agent(agent=Agent(), followups=follows).ainvoke(
        {"messages": [HumanMessage(content="calculate")]}
    )
    assert result["presentation"] is None and result["results"]["x"]["id"] == "x"
    assert "검증" in result["messages"][-1].content


@pytest.mark.asyncio
async def test_warmup_provider_failure_is_a_tool_error_not_failed_graph():
    from graph.subgraph.price_agent.tools.yahoo_finance import PriceProviderError

    def unavailable(*args):
        raise PriceProviderError("provider_error", "Unavailable")

    tools = build_tools(fetcher=unavailable)
    initial = await call(
        build_tools(fetcher=fetcher), "get_price_ohlcv", {}, ticker="AAPL"
    )
    result = await call(
        tools,
        "run_talib_functions",
        initial,
        requests=[
            {
                "id": "long",
                "function": "SMA",
                "parameters": {"timeperiod": 800},
                "inputs": {"price": {"dataset": "AAPL", "field": "close"}},
            }
        ],
    )
    assert (
        result["messages"][-1].status == "error" and result["current_result_ids"] == []
    )
    assert result["analysis_error"] == "Unavailable"


def test_presentation_context_selects_current_results_and_preserves_gaps():
    from graph.primary_graphs.talib_agent.presentation import build_presentation_context

    result = {
        "id": "current",
        "function": "SMA",
        "status": "success",
        "dates": [str(i) for i in range(600)],
        "inputMetadata": {
            "price": {"source_url": "https://example.test/prices", "currency": "USD"}
        },
        "outputs": {"real": {"values": [1] * 599 + [None], "lastBarValue": None}},
    }
    state = {
        "results": {"current": result, "stale": {"id": "stale"}},
        "current_result_ids": ["current"],
    }
    context = build_presentation_context(state)
    assert [row["id"] for row in context["results"]] == ["current"]
    displayed = context["results"][0]
    assert displayed["inputMetadata"] == result["inputMetadata"]
    assert len(displayed["outputs"]["real"]["points"]) == 120
    assert displayed["outputs"]["real"]["points"][-1] == {"date": "599", "value": None}
    assert len(result["outputs"]["real"]["values"]) == 600


@pytest.mark.asyncio
async def test_presentation_provider_failure_keeps_results_and_followups():
    class Agent:
        async def ainvoke(self, state):
            return {
                "messages": [AIMessage(content="Verified answer")],
                "results": {
                    "r": {
                        "id": "r",
                        "function": "ADD",
                        "status": "success",
                        "outputs": {},
                    }
                },
                "current_result_ids": ["r"],
            }

    async def follows(*args):
        return {"followUps": ["다른 기간"], "followUpsStatus": "ready"}

    model = PresentationModel(error=RuntimeError("provider unavailable"))
    result = await build_talib_agent(
        model=model, agent=Agent(), followups=follows
    ).ainvoke({"messages": [HumanMessage(content="calculate")]})
    assert len(model.calls) == 1
    assert result["presentation"] is None
    assert result["results"]["r"]["status"] == "success"
    assert any(m.content == "Verified answer" for m in result["messages"])
    assert result["followUpsStatus"] == "ready"
