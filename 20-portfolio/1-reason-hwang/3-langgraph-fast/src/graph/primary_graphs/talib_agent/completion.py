"""Narrow completion guard for explicitly requested daily/weekly comparisons."""

import re

from langchain_core.messages import HumanMessage

from domains.talib_agent.catalog import catalog


def comparison_requirements(messages):
    question = next(
        (
            str(message.content)
            for message in reversed(messages)
            if isinstance(message, HumanMessage)
        ),
        "",
    )
    daily = re.search(r"일봉|daily|(?<!\w)1d(?!\w)", question, re.IGNORECASE)
    weekly = re.search(r"주봉|weekly|(?<!\w)1wk(?!\w)", question, re.IGNORECASE)
    calculation = re.search(
        r"계산|분석|비교|calculate|compare|analy[sz]e", question, re.IGNORECASE
    )
    if not daily or not weekly or not calculation:
        return []
    functions = [
        item["name"]
        for item in catalog()["functions"]
        if re.search(
            r"(?<![A-Z0-9_])" + re.escape(item["name"]) + r"(?:[0-9]+)?(?![A-Z0-9_])",
            question,
            re.IGNORECASE,
        )
    ]
    return [
        (interval, name) for interval in ("1d", "1wk") for name in (functions or ["*"])
    ]


def result_intervals(identifier, state, seen=None):
    seen = set() if seen is None else seen
    if identifier in seen:
        return set()
    seen.add(identifier)
    intervals = set()
    for ref in (
        state.get("result_requests", {}).get(identifier, {}).get("inputs", {}).values()
    ):
        if "dataset" in ref:
            meta = state.get("datasets", {}).get(ref["dataset"], {}).get("metadata", {})
            if meta.get("interval"):
                intervals.add(meta["interval"])
        if "result" in ref:
            intervals.update(result_intervals(ref["result"], state, seen))
    return intervals


def missing_comparisons(requirements, state):
    attempted = set()
    for identifier in state.get("current_result_ids", []):
        result = state.get("results", {}).get(identifier, {})
        if result.get("status") not in {"success", "error"}:
            continue
        for interval in result_intervals(identifier, state):
            attempted.add((interval, result.get("function")))
            attempted.add((interval, "*"))
    return [item for item in requirements if item not in attempted]
