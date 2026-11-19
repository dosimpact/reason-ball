"""Bounded verified TA-Lib evidence for the shared presentation model.

This module owns data selection and limits, never OpenUI layout or constructors.
"""

import json
import math

from graph.primary_graphs.talib_agent.tools import result_summary


def build_presentation_context(state):
    results = [
        state["results"][key]
        for key in state.get("current_result_ids", [])
        if key in state.get("results", {})
    ]
    if not results:
        return None
    output_count = sum(len(result.get("outputs", {})) for result in results)
    per_output = max(1, min(120, 400 // max(output_count, 1)))
    selected = []
    for result in results:
        summary = result_summary(result, state)
        for name, output in result.get("outputs", {}).items():
            # Retain gaps and original calculation dates; never bridge missing values.
            summary["outputs"][name]["points"] = [
                {
                    "date": date,
                    "value": value
                    if isinstance(value, (int, float))
                    and not isinstance(value, bool)
                    and math.isfinite(value)
                    else None,
                }
                for date, value in list(
                    zip(result.get("dates", []), output.get("values", []))
                )[-per_output:]
            ]
        selected.append(summary)
    context = {
        "kind": "verified_talib_results",
        "results": selected,
        "displayLimitPerOutput": per_output,
        "limitations": [
            "Only current_result_ids belong to this answer; full arrays remain in graph state.",
            "Points retain calculation dates and null gaps; never interpolate or invent prices/data.",
            "lastBarValue=null means unavailable now; lastValidAt is not the current value.",
            "Pattern integers are signed codes, not prices or probabilities; displayShift does not change calculation dates.",
            "Preserve inputMetadata, origin, units, interval, source links, fetched time, parameters and warnings beside relevant data.",
            "Compose suitable registered components and working reactive controls from these verified points; do not claim unsupported chart features.",
        ],
    }
    if len(json.dumps(context, ensure_ascii=False, allow_nan=False)) > 60000:
        raise ValueError("Presentation evidence exceeds bounded context")
    return context
