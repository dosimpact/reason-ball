"""Discover the pinned native library rather than extending the TA20 contract."""

import talib
from talib import abstract


def input_descriptors(function):
    inputs = []
    for key, value in function.input_names.items():
        if isinstance(value, list):
            inputs.extend({"key": field, "defaultField": field} for field in value)
        else:
            inputs.append({"key": key, "defaultField": value})
    return inputs


def describe(name):
    if name not in talib.get_functions():
        raise ValueError("Unsupported native TA-Lib function: " + str(name))
    function = abstract.Function(name)
    info = function.info
    return {
        "name": name,
        "group": info["group"],
        "description": info["display_name"],
        "inputs": input_descriptors(function),
        "parameters": {
            key: {
                "default": value,
                "type": "integer" if type(value) is int else "number",
            }
            for key, value in function.parameters.items()
        },
        "outputs": [
            {
                "name": key,
                "type": "integer"
                if key in {"integer", "minidx", "maxidx"}
                or name in {"HT_TRENDMODE", "MAXINDEX", "MININDEX"}
                else "number",
                "flags": flags,
            }
            for key, flags in function.output_flags.items()
        ],
        "flags": info.get("function_flags") or [],
        "lookback": function.lookback,
    }


def catalog():
    names = talib.get_functions()
    return {
        "version": talib.__version__,
        "nativeVersion": talib.__ta_version__.decode(),
        "count": len(names),
        "functions": [describe(name) for name in names],
    }
