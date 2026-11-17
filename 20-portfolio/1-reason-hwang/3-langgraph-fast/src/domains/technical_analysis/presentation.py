"""Trusted, compact presentation inputs; the shared model owns OpenUI layout."""

import json
import re

from langchain_core.messages import AIMessage, HumanMessage


def presentation_input(state: dict, report_id: str | None = None) -> dict:
    report = state["analysis_result"]
    snapshot = report.get("chart_snapshot") or {}
    instances = [
        {key: item[key] for key in ("instanceId", "name", "parameters", "showSignal") if key in item}
        for item in snapshot.get("indicators", [])
        if isinstance(item, dict)
    ]
    if not instances:
        instances = [
            {"instanceId": item.get("instanceId") or f"indicator-{index}", "name": item["name"], "parameters": item["parameters"]}
            for index, item in enumerate(report["indicators"])
        ]
    indicators = [{key: item[key] for key in ("instanceId", "name", "parameters", "signal", "status", "error_message") if key in item} for item in report["indicators"]]
    answer = {key: report.get(key) for key in ("symbol", "interval", "requested_count", "currency", "source_url", "fetched_at", "warnings", "evidence")}
    answer.update({"period": {"start": report["dates"][0], "end": report["dates"][-1]}, "indicators": indicators})
    messages = state.get("messages", [])
    latest = next((index for index in range(len(messages) - 1, -1, -1) if isinstance(messages[index], HumanMessage)), -1)
    answer["explanation"] = "\n".join(str(message.content) for message in messages[latest + 1:] if isinstance(message, AIMessage) and not message.tool_calls and message.content)
    context = {
        "kind": "technical_analysis",
        "instructions": "Compose this verified analysis freely using catalog components. Display source, period, currency, warnings and grounded explanation. Use Query(technical_analysis_chart) backed FinancialChart for price/indicator charts; never embed or invent OHLCV or indicator series arrays. Use schema_version=2 and the supplied instances JSON. Query fallback must have empty bars and indicators. Provide reactive ticker/interval/count/instances controls and manual @Run query refresh (refresh=0); each CanvasItem needs independent variables/query. Preserve original analysis timestamp when query conditions change. Do not wrap the complete report in a single CanvasItem.",
        "chartQuery": {"ticker": report["symbol"], "interval": report["interval"], "count": str(report["requested_count"]), "schema_version": 2, "instances": json.dumps(instances, ensure_ascii=False)},
        "chartFallback": {**{key: value for key, value in snapshot.items() if key not in {"bars", "indicators"}}, "schemaVersion": 2, "bars": [], "indicators": []},
    }
    if report_id:
        context["canvasItems"] = [{"id": report_id + ":chart", "title": report["symbol"] + " · 가격 차트", "instances": []}]
        for index, item in enumerate(indicators):
            instance = next((value for value in instances if item.get("instanceId") and value.get("instanceId") == item["instanceId"]), None)
            if instance is None:
                instance = instances[index]
            context["canvasItems"].append({"id": report_id + ":indicator:" + str(index), "title": report["symbol"] + " · " + item["name"] + " 차트", "instances": [instance]})
        context["instructions"] += " Generate exactly one individually pinnable CanvasItem for each canvasItems entry, using its literal id exactly once and its own indicator subset. No other CanvasItem IDs are allowed."
    return {"question": str(messages[latest].content) if latest >= 0 else "", "answer": answer, "presentation_context": context, "host_evidence": False}


def canvas_item_errors(program: str, required_ids: set[str]) -> list[str]:
    """Inspect constructor tokens outside strings, so quoted prose cannot spoof IDs."""
    string = r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*' '''
    token = re.compile(string + r'|\bCanvasItem\s*\(', re.VERBOSE | re.DOTALL)
    ids = []
    for match in token.finditer(program):
        if not match.group().startswith("CanvasItem"):
            continue
        tail = program[match.end():].lstrip()
        try:
            value, end = json.JSONDecoder().raw_decode(tail)
        except ValueError:
            return ["CanvasItem must use a literal server-owned ID"]
        if not isinstance(value, str) or not tail[end:].lstrip().startswith(","):
            return ["CanvasItem must use a literal server-owned ID"]
        ids.append(value)
    if len(ids) != len(required_ids) or set(ids) != required_ids:
        return ["CanvasItem IDs must match each required server-owned ID exactly once"]
    return []
