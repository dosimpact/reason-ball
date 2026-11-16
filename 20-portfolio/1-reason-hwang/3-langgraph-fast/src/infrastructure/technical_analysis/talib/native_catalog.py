"""Discover the pinned native library rather than extending the TA20 contract."""

from typing import Any, cast

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


SQZMOM_LEVELS = {
    "-1": "Bollinger lower is below the wide Keltner lower AND Bollinger upper is above the wide Keltner upper: squeeze released/outside wide channel",
    "0": "No strict inside/outside condition: partial overlap or a band touching a channel edge",
    "1": "Both Bollinger bands strictly inside the wide Keltner channel, but not inside normal/narrow",
    "2": "Both Bollinger bands strictly inside the normal Keltner channel, but not inside narrow",
    "3": "Both Bollinger bands strictly inside the narrow Keltner channel: tightest compression",
}
SQZMOM_SOURCE = "https://github.com/TA-Lib/ta-lib/blob/v0.8.3/src/ta_func/ta_SQZMOM.c"


def output_semantics(name, output):
    if name == "SQZMOM" and output == "squeeze":
        return {
            "kind": "ordinal-state",
            "levels": SQZMOM_LEVELS,
            "comparison": "strict; touching edges are not inside or outside",
            "source": SQZMOM_SOURCE,
            "warning": "Compression level is not momentum direction, a probability, or a trading signal.",
        }
    return None


def describe(name):
    if name not in talib.get_functions():
        raise ValueError("Unsupported native TA-Lib function: " + str(name))
    function = cast(Any, abstract).Function(name)
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
                or (name == "SQZMOM" and key == "squeeze")
                else "number",
                "flags": flags,
                **(
                    {"semantics": output_semantics(name, key)}
                    if output_semantics(name, key)
                    else {}
                ),
            }
            for key, flags in function.output_flags.items()
        ],
        "flags": info.get("function_flags") or [],
        "lookback": function.lookback,
        "inputConstraints": {
            "strictlyPositive": "Input must be positive"
            in (info.get("function_flags") or []),
            "notes": "Percentage ROC/ROCP/ROCR/ROCR100 require strictly positive full-history inputs; signed cumulative OBV/AD should be compared by absolute change or slope, not unsolicited percentage ROC."
            if name in {"ROC", "ROCP", "ROCR", "ROCR100"}
            else "Native function flags and input domains apply.",
        },
    }


def catalog():
    names = talib.get_functions()
    return {
        "version": talib.__version__,
        "nativeVersion": talib.__ta_version__.decode(),
        "count": len(names),
        "functions": [describe(name) for name in names],
    }
