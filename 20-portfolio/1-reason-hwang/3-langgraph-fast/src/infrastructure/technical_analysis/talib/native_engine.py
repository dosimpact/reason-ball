"""Typed, aligned native calculations with explicit inputs and per-function failures."""

import math
from datetime import date

import numpy as np
import talib
from talib import abstract

from infrastructure.technical_analysis.talib.native_catalog import describe

MAX_POINTS = 20000
MAX_REQUESTS = 40


def _series(dates, values):
    if (
        not isinstance(dates, list)
        or not isinstance(values, (list, tuple))
        or not dates
        or len(dates) != len(values)
        or len(dates) > MAX_POINTS
    ):
        raise ValueError(
            "Input dates/values must be nonempty equal-length arrays, at most 20000 points"
        )
    if any(
        not isinstance(day, str) or date.fromisoformat(day).isoformat() != day
        for day in dates
    ):
        raise ValueError("Input dates must be ISO dates")
    if dates != sorted(set(dates)):
        raise ValueError("Input dates must be unique and increasing")
    if any(
        value is not None
        and (type(value) not in (int, float) or not math.isfinite(value))
        for value in values
    ):
        raise ValueError("Input values must be finite numbers or null")
    return dict(
        zip(
            dates,
            (np.nan if value is None else float(value) for value in values),
            strict=True,
        )
    )


def _resolve(reference, datasets, results):
    if not isinstance(reference, dict):
        raise TypeError("Each input requires a typed reference")
    kinds = [
        key for key in ("result", "values", "constant", "field") if key in reference
    ]
    if len(kinds) != 1:
        raise ValueError(
            "Input reference requires exactly one of result, values, constant, field"
        )
    allowed = {
        "result": {"result", "output"},
        "values": {"values", "dates", "dataset"},
        "constant": {"constant", "dataset"},
        "field": {"dataset", "field"},
    }
    if set(reference) - allowed[kinds[0]]:
        raise ValueError("Unknown input reference fields")
    if "result" in reference:
        result = results.get(reference["result"])
        if not result or result.get("status") != "success":
            raise ValueError("Prior result is missing or failed")
        output = result["outputs"].get(reference.get("output"))
        if output is None:
            raise ValueError("Unknown prior output")
        return _series(result["dates"], output["values"]), {
            "kind": "result",
            **reference,
        }
    if "values" in reference:
        dates = reference.get("dates") or datasets.get(
            reference.get("dataset"), {}
        ).get("dates")
        return _series(dates, reference["values"]), {
            "kind": "array",
            "points": len(reference["values"]),
        }
    dataset = datasets.get(reference.get("dataset"))
    if not dataset:
        raise ValueError("Unknown input dataset")
    if "constant" in reference:
        value = reference["constant"]
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError("Constant must be finite numeric")
        return _series(dataset["dates"], [value] * len(dataset["dates"])), {
            "kind": "constant",
            **reference,
        }
    field = reference.get("field")
    if field not in {"open", "high", "low", "close", "volume"}:
        raise ValueError("Unknown OHLCV field")
    return _series(dataset["dates"], dataset.get(field)), {
        "kind": "dataset",
        **reference,
    }


def _parameters(function, supplied):
    if not isinstance(supplied, dict) or set(supplied) - set(function.parameters):
        raise ValueError("Unknown function parameters")
    parameters = dict(function.parameters)
    for key, value in supplied.items():
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError("Parameters must be finite numeric")
        if type(parameters[key]) is int:
            if int(value) != value:
                raise ValueError("Parameter must be integer: " + key)
            value = int(value)
        parameters[key] = value
    function.set_parameters(parameters)
    if function.lookback < 0:
        raise ValueError("Invalid native function parameters")
    return parameters


def _shift(name, output, parameters):
    # Native 0.8.3 *_DisplayShift contracts from upstream ta_DPO.c,
    # ta_FRACTAL.c and ta_ICHIMOKU.c. Availability dates stay unshifted.
    if name == "ICHIMOKU" and output in {"senkouspana", "senkouspanb"}:
        return parameters["kijunperiod"]
    if name == "DPO":
        return -(parameters["timeperiod"] // 2 + 1)
    if name == "FRACTAL":
        return -parameters["rightbars"]
    return 0


def _calculate(request, datasets, results):
    name = request.get("function", "").upper()
    descriptor = describe(name)
    function = abstract.Function(name)
    parameters = _parameters(function, request.get("parameters", {}))
    supplied = request.get("inputs", {})
    expected = {item["key"] for item in descriptor["inputs"]}
    if not isinstance(supplied, dict) or set(supplied) - expected:
        raise ValueError("Unknown function input keys")
    arrays, metadata = {}, {}
    for item in descriptor["inputs"]:
        key = item["key"]
        reference = supplied.get(key)
        if reference is None:
            if key == "periods" or key in {"price0", "price1"}:
                raise ValueError("Explicit input mapping required: " + key)
            dataset = request.get("dataset") or (
                next(iter(datasets)) if len(datasets) == 1 else None
            )
            reference = {"dataset": dataset, "field": item["defaultField"]}
        arrays[key], metadata[key] = _resolve(reference, datasets, results)
    dates = sorted(set.intersection(*(set(values) for values in arrays.values())))
    if not dates:
        raise ValueError("Inputs have no common dates")
    warnings = []
    if any(len(values) != len(dates) for values in arrays.values()):
        warnings.append("Inputs aligned by intersection of dates; no forward fill")
    native = {}
    for key, values in arrays.items():
        # Override native input aliases so two independent real arrays are never
        # silently interpreted as the default high/low pair.
        native[key] = np.asarray([values[day] for day in dates], dtype=np.float64)
    mapping = {
        key: (list(value) if isinstance(value, list) else key)
        for key, value in function.input_names.items()
    }
    for key, value in mapping.items():
        if isinstance(value, list):
            mapping[key] = value
    function.set_input_names(mapping)
    if "periods" in native:
        periods = native["periods"]
        if (
            np.any(~np.isfinite(periods))
            or np.any(periods != np.floor(periods))
            or np.any(periods < parameters["minperiod"])
            or np.any(periods > parameters["maxperiod"])
        ):
            raise ValueError(
                "MAVP periods must be finite integers within minperiod/maxperiod"
            )
    if any(np.any(~np.isfinite(values)) for values in native.values()):
        warnings.append(
            "Null input gaps passed to native library; recursive outputs may remain null"
        )
    if "Input must be positive" in descriptor["flags"] and any(
        np.any(values[np.isfinite(values)] <= 0) for values in native.values()
    ):
        raise ValueError("Native function requires positive inputs")
    raw = function(native)
    outputs = raw if isinstance(raw, list) else [raw]
    normalized = {}
    for spec, values in zip(descriptor["outputs"], outputs, strict=True):
        if len(values) != len(dates):
            raise ValueError("Native output length mismatch")
        integer = values.dtype.kind in "iu"
        serialized = [
            None if not np.isfinite(value) else int(value) if integer else float(value)
            for value in values
        ]
        # Integer native outputs use zero for warmup; expose missing preparation
        # values explicitly rather than manufacturing a no-pattern signal.
        for index in range(min(function.lookback, len(serialized))):
            serialized[index] = None
        valid = [i for i, value in enumerate(serialized) if value is not None]
        nonfinite = sum(not np.isfinite(value) for value in values[function.lookback :])
        if nonfinite:
            warnings.append(
                f"{spec['name']}: {nonfinite} nonfinite outputs converted to null (domain, zero division or input gaps)"
            )
        offset = _shift(name, spec["name"], parameters)
        normalized[spec["name"]] = {
            "values": serialized,
            "type": "integer" if integer else "number",
            "flags": spec["flags"],
            "displayShift": offset,
            "lastBarValue": serialized[-1],
            "lastValidAt": dates[valid[-1]] if valid else None,
        }
        if offset:
            warnings.append(
                f"{spec['name']}: display shift {offset} bars; values remain on calculation/availability dates"
            )
        if name in {"MAXINDEX", "MININDEX", "MINMAXINDEX", "ZIGZAG"} and (
            "idx" in spec["name"] or name in {"MAXINDEX", "MININDEX"}
        ):
            normalized[spec["name"]]["indexDates"] = [
                dates[int(value)]
                if value is not None and 0 <= int(value) < len(dates)
                else None
                for value in serialized
            ]
    if len(dates) <= function.lookback:
        warnings.append("Insufficient history for native lookback")
    warnings.extend(
        flag
        for flag in descriptor["flags"]
        if "unstable" in flag or "path-dependent" in flag
    )
    if name.startswith("CDL"):
        warnings.append(
            "Candlestick integer scores are pattern codes, not probabilities or trade recommendations"
        )
    return {
        "id": request["id"],
        "function": name,
        "status": "success",
        "parameters": parameters,
        "dates": dates,
        "outputs": normalized,
        "lookback": function.lookback,
        "warnings": list(dict.fromkeys(warnings)),
        "inputMetadata": metadata,
        "origin": {
            "date": dates[0],
            "points": len(dates),
            "policy": "all supplied aligned history; display slicing does not reset calculation",
        },
    }


def execute_batch(requests, datasets, prior_outputs=None):
    if not isinstance(requests, list) or not 1 <= len(requests) <= MAX_REQUESTS:
        raise ValueError("Choose 1–40 function requests")
    if not isinstance(datasets, dict):
        raise TypeError("Datasets must be an object")
    previous = prior_outputs or {}
    if "results" in previous:
        previous = {result["id"]: result for result in previous["results"]}
    results = dict(previous)
    seen = set()
    outcomes = []
    for index, original in enumerate(requests):
        request = dict(original) if isinstance(original, dict) else {}
        identifier = request.get("id", f"result-{index}")
        request["id"] = identifier
        try:
            if (
                not isinstance(identifier, str)
                or not identifier
                or len(identifier) > 100
                or identifier in seen
            ):
                raise ValueError(
                    "Result IDs must be unique nonempty strings of at most 100 characters"
                )
            seen.add(identifier)
            outcome = _calculate(request, datasets, results)
        except Exception as error:  # noqa: BLE001 - independent request failure boundary
            outcome = {
                "id": identifier,
                "function": request.get("function"),
                "status": "error",
                "error": str(error)[:400],
                "dates": [],
                "outputs": {},
                "warnings": [],
            }
        outcomes.append(outcome)
        if isinstance(identifier, str):
            results[identifier] = outcome
    return {"version": talib.__version__, "results": outcomes}


def required_lookback(name, parameters=None):
    """Resolve native preparation using the requested parameters without global changes."""
    name = name.upper()
    describe(name)
    function = abstract.Function(name)
    _parameters(function, parameters or {})
    return function.lookback
