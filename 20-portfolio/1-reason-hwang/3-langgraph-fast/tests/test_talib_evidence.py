"""Native enum semantics and bounded descriptive time-series evidence."""

import numpy as np
import talib

from domains.talib_agent.catalog import describe
from domains.talib_agent.engine import execute_batch
from domains.talib_agent.evidence import summarize_result


def test_sqzmom_state_metadata_matches_pinned_native_channel_comparisons():
    rng = np.random.default_rng(45)
    close = 100 + np.cumsum(rng.normal(size=1200))
    spread = 0.1 + 5 * (np.sin(np.arange(1200) / 100) + 1)
    high, low = close + spread, close - spread
    _, squeeze = talib.SQZMOM(high, low, close)
    center = talib.SMA(close, 20)
    deviation = talib.STDDEV(close, 20) * 2
    channel = talib.SMA(talib.TRANGE(high, low, close), 20)
    for index in range(describe("SQZMOM")["lookback"], len(close)):
        lower, upper = (
            center[index] - deviation[index],
            center[index] + deviation[index],
        )
        inside = {
            factor: lower > center[index] - factor * channel[index]
            and upper < center[index] + factor * channel[index]
            for factor in (1, 1.5, 2)
        }
        outside = (
            lower < center[index] - 2 * channel[index]
            and upper > center[index] + 2 * channel[index]
        )
        expected = (
            3
            if inside[1]
            else 2
            if inside[1.5]
            else 1
            if inside[2]
            else -1
            if outside
            else 0
        )
        assert squeeze[index] == expected
    output = next(
        item for item in describe("SQZMOM")["outputs"] if item["name"] == "squeeze"
    )
    assert output["type"] == "integer"
    assert set(output["semantics"]["levels"]) == {"-1", "0", "1", "2", "3"}
    assert "released" in output["semantics"]["levels"]["-1"]
    constant = np.ones(100) * 100
    _, touching = talib.SQZMOM(
        constant + 1,
        constant - 1,
        constant,
        nbdev=0,
        factorwide=0,
        factornormal=0,
        factornarrow=0,
    )
    assert touching[-1] == 0


def test_signed_input_roc_is_explicitly_rejected_without_changing_native_domain():
    request = {
        "id": "roc",
        "function": "ROC",
        "parameters": {"timeperiod": 1},
        "inputs": {
            "price": {
                "values": [-2, -1, 1, 2],
                "dates": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"],
            }
        },
    }
    result = execute_batch([request], {})["results"][0]
    assert result["status"] == "error" and "strictly positive inputs" in result["error"]
    assert describe("ROC")["inputConstraints"]["strictlyPositive"]
    request["inputs"]["price"]["values"] = [1, 2, 4, 8]
    assert execute_batch([request], {})["results"][0]["status"] == "success"


def test_native_summary_has_actual_price_volume_and_output_changes_without_arrays():
    state = {
        "datasets": {
            "AAPL:1d": {
                "dates": ["1", "2", "3"],
                "close": [10, 11, 12],
                "volume": [100, 80, 70],
                "metadata": {
                    "ticker": "AAPL",
                    "interval": "1d",
                    "count": 3,
                    "currency": "USD",
                },
            }
        }
    }
    result = {
        "id": "obv",
        "function": "OBV",
        "dates": ["1", "2", "3"],
        "inputMetadata": {"price": {"dataset": "AAPL:1d"}},
        "outputs": {
            "real": {"type": "number", "values": [-10, None, -3], "lastBarValue": -3}
        },
    }
    summary = summarize_result(result, state)
    assert summary["market"][0]["price"]["delta"] == 2
    assert summary["market"][0]["volume"]["delta"] == -30
    assert summary["outputs"]["real"]["delta"] == 7
    assert summary["outputs"]["real"]["changePercent"] is None
    assert summary["outputs"]["real"]["validCount"] == 2
    assert summary["outputs"]["real"]["start"] == "1"
    assert "values" not in str(summary) and "dates" not in summary


import pytest

from graph.primary_graphs.talib_agent.tools import build_tools
from tests.test_talib_agent_graph import call, fetcher


@pytest.mark.asyncio
async def test_compatibility_alias_does_not_make_single_dataset_defaults_ambiguous():
    tools = build_tools(fetcher=fetcher)
    state = await call(tools, "get_price_ohlcv", {}, ticker="AAPL")
    computed = await call(
        tools, "run_talib_functions", state, requests=[{"id": "obv", "function": "OBV"}]
    )
    assert computed["results"]["obv"]["status"] == "success"
    assert computed["result_requests"]["obv"]["dataset"] == "AAPL:1d"
    other = await call(tools, "get_price_ohlcv", {**state, **computed}, ticker="MSFT")
    assert "obv" in other["results"]
    ambiguous = await call(
        tools,
        "run_talib_functions",
        {**state, **computed, **other},
        requests=[{"id": "unknown", "function": "OBV"}],
    )
    assert ambiguous["results"]["unknown"]["status"] == "error"
