"""Example 20: observable graph metrics for latency, tokens, cost, and trace metadata."""

from __future__ import annotations

import os
import time
from datetime import datetime, UTC
from operator import add
from typing import Annotated, Any, TypedDict
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm, resolve_model


MODEL_ALIAS = "fast"
PRICING_PER_1K: dict[str, dict[str, float]] = {
    "fast": {"input": 0.00015, "output": 0.00060},
    "default": {"input": 0.00015, "output": 0.00060},
    "normal": {"input": 0.00015, "output": 0.00060},
    "smart": {"input": 0.00125, "output": 0.01000},
}


class NodeTiming(TypedDict):
    node: str
    status: str
    started_at: str
    finished_at: str
    elapsed_ms: float
    input_keys: list[str]
    output_keys: list[str]


class TokenMetric(TypedDict, total=False):
    node: str
    model_alias: str
    model_name: str
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    cost_usd: float | None
    usage_available: bool


class CostSummary(TypedDict, total=False):
    total_input_tokens: int | None
    total_output_tokens: int | None
    total_tokens: int | None
    total_cost_usd: float | None
    pricing_note: str


class TraceLinks(TypedDict, total=False):
    tracing_enabled: bool
    langsmith_project: str
    langsmith_url: str
    note: str


class ObservabilityEvent(TypedDict):
    type: str
    phase: str
    status: str
    detail: str
    node: str
    elapsed_ms: float


class ObservabilityState(TypedDict, total=False):
    query: str
    run_id: str
    run_label: str
    run_started_at: str
    run_finished_at: str
    retrieved_context: str
    answer: str
    final: str
    node_timings: Annotated[list[NodeTiming], add]
    token_metrics: Annotated[list[TokenMetric], add]
    cost_summary: CostSummary
    trace_links: TraceLinks
    run_metadata: dict[str, Any]
    observability_events: Annotated[list[ObservabilityEvent], add]


DEFAULT_QUERY = "Use observability metrics to explain why a LangGraph SDK demo run is slow."


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


def _writer():
    try:
        return get_stream_writer()
    except RuntimeError:
        return lambda _event: None


def _event(node: str, phase: str, status: str, detail: str, elapsed_ms: float = 0.0) -> ObservabilityEvent:
    return {
        "type": "observability_status",
        "phase": phase,
        "status": status,
        "detail": detail,
        "node": node,
        "elapsed_ms": elapsed_ms,
    }


def _timing(
    node: str,
    start: float,
    started_at: str,
    state: ObservabilityState,
    output: dict[str, Any],
    status: str = "succeeded",
) -> NodeTiming:
    return {
        "node": node,
        "status": status,
        "started_at": started_at,
        "finished_at": _now(),
        "elapsed_ms": round((time.perf_counter() - start) * 1000, 2),
        "input_keys": sorted(state.keys()),
        "output_keys": sorted(output.keys()),
    }


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


def _usage_value(usage: dict[str, Any], *keys: str) -> int | None:
    for key in keys:
        value = usage.get(key)
        if isinstance(value, int):
            return value
    return None


def _estimate_cost(model_alias: str, input_tokens: int | None, output_tokens: int | None) -> float | None:
    if input_tokens is None or output_tokens is None:
        return None
    pricing = PRICING_PER_1K.get(model_alias, PRICING_PER_1K["default"])
    return round((input_tokens / 1000.0) * pricing["input"] + (output_tokens / 1000.0) * pricing["output"], 8)


def _trace_links(run_id: str) -> TraceLinks:
    tracing_value = os.environ.get("LANGCHAIN_TRACING_V2") or os.environ.get("LANGSMITH_TRACING")
    enabled = str(tracing_value).lower() in {"1", "true", "yes"}
    project = os.environ.get("LANGCHAIN_PROJECT") or os.environ.get("LANGSMITH_PROJECT", "")
    if enabled and project:
        return {
            "tracing_enabled": True,
            "langsmith_project": project,
            "langsmith_url": f"https://smith.langchain.com/o/default/projects/p/{project}?q={run_id}",
            "note": "LangSmith tracing environment is enabled; use the project link to inspect run traces.",
        }
    return {
        "tracing_enabled": False,
        "langsmith_project": project,
        "langsmith_url": "",
        "note": "LangSmith trace link is unavailable because tracing env vars are not fully configured.",
    }


def prepare_run(state: ObservabilityState) -> dict:
    node = "prepare_run"
    start = time.perf_counter()
    started_at = _now()
    run_id = f"obs-{uuid4().hex[:12]}"
    query = state.get("query", DEFAULT_QUERY).strip() or DEFAULT_QUERY
    output: dict[str, Any] = {
        "query": query,
        "run_id": run_id,
        "run_label": state.get("run_label", "observable-sdk-run"),
        "run_started_at": started_at,
        "run_metadata": {
            "run_id": run_id,
            "graph_id": "observability",
            "provider": "OpenAI",
            "model_alias": MODEL_ALIAS,
            "model_name": resolve_model(MODEL_ALIAS),
            "query_length": len(query),
            "environment": "local-dev",
        },
        "trace_links": _trace_links(run_id),
    }
    timing = _timing(node, start, started_at, state, output)
    event = _event(node, "prepare", "succeeded", "Run metadata prepared.", timing["elapsed_ms"])
    _writer()(event)
    return {**output, "node_timings": [timing], "observability_events": [event]}


def collect_context(state: ObservabilityState) -> dict:
    node = "collect_context"
    start = time.perf_counter()
    started_at = _now()
    query = state.get("query", DEFAULT_QUERY)
    if any(term in query.lower() for term in ("time", "latency", "slow", "metric", "observability")):
        context = (
            "Local diagnostic context: compare node elapsed time, token usage, and cost estimate. "
            "Treat missing provider usage as unknown instead of zero."
        )
    else:
        context = (
            "Local diagnostic context: summarize the request, inspect run metadata, and expose raw "
            "stream events for debugging."
        )
    time.sleep(0.025)
    output = {"retrieved_context": context}
    timing = _timing(node, start, started_at, state, output)
    event = _event(node, "context", "succeeded", "Diagnostic context collected.", timing["elapsed_ms"])
    _writer()(event)
    return {**output, "node_timings": [timing], "observability_events": [event]}


def call_model(state: ObservabilityState) -> dict:
    node = "call_model"
    start = time.perf_counter()
    started_at = _now()
    event = _event(node, "llm", "running", "OpenAI call started.")
    _writer()(event)

    response = create_llm(MODEL_ALIAS).invoke(
        [
            SystemMessage(
                content=(
                    "You are an observability assistant. Give a concise answer and mention "
                    "latency, tokens, or cost signals when relevant."
                )
            ),
            HumanMessage(
                content=(
                    f"QUERY:\n{state.get('query', DEFAULT_QUERY)}\n\n"
                    f"DIAGNOSTIC CONTEXT:\n{state.get('retrieved_context', '')}"
                )
            ),
        ]
    )
    answer = _extract_text(response.content).strip()
    usage = getattr(response, "usage_metadata", None) or {}
    input_tokens = _usage_value(usage, "input_tokens", "prompt_tokens")
    output_tokens = _usage_value(usage, "output_tokens", "completion_tokens")
    total_tokens = _usage_value(usage, "total_tokens")
    if total_tokens is None and input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens
    cost = _estimate_cost(MODEL_ALIAS, input_tokens, output_tokens)
    metric: TokenMetric = {
        "node": node,
        "model_alias": MODEL_ALIAS,
        "model_name": resolve_model(MODEL_ALIAS),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "cost_usd": cost,
        "usage_available": input_tokens is not None or output_tokens is not None,
    }
    output = {
        "answer": answer,
        "final": answer,
        "token_metrics": [metric],
    }
    timing = _timing(node, start, started_at, state, output)
    done = _event(node, "llm", "succeeded", "OpenAI response received with usage metadata.", timing["elapsed_ms"])
    _writer()(done)
    return {**output, "node_timings": [timing], "observability_events": [event, done]}


def finalize_metrics(state: ObservabilityState) -> dict:
    node = "finalize_metrics"
    start = time.perf_counter()
    started_at = _now()
    metrics = state.get("token_metrics", [])
    known_input = [item.get("input_tokens") for item in metrics if item.get("input_tokens") is not None]
    known_output = [item.get("output_tokens") for item in metrics if item.get("output_tokens") is not None]
    known_cost = [item.get("cost_usd") for item in metrics if item.get("cost_usd") is not None]
    input_total = sum(known_input) if len(known_input) == len(metrics) and metrics else None
    output_total = sum(known_output) if len(known_output) == len(metrics) and metrics else None
    total_tokens = input_total + output_total if input_total is not None and output_total is not None else None
    cost_total = round(sum(known_cost), 8) if len(known_cost) == len(metrics) and metrics else None
    output: dict[str, Any] = {
        "run_finished_at": _now(),
        "cost_summary": {
            "total_input_tokens": input_total,
            "total_output_tokens": output_total,
            "total_tokens": total_tokens,
            "total_cost_usd": cost_total,
            "pricing_note": "Demo estimate only; missing provider usage is reported as unknown.",
        },
        "run_metadata": {
            **state.get("run_metadata", {}),
            "node_count": len(state.get("node_timings", [])) + 1,
            "llm_call_count": len(metrics),
            "total_elapsed_ms": round(sum(item.get("elapsed_ms", 0.0) for item in state.get("node_timings", [])), 2),
        },
    }
    timing = _timing(node, start, started_at, state, output)
    event = _event(node, "finalize", "succeeded", "Aggregated run metrics.", timing["elapsed_ms"])
    _writer()(event)
    return {**output, "node_timings": [timing], "observability_events": [event]}


def build_graph():
    builder = StateGraph(ObservabilityState)
    builder.add_node("prepare_run", prepare_run)
    builder.add_node("collect_context", collect_context)
    builder.add_node("call_model", call_model)
    builder.add_node("finalize_metrics", finalize_metrics)
    builder.add_edge(START, "prepare_run")
    builder.add_edge("prepare_run", "collect_context")
    builder.add_edge("collect_context", "call_model")
    builder.add_edge("call_model", "finalize_metrics")
    builder.add_edge("finalize_metrics", END)
    return builder.compile()


graph = build_graph()
