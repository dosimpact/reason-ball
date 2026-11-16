"""Immutable TA evidence with a streamed, parser-validated model layout."""
import json
import re

from langchain_core.messages import HumanMessage, SystemMessage

from domains.technical_analysis.presentation import build_program
from domains.technical_analysis.request import AnalysisRequest as CanvasRequest
from graph.subgraphs.openui_output.catalog import load_openui_catalog
from graph.subgraphs.openui_output.workflow import validate_program

__all__ = ["CanvasRequest", "compose_canvas", "layout_errors", "request_for"]


def request_for(report, indicators):
    return {"ticker": report["symbol"], "interval": report["interval"],
            "count": report["requested_count"], "indicators": indicators}


def layout_errors(layout):
    # Strings cannot introduce statements or executable constructors.
    code = re.sub(r'"(?:\\.|[^"\\])*"', '""', layout)
    if not re.fullmatch(r"\s*taLayout\s*=.*", code, re.DOTALL):
        return ["Only taLayout = <layout> is allowed"]
    expression = code.split("=", 1)[1]
    if "=" in expression or ";" in expression or "`" in expression:
        return ["Additional assignments/statements are forbidden"]
    if set(re.findall(r"\b([A-Za-z_]\w*)\s*\(", expression)) - {"Col", "Row", "Grid", "Text", "Title", "Markdown"}:
        return ["Use layout/prose constructors only"]
    identifiers = set(re.findall(r"\b[A-Za-z_]\w*\b", expression))
    if identifiers - {"Col", "Row", "Grid", "Text", "Title", "Markdown", "taPanel", "taSignals"}:
        return ["Unknown layout reference"]
    if any(len(re.findall(r"\b" + name + r"\b", expression)) != 1 for name in ("taPanel", "taSignals")):
        return ["Include taPanel and taSignals exactly once"]
    return []


async def compose_canvas(model, report, question, emit, validator=None):
    prefix = build_program({"answer": report, "canvas": True}) + "\n"
    evidence = {"seriesEvidence": report.get("evidence"), "symbol": report["symbol"], "asOf": report["dates"][-1],
                "indicators": [{"name": i["name"], "parameters": i["parameters"], "signal": i["signal"]} for i in report["indicators"]],
                "warnings": report["warnings"]}
    prompts = [SystemMessage(content=load_openui_catalog() + '\n\nTA CANVAS SCOPE: The following task-specific rules override the generic catalog requirement to generate a complete program/root or use arbitrary registered components. The server owns the prefix, Query, IndicatorControls, data and final root. You only supply taLayout. Compose one OpenUI assignment: taLayout = Col([Text("interpretation"), taPanel, taSignals], 4). Use only Col/Row/Grid/Text/Title/Markdown and taPanel/taSignals exactly once. No markdown fences, extra assignments, Query, numeric chart data or invented evidence. Adapt layout and Korean prose to the question. Use seriesEvidence periods, units, changes and normalizedWidth when relevant; do not claim missing series when these summaries answer the question. Descriptive changes do not establish causality or forecasts. Immutable taPanel contains price, volume and the requested TA20 indicator instances with their validated parameters; taSignals contains verified numeric evidence. Distinguish snapshot analysis from reactive chart refresh. No trading advice.'),
               HumanMessage(content=json.dumps({"question": question, "evidence": evidence}, ensure_ascii=False))]
    check = validator or validate_program
    for attempt in range(2):
        emit("reset", {"program": prefix})
        layout = ""
        try:
            async for chunk in model.astream(prompts, config={"tags": ["ta-canvas-layout"]}):
                content = chunk.content
                delta = content if isinstance(content, str) else "".join(b.get("text", "") for b in content if isinstance(b, dict))
                layout += delta
                if len(prefix) + len(layout) > 60000:
                    raise ValueError("Canvas program exceeds 60000 characters")
                if delta:
                    emit("delta", {"delta": delta})
        except ValueError as error:
            if not any(message in str(error) for message in ("No generations found in stream", "No generation chunks were returned")):
                raise
            # Provider does not support streamed generations: one honest full delta.
            response = await model.ainvoke(prompts)
            layout = response.content
            if not isinstance(layout, str):
                raise TypeError("Invalid layout response")
            emit("reset", {"program": prefix})
            emit("delta", {"delta": layout})
        suffix = "\nroot = Col([taHeader, taLayout, taFooter], 4)"
        emit("delta", {"delta": suffix})
        emit("validating", {})
        errors = layout_errors(layout)
        program = prefix + layout + suffix
        if len(program) > 60000:
            errors.append("Canvas program exceeds 60000 characters")
        if not errors:
            errors = await check(program)
        if not errors:
            return program
        prompts.append(HumanMessage(content="Repair your single taLayout assignment. Errors: " + str(errors)[:3000]))
    raise ValueError("Canvas layout validation failed after one repair")
