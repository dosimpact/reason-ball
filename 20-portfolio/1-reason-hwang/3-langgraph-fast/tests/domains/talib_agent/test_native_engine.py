"""Native parity and adversarial input coverage for every pinned function."""

import copy
import json
from datetime import date, timedelta

import numpy as np
import pytest
import talib
from talib import abstract

from domains.talib_agent.catalog import catalog, describe
from domains.talib_agent.engine import execute_batch


@pytest.fixture
def prices():
    count = 600
    rng = np.random.default_rng(42)
    close = 100 + np.cumsum(rng.normal(0, 0.5, count))
    return {
        "dates": [
            (date(2020, 1, 1) + timedelta(days=i)).isoformat() for i in range(count)
        ],
        "open": (close - 0.2).tolist(),
        "high": (close + 1).tolist(),
        "low": (close - 1).tolist(),
        "close": close.tolist(),
        "volume": rng.uniform(1000, 10000, count).tolist(),
    }


def request(name):
    inputs = {}
    for item in describe(name)["inputs"]:
        if item["key"] in {"price0", "price1"}:
            inputs[item["key"]] = {"dataset": "x", "field": item["defaultField"]}
        if item["key"] == "periods":
            inputs["periods"] = {"dataset": "x", "constant": 14}
    return {"id": name, "function": name, "inputs": inputs}


def test_catalog_exact_pinned_native_coverage():
    result = catalog()
    assert result["version"] == "0.8.3"
    assert result["count"] == 237
    assert {item["name"] for item in result["functions"]} == set(talib.get_functions())
    assert len({item["group"] for item in result["functions"]}) == 10
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("name", talib.get_functions())
def test_every_function_matches_native(name, prices):
    before = copy.deepcopy(prices)
    result = execute_batch([request(name)], {"x": prices})["results"][0]
    assert result["status"] == "success", result
    native_inputs = {
        key: np.asarray(values, dtype=float)
        for key, values in prices.items()
        if key != "dates"
    }
    native_inputs["periods"] = np.full(len(prices["dates"]), 14.0, dtype=float)
    function = abstract.Function(name)
    expected = function(native_inputs)
    expected = expected if isinstance(expected, list) else [expected]
    for key, values in zip(function.output_names, expected, strict=True):
        values = np.asarray(values, dtype=float)
        values[: function.lookback] = np.nan
        actual = np.asarray(
            [
                np.nan if value is None else value
                for value in result["outputs"][key]["values"]
            ]
        )
        np.testing.assert_allclose(
            actual, values, rtol=1e-12, atol=1e-12, equal_nan=True
        )
    assert prices == before
    json.dumps(result, allow_nan=False)


def test_mavp_requires_aligned_finite_bounded_period_array(prices):
    missing = execute_batch([{"id": "m", "function": "MAVP"}], {"x": prices})[
        "results"
    ][0]
    assert missing["status"] == "error"
    assert "periods" in missing["error"]
    for period in (1, 31, 14.5):
        item = request("MAVP")
        item["inputs"]["periods"]["constant"] = period
        assert execute_batch([item], {"x": prices})["results"][0]["status"] == "error"
    assert (
        execute_batch([request("MAVP")], {"x": prices})["results"][0]["status"]
        == "success"
    )


def test_multi_series_requires_explicit_mapping_and_inner_aligns_dates(prices):
    second = copy.deepcopy(prices)
    for key in second:
        second[key] = second[key][1:]
    implicit = execute_batch([{"function": "CORREL"}], {"x": prices})["results"][0]
    assert implicit["status"] == "error"
    result = execute_batch(
        [
            {
                "id": "add",
                "function": "ADD",
                "inputs": {
                    "price0": {"dataset": "x", "field": "close"},
                    "price1": {"dataset": "y", "field": "close"},
                },
            }
        ],
        {"x": prices, "y": second},
    )["results"][0]
    assert result["dates"] == second["dates"]
    np.testing.assert_allclose(
        result["outputs"]["real"]["values"], np.asarray(second["close"]) * 2
    )
    assert any("intersection" in warning for warning in result["warnings"])


def test_prior_output_and_custom_arrays(prices):
    result = execute_batch(
        [
            {"id": "sma", "function": "SMA", "parameters": {"timeperiod": 3}},
            {
                "id": "sum",
                "function": "ADD",
                "inputs": {
                    "price0": {"result": "sma", "output": "real"},
                    "price1": {"constant": 2, "dataset": "x"},
                },
            },
        ],
        {"x": prices},
    )
    assert all(item["status"] == "success" for item in result["results"])
    first, second = result["results"]
    assert second["outputs"]["real"]["values"][-1] == pytest.approx(
        first["outputs"]["real"]["values"][-1] + 2
    )
    transformed = execute_batch(
        [
            {
                "function": "ACOS",
                "inputs": {
                    "price": {"values": [0.0, 0.5, 1.0], "dates": prices["dates"][:3]}
                },
            }
        ],
        {},
    )["results"][0]
    assert transformed["outputs"]["real"]["values"] == pytest.approx(
        [np.pi / 2, np.pi / 3, 0]
    )


def test_nonfinite_outputs_are_null_not_stale_latest(prices):
    values = [0.0, 0.5, 2.0]
    result = execute_batch(
        [
            {
                "function": "ACOS",
                "inputs": {"price": {"values": values, "dates": prices["dates"][:3]}},
            }
        ],
        {},
    )["results"][0]
    output = result["outputs"]["real"]
    assert output["lastBarValue"] is None
    assert output["lastValidAt"] == prices["dates"][1]
    assert result["warnings"]
    json.dumps(result, allow_nan=False)


def test_integer_pattern_index_and_parameterized_display_shifts(prices):
    requests = [
        {"id": "pattern", "function": "CDLDOJI"},
        {"id": "index", "function": "MINMAXINDEX", "parameters": {"timeperiod": 5}},
        {"id": "fractal", "function": "FRACTAL", "parameters": {"rightbars": 3}},
        {"id": "ichi", "function": "ICHIMOKU", "parameters": {"kijunperiod": 30}},
        {"id": "dpo", "function": "DPO", "parameters": {"timeperiod": 22}},
    ]
    pattern, index, fractal, ichi, dpo = execute_batch(requests, {"x": prices})[
        "results"
    ]
    assert pattern["outputs"]["integer"]["type"] == "integer"
    assert (
        pattern["outputs"]["integer"]["values"][: pattern["lookback"]]
        == [None] * pattern["lookback"]
    )
    assert index["outputs"]["minidx"]["indexDates"][-1] in prices["dates"]
    assert fractal["outputs"]["swinghigh"]["displayShift"] == -3
    assert ichi["outputs"]["senkouspana"]["displayShift"] == 30
    assert dpo["outputs"]["real"]["displayShift"] == -12


@pytest.mark.parametrize(
    "bad",
    [
        {"function": "BAD"},
        {"function": "SMA", "parameters": {"timeperiod": True}},
        {"function": "SMA", "parameters": {"timeperiod": 0}},
        {"function": "SMA", "parameters": {"unknown": 1}},
        {
            "function": "ADD",
            "inputs": {"price0": {"result": "future", "output": "real"}},
        },
    ],
)
def test_individual_errors_do_not_abort_other_requests(bad, prices):
    outcomes = execute_batch([bad, {"id": "good", "function": "SMA"}], {"x": prices})[
        "results"
    ]
    assert [result["status"] for result in outcomes] == ["error", "success"]


def test_invalid_alignment_and_batch_limits(prices):
    with pytest.raises(ValueError):
        execute_batch([{"function": "SMA"}] * 41, {"x": prices})
    prices["dates"][1] = prices["dates"][0]
    assert (
        execute_batch([{"function": "SMA"}], {"x": prices})["results"][0]["status"]
        == "error"
    )


def test_actual_requested_parameter_lookback():
    from domains.talib_agent.engine import required_lookback

    assert required_lookback("SMA", {"timeperiod": 800}) == 799
    assert required_lookback("SMA", {"timeperiod": 1}) == 0
    with pytest.raises(ValueError):
        required_lookback("SMA", {"timeperiod": 0})
