from __future__ import annotations

import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_16_resource_aware_optimization.prompts import (
    FAST_ANSWER_SYSTEM_PROMPT,
    GROUNDED_ANSWER_SYSTEM_PROMPT,
    REASONING_ANSWER_SYSTEM_PROMPT,
)
from agentic_design_patterns.patterns.chapter_16_resource_aware_optimization.state import (
    ResourceAwareOptimizationState,
    ResourcePath,
    ResourceTraceEvent,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_LIMITS: dict[str, Any] = {
    "cost_usd": 0.02,
    "tokens": 4000,
    "tool_calls": 1,
    "time_ms": 4000,
    "quality_target": "standard",
}
PATH_COSTS: dict[str, dict[str, Any]] = {
    "fast": {
        "id": "fast",
        "model_tier": "fast",
        "model": "fast-shared-chat-model",
        "tools": [],
        "estimated_cost_usd": 0.001,
        "tokens": 350,
        "time_ms": 450,
        "tool_calls": 0,
        "expected_quality": 0.72,
    },
    "reasoning": {
        "id": "reasoning",
        "model_tier": "reasoning",
        "model": "reasoning-shared-chat-model",
        "tools": [],
        "estimated_cost_usd": 0.012,
        "tokens": 1400,
        "time_ms": 1800,
        "tool_calls": 0,
        "expected_quality": 0.88,
    },
    "grounded_search": {
        "id": "grounded_search",
        "model_tier": "grounded",
        "model": "grounded-shared-chat-model",
        "tools": ["search"],
        "estimated_cost_usd": 0.018,
        "tokens": 1800,
        "time_ms": 2600,
        "tool_calls": 1,
        "expected_quality": 0.9,
    },
    "fallback": {
        "id": "fallback",
        "model_tier": "fallback",
        "model": "fallback-shared-chat-model",
        "tools": [],
        "estimated_cost_usd": 0.0005,
        "tokens": 220,
        "time_ms": 300,
        "tool_calls": 0,
        "expected_quality": 0.45,
    },
}
REASONING_TERMS = {
    "analyze",
    "compare",
    "evaluate",
    "scenario",
    "trade-off",
    "tradeoff",
    "risk",
    "strategy",
    "multi-step",
    "why",
}
FRESHNESS_TERMS = {
    "current",
    "latest",
    "today",
    "now",
    "2026",
    "recent",
    "start",
    "schedule",
    "price",
    "weather",
}
MAX_CONTEXT_CHARS = 900


def preprocess_input(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    raw_input = "" if state.get("input") is None else str(state.get("input", ""))
    normalized_input = _normalize(raw_input)
    errors: list[str] = []
    trace: list[ResourceTraceEvent] = []

    limits = dict(DEFAULT_LIMITS)
    supplied_limits = state.get("resource_limits", {})
    if isinstance(supplied_limits, dict):
        limits.update(supplied_limits)
    elif supplied_limits:
        errors.append("Malformed resource_limits replaced with safe defaults.")

    limits["cost_usd"] = _non_negative_float(limits.get("cost_usd"), DEFAULT_LIMITS["cost_usd"])
    limits["tokens"] = _non_negative_float(limits.get("tokens"), DEFAULT_LIMITS["tokens"])
    limits["tool_calls"] = _non_negative_float(limits.get("tool_calls"), DEFAULT_LIMITS["tool_calls"])
    limits["time_ms"] = _non_negative_float(limits.get("time_ms"), DEFAULT_LIMITS["time_ms"])
    quality_target = str(limits.get("quality_target") or DEFAULT_LIMITS["quality_target"])
    allowed = state.get("allowed_capabilities")
    if not isinstance(allowed, list) or not allowed:
        allowed = ["fast_model", "reasoning_model", "search", "fallback", "critique"]

    status = "answered"
    if not normalized_input:
        status = "failed"
        errors.append("Input is empty.")
        trace.append(_trace("preprocess_input", "failed", "Input is empty."))
    else:
        trace.append(
            _trace(
                "preprocess_input",
                "initialized",
                "Initialized safe resource budgets.",
                {"allowed_capabilities": allowed, "limits": _public_limits(limits)},
            )
        )

    return {
        "input": normalized_input,
        "resource_limits": limits,
        "resource_budget": {
            "cost_usd": limits["cost_usd"],
            "tokens": limits["tokens"],
            "tool_calls": limits["tool_calls"],
            "time_ms": limits["time_ms"],
        },
        "resource_usage": {
            "estimated_cost_usd": 0.0,
            "tokens": 0.0,
            "tool_calls": 0.0,
            "time_ms": 0.0,
        },
        "deadline_ms": _optional_int(state.get("deadline_ms") or limits.get("time_ms")),
        "allowed_capabilities": allowed,
        "quality_target": quality_target,
        "candidate_paths": [],
        "selected_path": None,
        "selected_model": None,
        "model_tier": None,
        "selected_tools": [],
        "search_results": [],
        "model_response": None,
        "quality_score": None,
        "critique": None,
        "routing_feedback": None,
        "fallback_chain": list(state.get("fallback_chain", ["fallback"])),
        "fallback_used": False,
        "degradation_reason": None,
        "errors": errors,
        "routing_trace": trace,
        "final_output": None,
        "retry_count": int(state.get("retry_count", 0) or 0),
        "max_retries": int(state.get("max_retries", 1) or 1),
        "status": status,
    }


def prepare_context(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    context = state.get("context", [])
    if not isinstance(context, list):
        context = []
    text_parts = [
        _normalize(item.get("text") or item.get("content") or item.get("body") or "")
        for item in context
        if isinstance(item, dict)
    ]
    full_context = "\n".join(part for part in text_parts if part)
    trace = list(state.get("routing_trace", []))
    selected_tools = list(state.get("selected_tools", []))
    if len(full_context) <= MAX_CONTEXT_CHARS:
        compressed = full_context or None
        trace.append(_trace("prepare_context", "kept", "Context fits budget."))
    else:
        compressed = full_context[:MAX_CONTEXT_CHARS].rsplit(" ", 1)[0].rstrip()
        selected_tools.append("summarizer")
        trace.append(
            _trace(
                "prepare_context",
                "compressed",
                "Compressed oversized context for token control.",
                {"original_chars": len(full_context), "compressed_chars": len(compressed)},
            )
        )
    return {
        "context": context,
        "compressed_context": compressed,
        "selected_tools": selected_tools,
        "routing_trace": trace,
    }


def classify_request(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    query = state.get("input", "").lower()
    trace = list(state.get("routing_trace", []))
    if any(term in query for term in FRESHNESS_TERMS):
        classification = "current_info"
        complexity = 0.68
        freshness_required = True
    elif any(term in query for term in REASONING_TERMS) or query.count("?") > 1:
        classification = "reasoning"
        complexity = 0.76
        freshness_required = False
    elif "unsupported" in query or "build a production trading bot" in query:
        classification = "unsupported"
        complexity = 0.95
        freshness_required = False
    else:
        classification = "simple"
        complexity = 0.25
        freshness_required = False
    trace.append(
        _trace(
            "classify_request",
            "classified",
            f"Request classified as {classification}.",
            {"complexity_score": complexity, "freshness_required": freshness_required},
        )
    )
    return {
        "classification": classification,
        "complexity_score": complexity,
        "freshness_required": freshness_required,
        "routing_trace": trace,
    }


def estimate_resource_needs(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    allowed = set(state.get("allowed_capabilities", []))
    candidates = []
    for path_id, base in PATH_COSTS.items():
        path: ResourcePath = dict(base)
        path["available"] = _capability_available(path, allowed)
        if state.get("quality_target") == "high":
            path["expected_quality"] = float(path["expected_quality"]) - 0.05
        candidates.append(path)
    trace = [
        *state.get("routing_trace", []),
        _trace(
            "estimate_resource_needs",
            "estimated",
            "Estimated candidate resource paths.",
            {"candidate_ids": [candidate["id"] for candidate in candidates]},
        ),
    ]
    return {"candidate_paths": candidates, "routing_trace": trace}


def select_execution_path(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    classification = state.get("classification")
    budget = state.get("resource_budget", {})
    candidates = state.get("candidate_paths", [])
    trace = list(state.get("routing_trace", []))
    errors = list(state.get("errors", []))
    degradation_reason = state.get("degradation_reason")
    desired_ids = _desired_path_ids(classification)
    selected = None
    for path_id in desired_ids:
        path = _path_by_id(candidates, path_id)
        if not path:
            continue
        if not path.get("available", True):
            continue
        if _path_fits_budget(path, budget):
            selected = path
            break

    if selected is None and classification == "current_info":
        degradation_reason = "Search is disabled or over budget; current facts will not be invented."
        selected = _budgeted_fallback(candidates, budget)
    elif selected is None:
        selected = _budgeted_fallback(candidates, budget)

    if selected is None:
        status = "budget_exhausted"
        errors.append("No execution path fits the remaining resource budget.")
        trace.append(
            _trace(
                "select_execution_path",
                "budget_exhausted",
                "No acceptable path fits the budget.",
            )
        )
        return {
            "selected_path": None,
            "status": status,
            "errors": errors,
            "degradation_reason": degradation_reason,
            "routing_trace": trace,
        }

    trace.append(
        _trace(
            "select_execution_path",
            "selected",
            f"Selected {selected['id']} path.",
            {"classification": classification, "path": _path_summary(selected)},
        )
    )
    return {
        "selected_path": selected,
        "selected_model": selected.get("model"),
        "model_tier": selected.get("model_tier"),
        "selected_tools": _merge_tools(
            state.get("selected_tools", []),
            list(selected.get("tools", [])),
        ),
        "degradation_reason": degradation_reason,
        "status": "answered",
        "routing_trace": trace,
    }


def run_fast_model(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    return _run_model_path(state, FAST_ANSWER_SYSTEM_PROMPT, "run_fast_model")


def run_reasoning_model(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    return _run_model_path(state, REASONING_ANSWER_SYSTEM_PROMPT, "run_reasoning_model")


def run_search_tool(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    trace = list(state.get("routing_trace", []))
    errors = list(state.get("errors", []))
    try:
        search_tool = state.get("search_tool") or default_search_tool
        results = search_tool(state.get("input", ""))
        if not results:
            raise RuntimeError("Search returned no results.")
    except Exception as exc:
        errors.append(f"Search failed: {exc}")
        trace.append(_trace("run_search_tool", "failed", str(exc)))
        return {"errors": errors, "status": "failed", "routing_trace": trace}

    selected_path = state.get("selected_path") or PATH_COSTS["grounded_search"]
    usage, budget = _spend(state, selected_path, tool_only=True)
    trace.append(
        _trace(
            "run_search_tool",
            "searched",
            "Retrieved current-information evidence.",
            {"result_count": len(results)},
        )
    )
    return {
        "search_results": results,
        "resource_usage": usage,
        "resource_budget": budget,
        "routing_trace": trace,
    }


def run_grounded_model(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    evidence = "\n".join(
        f"- {item.get('title', 'Result')}: {item.get('snippet', '')}"
        for item in state.get("search_results", [])
    )
    prompt = f"Question: {state.get('input', '')}\nSearch results:\n{evidence}"
    return _run_model_path(state, GROUNDED_ANSWER_SYSTEM_PROMPT, "run_grounded_model", prompt)


def handle_execution_failure(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    trace = list(state.get("routing_trace", []))
    trace.append(
        _trace(
            "handle_execution_failure",
            "fallback_decision",
            "Primary execution failed; attempting bounded fallback.",
            {"fallback_chain": list(state.get("fallback_chain", []))},
        )
    )
    return {"routing_trace": trace}


def run_fallback_path(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    chain = list(state.get("fallback_chain", []))
    trace = list(state.get("routing_trace", []))
    errors = list(state.get("errors", []))
    budget = state.get("resource_budget", {})
    if not chain:
        errors.append("Fallback chain exhausted.")
        return {
            "status": "fallback_exhausted",
            "errors": errors,
            "fallback_used": True,
            "model_response": None,
            "degradation_reason": state.get("degradation_reason") or "No fallback path remains.",
            "routing_trace": [
                *trace,
                _trace("run_fallback_path", "exhausted", "Fallback chain exhausted."),
            ],
        }

    chain.pop(0)
    fallback = dict(PATH_COSTS["fallback"])
    if not _path_fits_budget(fallback, budget):
        errors.append("Fallback path does not fit remaining budget.")
        return {
            "status": "budget_exhausted",
            "errors": errors,
            "fallback_chain": chain,
            "fallback_used": True,
            "degradation_reason": state.get("degradation_reason") or "Fallback was over budget.",
            "routing_trace": [
                *trace,
                _trace("run_fallback_path", "over_budget", "Fallback path was over budget."),
            ],
        }

    if state.get("freshness_required"):
        response = (
            "I cannot verify current information within the available resources. "
            "Use a search-enabled path for a reliable answer."
        )
        usage, new_budget = _spend(state, fallback)
    else:
        try:
            model = get_chat_model()
            response = _content(
                model.invoke(
                    [
                        SystemMessage(content=FAST_ANSWER_SYSTEM_PROMPT),
                        HumanMessage(content=state.get("input", "")),
                    ]
                )
            )
            usage, new_budget = _spend(state, fallback)
        except Exception as exc:
            errors.append(f"Fallback model failed: {exc}")
            response = "No fallback answer is available."
            usage, new_budget = state.get("resource_usage", {}), state.get("resource_budget", {})

    trace.append(_trace("run_fallback_path", "used", "Fallback path produced a degraded answer."))
    return {
        "selected_path": fallback,
        "selected_model": fallback["model"],
        "model_tier": fallback["model_tier"],
        "selected_tools": [],
        "model_response": response,
        "resource_usage": usage,
        "resource_budget": new_budget,
        "fallback_chain": chain,
        "fallback_used": True,
        "degradation_reason": state.get("degradation_reason") or "Fallback path used.",
        "status": "degraded",
        "errors": errors,
        "routing_trace": trace,
    }


def critique_response(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    if "critique" not in state.get("allowed_capabilities", []):
        return {
            "quality_score": None,
            "critique": None,
            "routing_feedback": {"route_was_appropriate": True, "reason": "Critique disabled."},
        }
    response = state.get("model_response") or ""
    if not response:
        score = 0.0
        reason = "No model response to critique."
    elif state.get("degradation_reason"):
        score = 0.55
        reason = state["degradation_reason"]
    elif len(response) < 20:
        score = 0.45
        reason = "Response is too short for the requested quality."
    else:
        score = 0.9
        reason = "Response satisfies the selected resource route."
    trace = [
        *state.get("routing_trace", []),
        _trace("critique_response", "scored", "Critiqued response quality.", {"quality_score": score}),
    ]
    return {
        "quality_score": score,
        "critique": {"score": score, "reason": reason},
        "routing_feedback": {
            "route_was_appropriate": score >= 0.7,
            "reason": reason,
        },
        "routing_trace": trace,
    }


def maybe_upgrade_or_retry(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    score = state.get("quality_score")
    retry_count = int(state.get("retry_count", 0) or 0)
    trace = list(state.get("routing_trace", []))
    if (
        score is not None
        and score < 0.7
        and retry_count < int(state.get("max_retries", 1) or 1)
        and state.get("classification") == "simple"
        and not state.get("fallback_used")
        and not state.get("degradation_reason")
        and "reasoning_model" in state.get("allowed_capabilities", [])
        and _path_fits_budget(PATH_COSTS["reasoning"], state.get("resource_budget", {}))
    ):
        trace.append(_trace("maybe_upgrade_or_retry", "upgrade", "Upgrading once after low critique."))
        return {
            "classification": "reasoning",
            "retry_count": retry_count + 1,
            "model_response": None,
            "routing_trace": trace,
        }
    trace.append(_trace("maybe_upgrade_or_retry", "finalize", "No retry or upgrade selected."))
    return {"routing_trace": trace}


def record_resource_observation(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    trace = [
        *state.get("routing_trace", []),
        _trace(
            "record_resource_observation",
            "recorded",
            "Recorded resource usage and routing quality.",
            {
                "usage": state.get("resource_usage", {}),
                "quality_score": state.get("quality_score"),
                "fallback_used": state.get("fallback_used", False),
            },
        ),
    ]
    return {"routing_trace": trace}


def finalize(state: ResourceAwareOptimizationState) -> dict[str, Any]:
    status = state.get("status")
    if status == "failed" and not state.get("model_response"):
        final_status = "failed"
    elif status in {"budget_exhausted", "fallback_exhausted"}:
        final_status = status
    elif state.get("degradation_reason") or state.get("fallback_used"):
        final_status = "degraded"
    elif state.get("classification") == "unsupported":
        final_status = "unsupported"
    else:
        final_status = "answered"

    answer = state.get("model_response")
    if not answer:
        if final_status == "budget_exhausted":
            answer = "No answer was produced because the request exceeded the resource budget."
        elif final_status == "failed":
            answer = "The request could not be processed."
        else:
            answer = "No answer is available under the selected resource constraints."

    final_output = {
        "status": final_status,
        "answer": answer,
        "classification": state.get("classification"),
        "selected_path": _path_summary(state.get("selected_path")),
        "resource_usage": state.get("resource_usage", {}),
        "fallback_used": state.get("fallback_used", False),
        "degraded": final_status == "degraded",
        "degradation_reason": state.get("degradation_reason"),
        "quality_score": state.get("quality_score"),
        "routing_feedback": state.get("routing_feedback"),
        "errors": state.get("errors", []),
    }
    return {"final_output": final_output, "status": final_status}


def default_search_tool(query: str) -> list[dict[str, Any]]:
    return [
        {
            "title": "Fixture current-information result",
            "url": "https://example.test/current",
            "snippet": f"Deterministic fixture result for: {query}",
        }
    ]


def _run_model_path(
    state: ResourceAwareOptimizationState,
    system_prompt: str,
    node_name: str,
    user_prompt: str | None = None,
) -> dict[str, Any]:
    trace = list(state.get("routing_trace", []))
    errors = list(state.get("errors", []))
    try:
        model = get_chat_model()
        response = _content(
            model.invoke(
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt or _model_prompt(state)),
                ]
            )
        )
    except Exception as exc:
        errors.append(f"{node_name} failed: {exc}")
        trace.append(_trace(node_name, "failed", str(exc)))
        return {"errors": errors, "status": "failed", "routing_trace": trace}

    selected_path = state.get("selected_path") or PATH_COSTS["fast"]
    usage, budget = _spend(state, selected_path)
    trace.append(_trace(node_name, "completed", f"{node_name} completed."))
    return {
        "model_response": response,
        "resource_usage": usage,
        "resource_budget": budget,
        "status": "answered",
        "routing_trace": trace,
    }


def _model_prompt(state: ResourceAwareOptimizationState) -> str:
    context = state.get("compressed_context")
    if context:
        return f"Question: {state.get('input', '')}\nContext:\n{context}"
    return state.get("input", "")


def _spend(
    state: ResourceAwareOptimizationState,
    path: ResourcePath,
    *,
    tool_only: bool = False,
) -> tuple[dict[str, float], dict[str, float]]:
    usage = dict(state.get("resource_usage", {}))
    budget = dict(state.get("resource_budget", {}))
    cost = 0.0 if tool_only else float(path.get("estimated_cost_usd", 0.0))
    tokens = 0.0 if tool_only else float(path.get("tokens", 0.0))
    tool_calls = float(path.get("tool_calls", 0.0)) if tool_only else 0.0
    time_ms = float(path.get("time_ms", 0.0)) * (0.35 if tool_only else 1.0)
    usage["estimated_cost_usd"] = round(float(usage.get("estimated_cost_usd", 0.0)) + cost, 6)
    usage["tokens"] = float(usage.get("tokens", 0.0)) + tokens
    usage["tool_calls"] = float(usage.get("tool_calls", 0.0)) + tool_calls
    usage["time_ms"] = float(usage.get("time_ms", 0.0)) + time_ms
    budget["cost_usd"] = max(0.0, round(float(budget.get("cost_usd", 0.0)) - cost, 6))
    budget["tokens"] = max(0.0, float(budget.get("tokens", 0.0)) - tokens)
    budget["tool_calls"] = max(0.0, float(budget.get("tool_calls", 0.0)) - tool_calls)
    budget["time_ms"] = max(0.0, float(budget.get("time_ms", 0.0)) - time_ms)
    return usage, budget


def _desired_path_ids(classification: str | None) -> list[str]:
    if classification == "current_info":
        return ["grounded_search"]
    if classification == "reasoning":
        return ["reasoning"]
    if classification == "unsupported":
        return []
    return ["fast"]


def _budgeted_fallback(candidates: list[ResourcePath], budget: dict[str, float]) -> ResourcePath | None:
    fallback = _path_by_id(candidates, "fallback")
    if fallback and fallback.get("available", True) and _path_fits_budget(fallback, budget):
        return fallback
    return None


def _path_by_id(candidates: list[ResourcePath], path_id: str) -> ResourcePath | None:
    for candidate in candidates:
        if candidate.get("id") == path_id:
            return candidate
    return None


def _capability_available(path: ResourcePath, allowed: set[str]) -> bool:
    tier = path.get("model_tier")
    if tier == "fast":
        return "fast_model" in allowed
    if tier == "reasoning":
        return "reasoning_model" in allowed
    if tier == "grounded":
        return "search" in allowed and "reasoning_model" in allowed
    if tier == "fallback":
        return "fallback" in allowed
    return False


def _path_fits_budget(path: ResourcePath, budget: dict[str, float]) -> bool:
    return (
        float(path.get("estimated_cost_usd", 0.0)) <= float(budget.get("cost_usd", 0.0))
        and float(path.get("tokens", 0.0)) <= float(budget.get("tokens", 0.0))
        and float(path.get("tool_calls", 0.0)) <= float(budget.get("tool_calls", 0.0))
        and float(path.get("time_ms", 0.0)) <= float(budget.get("time_ms", 0.0))
    )


def _path_summary(path: ResourcePath | dict[str, Any] | None) -> dict[str, Any] | None:
    if not path:
        return None
    return {
        "id": path.get("id"),
        "model_tier": path.get("model_tier"),
        "model": path.get("model"),
        "tools": list(path.get("tools", [])),
    }


def _merge_tools(existing: list[str], selected: list[str]) -> list[str]:
    merged: list[str] = []
    for tool in [*existing, *selected]:
        if tool not in merged:
            merged.append(tool)
    return merged


def _trace(
    step: str,
    event: str,
    detail: str,
    metadata: dict[str, Any] | None = None,
) -> ResourceTraceEvent:
    return {
        "step": step,
        "event": event,
        "detail": detail,
        "metadata": metadata or {},
    }


def _content(message: Any) -> str:
    content = getattr(message, "content", message)
    if isinstance(content, list):
        return "\n".join(str(part) for part in content)
    return str(content)


def _normalize(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _non_negative_float(value: Any, default: float) -> float:
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return float(default)


def _public_limits(limits: dict[str, Any]) -> dict[str, Any]:
    return {
        key: limits[key]
        for key in ("cost_usd", "tokens", "tool_calls", "time_ms", "quality_target")
        if key in limits
    }
