"""Example 34: chat-driven sandboxed data analysis canvas."""

from __future__ import annotations

import csv
from io import StringIO
from operator import add
from textwrap import dedent
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm


ExecutionStatus = Literal["idle", "parsing", "retrying", "running", "completed", "completed_with_warnings", "failed"]
FinalStatus = Literal["idle", "running", "analyzed", "retried", "failed"]


class DatasetMetadata(TypedDict, total=False):
    source: str
    row_count: int
    column_count: int
    delimiter: str
    has_header: bool
    preview_count: int
    numeric_columns: list[str]
    categorical_columns: list[str]
    missing_cells: int
    warnings: list[str]


class ParsedColumn(TypedDict, total=False):
    name: str
    inferred_type: str
    missing: int
    unique: int
    sample_values: list[str]
    min: float
    max: float
    mean: float


class AnalysisStep(TypedDict):
    id: str
    title: str
    status: str
    detail: str


class ExecutionError(TypedDict):
    phase: str
    code: str
    message: str
    recoverable: bool


class ChartSpec(TypedDict, total=False):
    id: str
    title: str
    kind: str
    x: str
    y: str
    description: str
    data: list[dict[str, Any]]


class ResultTable(TypedDict, total=False):
    title: str
    columns: list[str]
    rows: list[dict[str, Any]]
    summary: str


class AnalysisEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    progress: float


class ChatDataAnalysisCanvasState(TypedDict, total=False):
    action: str
    user_request: str
    csv_text: str
    dataset_metadata: DatasetMetadata
    parsed_columns: list[ParsedColumn]
    parsed_rows: list[dict[str, str]]
    preview_rows: list[dict[str, str]]
    generated_code: str
    analysis_steps: list[AnalysisStep]
    execution_status: ExecutionStatus
    retry_count: int
    sandbox_logs: list[str]
    execution_errors: list[ExecutionError]
    chart_specs: list[ChartSpec]
    result_table: ResultTable
    insight_summary: str
    final: str
    final_status: FinalStatus
    analysis_events: Annotated[list[AnalysisEvent], add]


DEFAULT_CSV = """team,month,revenue,cost,tickets
Support,Jan,12000,8400,42
Support,Feb,13500,8800,39
Support,Mar,14250,9100,35
Sales,Jan,22000,12800,18
Sales,Feb,24100,13400,21
Sales,Mar,26800,14200,17
Success,Jan,17600,9700,25
Success,Feb,18400,9900,23
Success,Mar,19800,10100,20
"""


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(phase: str, status: str, detail: str, progress: float) -> AnalysisEvent:
    return {
        "type": "chat_data_analysis_canvas",
        "phase": phase,
        "status": status,
        "detail": detail,
        "progress": progress,
    }


def _emit(event: AnalysisEvent) -> AnalysisEvent:
    _writer()(event)
    return event


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text") or block.get("content")
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return str(content)


def _truncate(text: str, limit: int = 360) -> str:
    cleaned = " ".join(text.strip().split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 3].rstrip()}..."


def _normalize_request(value: Any) -> str:
    text = str(value or "").strip()
    return text or "Profile the uploaded CSV and produce a chart-ready analysis summary."


def _round(value: float) -> float:
    return round(value, 2)


def _to_float(value: Any) -> float | None:
    text = str(value or "").strip()
    if not text:
        return None
    normalized = text.replace(",", "").replace("$", "").replace("%", "")
    try:
        return float(normalized)
    except ValueError:
        return None


def _detect_delimiter(text: str) -> str:
    first_line = next((line for line in text.splitlines() if line.strip()), "")
    candidates = [",", ";", "\t", "|"]
    return max(candidates, key=lambda candidate: first_line.count(candidate))


def _dedupe_columns(header: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    columns: list[str] = []
    for index, raw_name in enumerate(header, start=1):
        cleaned = " ".join(str(raw_name or "").strip().split()) or f"column_{index}"
        base = cleaned.replace(" ", "_").lower()
        count = seen.get(base, 0) + 1
        seen[base] = count
        columns.append(base if count == 1 else f"{base}_{count}")
    return columns


def _base_steps() -> list[AnalysisStep]:
    return [
        {
            "id": "load_csv",
            "title": "Load CSV",
            "status": "pending",
            "detail": "Waiting for CSV text to be parsed in memory.",
        },
        {
            "id": "profile_columns",
            "title": "Profile columns",
            "status": "pending",
            "detail": "Waiting for deterministic type and missing-value checks.",
        },
        {
            "id": "generate_code",
            "title": "Generate safe code",
            "status": "pending",
            "detail": "Waiting to create a reviewable analysis plan.",
        },
        {
            "id": "run_sandbox",
            "title": "Run sandbox simulation",
            "status": "pending",
            "detail": "Waiting to compute tables and chart specs without arbitrary code execution.",
        },
        {
            "id": "summarize",
            "title": "Summarize insights",
            "status": "pending",
            "detail": "Waiting to prepare the chat-facing insight summary.",
        },
    ]


def _complete_step(steps: list[AnalysisStep], step_id: str, detail: str) -> list[AnalysisStep]:
    updated: list[AnalysisStep] = []
    for step in steps:
        next_step = dict(step)
        if next_step["id"] == step_id:
            next_step["status"] = "completed"
            next_step["detail"] = detail
        updated.append(next_step)  # type: ignore[arg-type]
    return updated


def _parse_csv_text(
    csv_text: Any,
    *,
    repair: bool,
) -> tuple[str, list[dict[str, str]], list[str], list[ExecutionError], list[str], str]:
    provided = str(csv_text or "").strip()
    source = "provided"
    if not provided:
        provided = DEFAULT_CSV.strip()
        source = "sample"

    delimiter = _detect_delimiter(provided)
    logs = [
        f"CSV source selected: {source}.",
        f"Detected delimiter {delimiter!r} using deterministic header inspection.",
    ]
    errors: list[ExecutionError] = []

    try:
        raw_rows = list(csv.reader(StringIO(provided), delimiter=delimiter))
    except csv.Error as exc:
        raw_rows = []
        errors.append(
            {
                "phase": "parse",
                "code": "csv_reader_error",
                "message": f"CSV reader could not parse input: {exc}",
                "recoverable": True,
            }
        )

    raw_rows = [row for row in raw_rows if any(str(cell).strip() for cell in row)]
    if not raw_rows:
        fallback = DEFAULT_CSV.strip()
        delimiter = ","
        raw_rows = list(csv.reader(StringIO(fallback), delimiter=delimiter))
        provided = fallback
        source = "sample"
        logs.append("Input had no parseable rows; loaded the sample dataset for a deterministic run.")

    columns = _dedupe_columns(raw_rows[0])
    width = len(columns)
    rows: list[dict[str, str]] = []
    for row_index, raw_row in enumerate(raw_rows[1:], start=2):
        row = [str(value).strip() for value in raw_row]
        if len(row) != width:
            message = f"Row {row_index} has {len(row)} cells but header has {width} columns."
            if repair:
                logs.append(f"Retry repair: {message} Padded or trimmed row in memory.")
                row = (row + [""] * width)[:width]
            else:
                errors.append(
                    {
                        "phase": "parse",
                        "code": "row_width_mismatch",
                        "message": message,
                        "recoverable": True,
                    }
                )
                row = (row + [""] * width)[:width]
        rows.append({column: row[index] if index < len(row) else "" for index, column in enumerate(columns)})

    if not rows:
        errors.append(
            {
                "phase": "parse",
                "code": "empty_dataset",
                "message": "CSV contains headers but no data rows.",
                "recoverable": True,
            }
        )
        logs.append("No data rows were available after parsing.")

    return provided, rows, columns, errors, logs, source


def _profile_columns(rows: list[dict[str, str]], columns: list[str]) -> list[ParsedColumn]:
    profiles: list[ParsedColumn] = []
    for column in columns:
        values = [str(row.get(column, "")).strip() for row in rows]
        present = [value for value in values if value]
        numeric_values = [_to_float(value) for value in present]
        numeric_present = [value for value in numeric_values if value is not None]
        is_numeric = bool(present) and len(numeric_present) == len(present)
        profile: ParsedColumn = {
            "name": column,
            "inferred_type": "number" if is_numeric else "category",
            "missing": len(values) - len(present),
            "unique": len(set(present)),
            "sample_values": present[:3],
        }
        if is_numeric and numeric_present:
            profile["min"] = _round(min(numeric_present))
            profile["max"] = _round(max(numeric_present))
            profile["mean"] = _round(sum(numeric_present) / len(numeric_present))
        profiles.append(profile)
    return profiles


def _metadata(
    rows: list[dict[str, str]],
    columns: list[str],
    profiles: list[ParsedColumn],
    delimiter: str,
    source: str,
    errors: list[ExecutionError],
) -> DatasetMetadata:
    numeric_columns = [column["name"] for column in profiles if column.get("inferred_type") == "number"]
    categorical_columns = [column["name"] for column in profiles if column.get("inferred_type") != "number"]
    missing_cells = sum(int(column.get("missing") or 0) for column in profiles)
    return {
        "source": source,
        "row_count": len(rows),
        "column_count": len(columns),
        "delimiter": delimiter,
        "has_header": True,
        "preview_count": min(len(rows), 6),
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "missing_cells": missing_cells,
        "warnings": [error["message"] for error in errors if error.get("recoverable")],
    }


def _generated_code(request: str, metadata: DatasetMetadata, profiles: list[ParsedColumn]) -> str:
    column_names = [profile["name"] for profile in profiles]
    numeric_columns = list(metadata.get("numeric_columns") or [])
    categorical_columns = list(metadata.get("categorical_columns") or [])
    return dedent(
        f"""
        # Memory-only sandbox plan for chat_data_analysis_canvas.
        # This code is generated for review and is not executed by the graph.
        request = {request!r}
        rows = parse_csv(csv_text, delimiter={metadata.get("delimiter", ",")!r})
        columns = {column_names!r}
        numeric_columns = {numeric_columns!r}
        categorical_columns = {categorical_columns!r}

        profile = summarize_columns(rows, numeric_columns, categorical_columns)
        result_table = build_profile_table(profile)
        chart_specs = build_chart_specs(rows, numeric_columns, categorical_columns)
        insight_summary = summarize_findings(request, result_table, chart_specs)
        """
    ).strip()


def _group_average(rows: list[dict[str, str]], category_column: str, numeric_column: str) -> list[dict[str, Any]]:
    buckets: dict[str, list[float]] = {}
    for row in rows:
        label = str(row.get(category_column) or "Unknown").strip() or "Unknown"
        value = _to_float(row.get(numeric_column))
        if value is not None:
            buckets.setdefault(label, []).append(value)
    points = [
        {"label": label, "value": _round(sum(values) / len(values)), "count": len(values)}
        for label, values in buckets.items()
        if values
    ]
    return sorted(points, key=lambda item: (-float(item["value"]), str(item["label"])))[:8]


def _frequency(rows: list[dict[str, str]], column: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for row in rows:
        label = str(row.get(column) or "Unknown").strip() or "Unknown"
        counts[label] = counts.get(label, 0) + 1
    return [
        {"label": label, "value": count}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:8]
    ]


def _chart_specs(rows: list[dict[str, str]], metadata: DatasetMetadata) -> list[ChartSpec]:
    numeric_columns = list(metadata.get("numeric_columns") or [])
    categorical_columns = list(metadata.get("categorical_columns") or [])
    charts: list[ChartSpec] = []

    if numeric_columns and categorical_columns:
        category = categorical_columns[0]
        metric = numeric_columns[0]
        charts.append(
            {
                "id": "chart-1",
                "title": f"Average {metric} by {category}",
                "kind": "bar",
                "x": category,
                "y": f"avg_{metric}",
                "description": "Deterministic group-by average computed from parsed CSV rows.",
                "data": _group_average(rows, category, metric),
            }
        )

    if len(numeric_columns) >= 2:
        x_column, y_column = numeric_columns[0], numeric_columns[1]
        points: list[dict[str, Any]] = []
        for index, row in enumerate(rows[:12], start=1):
            x_value = _to_float(row.get(x_column))
            y_value = _to_float(row.get(y_column))
            if x_value is not None and y_value is not None:
                points.append({"label": str(index), x_column: _round(x_value), y_column: _round(y_value)})
        charts.append(
            {
                "id": "chart-2",
                "title": f"{y_column} vs {x_column}",
                "kind": "scatter",
                "x": x_column,
                "y": y_column,
                "description": "Row-level numeric comparison from the memory-only sandbox.",
                "data": points,
            }
        )

    if not charts and categorical_columns:
        category = categorical_columns[0]
        charts.append(
            {
                "id": "chart-1",
                "title": f"{category} frequency",
                "kind": "bar",
                "x": category,
                "y": "count",
                "description": "Frequency chart for the first categorical column.",
                "data": _frequency(rows, category),
            }
        )

    if int(metadata.get("missing_cells") or 0) > 0:
        charts.append(
            {
                "id": f"chart-{len(charts) + 1}",
                "title": "Missing values by column",
                "kind": "bar",
                "x": "column",
                "y": "missing",
                "description": "Missing-value counts computed during column profiling.",
                "data": [
                    {"label": column, "value": sum(1 for row in rows if not str(row.get(column, "")).strip())}
                    for column in list(rows[0].keys()) if rows
                ],
            }
        )

    return charts


def _result_table(profiles: list[ParsedColumn], metadata: DatasetMetadata) -> ResultTable:
    rows: list[dict[str, Any]] = []
    for profile in profiles:
        rows.append(
            {
                "column": profile["name"],
                "type": profile["inferred_type"],
                "missing": profile["missing"],
                "unique": profile["unique"],
                "mean": profile.get("mean", ""),
                "range": (
                    f"{profile.get('min')} to {profile.get('max')}"
                    if profile.get("inferred_type") == "number"
                    else ""
                ),
            }
        )
    return {
        "title": "Column profile",
        "columns": ["column", "type", "missing", "unique", "mean", "range"],
        "rows": rows,
        "summary": (
            f"Profiled {metadata.get('row_count', 0)} rows across "
            f"{metadata.get('column_count', 0)} columns."
        ),
    }


def _fallback_summary(
    request: str,
    metadata: DatasetMetadata,
    profiles: list[ParsedColumn],
    chart_specs: list[ChartSpec],
) -> str:
    numeric_columns = list(metadata.get("numeric_columns") or [])
    categorical_columns = list(metadata.get("categorical_columns") or [])
    leading_metric = numeric_columns[0] if numeric_columns else "no numeric metric"
    leading_dimension = categorical_columns[0] if categorical_columns else "no categorical dimension"
    warning_count = len(metadata.get("warnings") or [])
    warning_text = f" {warning_count} recoverable data warning(s) were captured." if warning_count else ""
    return _truncate(
        f"Analyzed {metadata.get('row_count', 0)} rows for '{request}'. "
        f"The canvas identified {len(numeric_columns)} numeric and {len(categorical_columns)} categorical columns; "
        f"the primary view compares {leading_metric} by {leading_dimension} with {len(chart_specs)} chart spec(s)."
        f"{warning_text}",
    )


def _insight_summary(
    request: str,
    metadata: DatasetMetadata,
    profiles: list[ParsedColumn],
    chart_specs: list[ChartSpec],
) -> str:
    fallback = _fallback_summary(request, metadata, profiles, chart_specs)
    prompt = (
        f"Request: {request}\n"
        f"Rows: {metadata.get('row_count', 0)}\n"
        f"Numeric columns: {metadata.get('numeric_columns', [])}\n"
        f"Categorical columns: {metadata.get('categorical_columns', [])}\n"
        f"Charts: {[chart.get('title') for chart in chart_specs]}\n"
        "Write one short insight summary for a sandboxed data-analysis canvas."
    )
    try:
        response = create_llm("fast").invoke(
            [
                SystemMessage(content="Write one concise, factual data-analysis insight summary."),
                HumanMessage(content=prompt),
            ]
        )
        summary = _truncate(_extract_text(response.content), 360)
    except Exception:
        summary = ""
    return summary or fallback


def retry_analysis(state: ChatDataAnalysisCanvasState) -> dict:
    start = _emit(_event("retry", "running", "Preparing deterministic retry with recoverable errors cleared.", 0.08))
    previous_errors = list(state.get("execution_errors") or [])
    retained_errors = [error for error in previous_errors if not bool(error.get("recoverable", True))]
    retry_count = int(state.get("retry_count") or 0) + 1
    cleared = len(previous_errors) - len(retained_errors)
    logs = list(state.get("sandbox_logs") or [])
    logs.append(f"Retry {retry_count} requested from chat action.")
    logs.append(f"Cleared {cleared} recoverable error(s) before re-running the memory-only sandbox.")
    done = _emit(_event("retry", "completed", f"Retry {retry_count} queued.", 0.18))
    return {
        "action": "retry",
        "retry_count": retry_count,
        "execution_status": "retrying",
        "execution_errors": retained_errors,
        "sandbox_logs": logs,
        "analysis_steps": _base_steps(),
        "final": "Retry queued; analysis will rerun with deterministic CSV repair enabled.",
        "final_status": "running",
        "analysis_events": [start, done],
    }


def parse_dataset(state: ChatDataAnalysisCanvasState) -> dict:
    request = _normalize_request(state.get("user_request"))
    retry_count = int(state.get("retry_count") or 0)
    repair = str(state.get("action") or "").strip().lower() == "retry" or retry_count > 0
    start = _emit(_event("parse", "running", "Parsing CSV text in memory.", 0.22))
    csv_text, rows, columns, parse_errors, parse_logs, source = _parse_csv_text(state.get("csv_text"), repair=repair)
    profiles = _profile_columns(rows, columns)
    delimiter = _detect_delimiter(csv_text)
    retained_errors = [
        error for error in list(state.get("execution_errors") or [])
        if not bool(error.get("recoverable", True))
    ]
    errors = retained_errors + parse_errors
    metadata = _metadata(rows, columns, profiles, delimiter, source, errors)
    steps = _complete_step(_base_steps(), "load_csv", f"Loaded {len(rows)} data rows from {source} CSV.")
    steps = _complete_step(steps, "profile_columns", f"Profiled {len(columns)} columns.")
    logs = parse_logs + [
        f"Parsed {len(rows)} row(s) and {len(columns)} column(s).",
        "Column inference completed without executing user-provided code.",
    ]
    if repair:
        logs.append("Retry mode enabled row-width repair for recoverable CSV shape issues.")
    done = _emit(_event("parse", "completed", f"Parsed {len(rows)} rows and {len(columns)} columns.", 0.42))
    return {
        "action": "retry" if repair else "analyze",
        "user_request": request,
        "csv_text": csv_text,
        "dataset_metadata": metadata,
        "parsed_columns": profiles,
        "parsed_rows": rows,
        "preview_rows": rows[:6],
        "analysis_steps": steps,
        "execution_status": "parsing",
        "retry_count": retry_count,
        "sandbox_logs": logs if not repair else list(state.get("sandbox_logs") or []) + logs,
        "execution_errors": errors,
        "final": "Dataset parsed; sandbox analysis is ready to run.",
        "final_status": "running",
        "analysis_events": [start, done],
    }


def run_sandbox_analysis(state: ChatDataAnalysisCanvasState) -> dict:
    start = _emit(_event("sandbox", "running", "Running deterministic sandbox analysis.", 0.58))
    request = _normalize_request(state.get("user_request"))
    metadata = dict(state.get("dataset_metadata") or {})
    profiles = list(state.get("parsed_columns") or [])
    rows = list(state.get("parsed_rows") or [])
    code = _generated_code(request, metadata, profiles)
    charts = _chart_specs(rows, metadata)
    table = _result_table(profiles, metadata)
    errors = list(state.get("execution_errors") or [])
    status: ExecutionStatus = "completed_with_warnings" if errors else "completed"
    steps = list(state.get("analysis_steps") or _base_steps())
    steps = _complete_step(steps, "generate_code", "Generated reviewable sandbox plan text.")
    steps = _complete_step(steps, "run_sandbox", f"Computed {len(table.get('rows') or [])} table rows and {len(charts)} chart spec(s).")
    logs = list(state.get("sandbox_logs") or [])
    logs.extend(
        [
            "Generated code was stored as an artifact string only.",
            "Executed fixed in-memory aggregation helpers; no eval, exec, subprocess, or filesystem writes used.",
            f"Prepared {len(charts)} chart spec(s) and a {len(table.get('rows') or [])}-row result table.",
        ]
    )
    done = _emit(_event("sandbox", "completed", "Sandbox outputs are ready for the canvas.", 0.78))
    return {
        "generated_code": code,
        "chart_specs": charts,
        "result_table": table,
        "analysis_steps": steps,
        "execution_status": status,
        "sandbox_logs": logs,
        "execution_errors": errors,
        "final": "Sandbox analysis completed; preparing insight summary.",
        "final_status": "running",
        "analysis_events": [start, done],
    }


def summarize_insights(state: ChatDataAnalysisCanvasState) -> dict:
    start = _emit(_event("summarize", "running", "Preparing insight summary.", 0.86))
    request = _normalize_request(state.get("user_request"))
    metadata = dict(state.get("dataset_metadata") or {})
    profiles = list(state.get("parsed_columns") or [])
    charts = list(state.get("chart_specs") or [])
    summary = _insight_summary(request, metadata, profiles, charts)
    steps = _complete_step(list(state.get("analysis_steps") or _base_steps()), "summarize", "Insight summary prepared.")
    retry_mode = str(state.get("action") or "").strip().lower() == "retry"
    status: FinalStatus = "retried" if retry_mode else "analyzed"
    final = (
        f"{summary} Retry count is {int(state.get('retry_count') or 0)}."
        if retry_mode
        else summary
    )
    done = _emit(_event("summarize", "completed", "Insight summary ready.", 0.96))
    return {
        "insight_summary": summary,
        "analysis_steps": steps,
        "final": final,
        "final_status": status,
        "analysis_events": [start, done],
    }


def finalize(state: ChatDataAnalysisCanvasState) -> dict:
    status = str(state.get("final_status") or "idle")
    done = _emit(_event("final", "completed", f"Data analysis canvas run completed with status={status}.", 1.0))
    return {
        "final": str(state.get("final") or "Data analysis canvas workflow completed."),
        "final_status": status,
        "analysis_events": [done],
    }


def route_action(state: ChatDataAnalysisCanvasState) -> str:
    action = str(state.get("action") or "analyze").strip().lower()
    if action == "retry":
        return "retry_analysis"
    return "parse_dataset"


builder = StateGraph(ChatDataAnalysisCanvasState)
builder.add_node("retry_analysis", retry_analysis)
builder.add_node("parse_dataset", parse_dataset)
builder.add_node("run_sandbox_analysis", run_sandbox_analysis)
builder.add_node("summarize_insights", summarize_insights)
builder.add_node("finalize", finalize)
builder.add_conditional_edges(
    START,
    route_action,
    {
        "retry_analysis": "retry_analysis",
        "parse_dataset": "parse_dataset",
    },
)
builder.add_edge("retry_analysis", "parse_dataset")
builder.add_edge("parse_dataset", "run_sandbox_analysis")
builder.add_edge("run_sandbox_analysis", "summarize_insights")
builder.add_edge("summarize_insights", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile()
