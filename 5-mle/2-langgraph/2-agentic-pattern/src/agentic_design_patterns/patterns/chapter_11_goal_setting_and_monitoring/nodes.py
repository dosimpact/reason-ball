from __future__ import annotations

import ast
import json
import re
from collections.abc import Callable
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_11_goal_setting_and_monitoring.prompts import (
    GENERATOR_SYSTEM_PROMPT,
    GENERATOR_USER_PROMPT,
    MONITOR_SYSTEM_PROMPT,
    MONITOR_USER_PROMPT,
    REVISION_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_11_goal_setting_and_monitoring.state import (
    GoalContractItem,
    GoalMonitoringState,
    GoalVerdict,
    ProgressEvent,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_MAX_ITERATIONS = 3
MAX_INPUT_CHARS = 6000
DEFAULT_SCORE_THRESHOLD = 0.8
ALLOWED_VERDICT_STATUSES = {"met", "unmet", "uncertain"}
ALLOWED_OVERALL_STATUSES = {"met", "needs_revision", "needs_review"}
UNSAFE_MODULES = {
    "os",
    "pathlib",
    "requests",
    "httpx",
    "socket",
    "subprocess",
    "sys",
    "urllib",
}
UNSAFE_CALLS = {
    "__import__",
    "eval",
    "exec",
    "input",
    "open",
    "compile",
}
UNSAFE_ATTRIBUTES = {
    "connect",
    "delete",
    "mkdir",
    "open",
    "remove",
    "request",
    "rmdir",
    "run",
    "send",
    "system",
    "unlink",
    "write",
}
HIGH_RISK_TERMS = {
    "api key",
    "bank",
    "billing",
    "credential",
    "delete files",
    "email everyone",
    "execute command",
    "invoice",
    "make network calls",
    "password",
    "payment",
    "production",
    "refund",
    "remove files",
    "secret",
    "subprocess",
    "transfer money",
}
VAGUE_GOAL_PHRASES = {
    "better",
    "best",
    "good",
    "great",
    "high quality",
    "improve",
    "make it good",
    "nice",
    "robust",
}


def prepare_input(state: GoalMonitoringState) -> dict[str, Any]:
    raw_input = "" if state.get("input") is None else str(state.get("input", ""))
    normalized_input = _normalize_text(raw_input)
    errors = list(state.get("errors", []))
    metadata = dict(state.get("metadata", {}))
    metadata.update(
        {
            "pattern": "goal_setting_and_monitoring",
            "example": "goal_monitored_coding_assistant",
        }
    )
    max_iterations = _coerce_positive_int(
        state.get("max_iterations", DEFAULT_MAX_ITERATIONS),
        DEFAULT_MAX_ITERATIONS,
    )

    if len(normalized_input) > MAX_INPUT_CHARS:
        normalized_input = normalized_input[:MAX_INPUT_CHARS].rstrip()
        errors.append(f"Input was truncated to {MAX_INPUT_CHARS} characters.")

    use_case, raw_goals = _extract_task_and_goals(state, normalized_input)
    updates: dict[str, Any] = {
        "input": normalized_input,
        "use_case": use_case,
        "raw_goals": raw_goals,
        "goal_contract": list(state.get("goal_contract", [])),
        "success_criteria": dict(state.get("success_criteria", {})),
        "candidate_artifact": state.get("candidate_artifact"),
        "previous_artifacts": list(state.get("previous_artifacts", [])),
        "check_results": dict(state.get("check_results", {})),
        "monitoring_report": dict(state.get("monitoring_report", {})),
        "goal_status": state.get("goal_status", "needs_revision"),
        "revision_feedback": state.get("revision_feedback"),
        "iteration_count": _coerce_non_negative_int(state.get("iteration_count", 0), 0),
        "max_iterations": max_iterations,
        "needs_human_review": bool(state.get("needs_human_review", False)),
        "errors": errors,
        "status": "ok",
        "metadata": metadata,
        "final_output": None,
    }

    if not normalized_input:
        errors.append("Input is empty.")
        updates.update(
            {
                "status": "failed",
                "goal_status": "failed",
                "needs_human_review": False,
                "revision_feedback": "No input was provided.",
            }
        )
    elif not use_case:
        errors.append("A coding use case is required.")
        updates.update(
            {
                "status": "failed",
                "goal_status": "failed",
                "revision_feedback": "No coding use case was available.",
            }
        )

    updates["progress_history"] = _append_history(
        state,
        "prepare_input",
        {
            "use_case": updates["use_case"],
            "raw_goal_count": len(raw_goals),
            "max_iterations": max_iterations,
            "status": updates["status"],
        },
    )
    return updates


def define_goal_contract(state: GoalMonitoringState) -> dict[str, Any]:
    raw_goals = state.get("raw_goals", [])
    contract = [_goal_contract_item(goal, index) for index, goal in enumerate(raw_goals, 1)]
    required_goal_ids = [
        item["id"] for item in contract if item.get("priority", "required") == "required"
    ]
    success_criteria = {
        "all_required_goals_must_pass": True,
        "required_goal_ids": required_goal_ids,
        "score_threshold": DEFAULT_SCORE_THRESHOLD,
        "max_iterations": state.get("max_iterations", DEFAULT_MAX_ITERATIONS),
        "disallow_unsafe_operations": True,
    }
    return {
        "goal_contract": contract,
        "success_criteria": success_criteria,
        "progress_history": _append_history(
            state,
            "define_goal_contract",
            {
                "goal_ids": [item["id"] for item in contract],
                "required_goal_ids": required_goal_ids,
            },
        ),
    }


def validate_goal_contract(state: GoalMonitoringState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    review_reasons: list[str] = []
    use_case = state.get("use_case", "")
    raw_goals = state.get("raw_goals", [])
    contract = state.get("goal_contract", [])

    if not contract:
        review_reasons.append("At least one measurable goal is required.")

    vague_goals = [goal for goal in raw_goals if _is_vague_goal(goal)]
    if vague_goals:
        review_reasons.append(
            "Goals are too vague to monitor automatically: "
            + ", ".join(vague_goals)
            + "."
        )

    contradiction = _contradiction_reason(raw_goals)
    if contradiction:
        review_reasons.append(contradiction)

    unsafe_reason = _unsafe_task_reason(use_case, raw_goals)
    if unsafe_reason:
        review_reasons.append(unsafe_reason)

    status = "ok"
    goal_status = "needs_revision"
    needs_human_review = False
    revision_feedback = state.get("revision_feedback")
    if review_reasons:
        status = "needs_review"
        goal_status = "needs_review"
        needs_human_review = True
        errors.extend(review_reasons)
        revision_feedback = " ".join(review_reasons)

    return {
        "status": status,
        "goal_status": goal_status,
        "needs_human_review": needs_human_review,
        "revision_feedback": revision_feedback,
        "errors": errors,
        "progress_history": _append_history(
            state,
            "validate_goal_contract",
            {
                "status": status,
                "goal_status": goal_status,
                "review_reasons": review_reasons,
            },
        ),
    }


def generate_candidate(state: GoalMonitoringState) -> dict[str, Any]:
    return _produce_candidate(state, node="generate_candidate", revision=False)


def run_objective_checks(state: GoalMonitoringState) -> dict[str, Any]:
    candidate = state.get("candidate_artifact") or ""
    errors = list(state.get("errors", []))
    base_results = _static_code_checks(candidate)
    checker = state.get("objective_checker")

    if callable(checker):
        try:
            injected = checker(state)
            if not isinstance(injected, dict):
                errors.append("objective_checker must return a dictionary.")
                injected = {}
        except Exception as exc:
            errors.append(f"objective_checker failed: {exc}")
            injected = {
                "passed": False,
                "status": "failed",
                "recoverable": False,
                "errors": [f"objective_checker failed: {exc}"],
            }
        check_results = _merge_check_results(base_results, injected)
    else:
        check_results = base_results

    if check_results.get("unsafe_operations"):
        check_results["passed"] = False
        check_results["status"] = "failed"
        check_results["recoverable"] = False

    return {
        "check_results": check_results,
        "errors": errors,
        "progress_history": _append_history(
            state,
            "run_objective_checks",
            {
                "status": check_results.get("status"),
                "passed": check_results.get("passed"),
                "unsafe_operations": check_results.get("unsafe_operations", []),
            },
        ),
    }


def monitor_candidate(state: GoalMonitoringState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    raw_report: dict[str, Any] | None = None
    monitor = state.get("candidate_monitor")

    if callable(monitor):
        try:
            monitor_result = monitor(state)
            if not isinstance(monitor_result, dict):
                errors.append("candidate_monitor must return a dictionary.")
            else:
                raw_report = monitor_result
        except Exception as exc:
            errors.append(f"candidate_monitor failed: {exc}")
    else:
        try:
            content = _invoke_model(
                MONITOR_SYSTEM_PROMPT,
                MONITOR_USER_PROMPT.format(
                    use_case=state.get("use_case", ""),
                    goal_contract=_json_dumps(state.get("goal_contract", [])),
                    candidate_artifact=state.get("candidate_artifact") or "",
                    check_results=_json_dumps(state.get("check_results", {})),
                ),
            )
            raw_report, parse_errors = _parse_json_object(content)
            errors.extend(parse_errors)
        except Exception as exc:  # pragma: no cover - provider errors vary.
            errors.append(f"monitor_candidate model invocation failed: {exc}")

    if raw_report is None:
        report = _review_failure_report(
            state,
            "Monitoring report could not be normalized.",
        )
        errors.append("Monitoring report could not be normalized.")
        return {
            "monitoring_report": report,
            "goal_status": "needs_review",
            "status": "needs_review",
            "needs_human_review": True,
            "revision_feedback": report["feedback"],
            "errors": errors,
            "progress_history": _append_history(
                state,
                "monitor_candidate",
                {
                    "goal_status": "needs_review",
                    "errors": errors,
                },
            ),
        }

    report, validation_errors = _normalize_monitoring_report(raw_report, state)
    errors.extend(validation_errors)
    goal_status = _decide_goal_status(report, state)
    revision_feedback = _revision_feedback(report)
    needs_human_review = bool(
        state.get("needs_human_review", False)
        or goal_status == "needs_review"
        or report.get("safety_flags")
        or report.get("critical_uncertainty")
        or validation_errors
    )
    status = "ok" if goal_status in {"met", "needs_revision"} else "needs_review"

    return {
        "monitoring_report": report,
        "goal_status": goal_status,
        "revision_feedback": revision_feedback,
        "needs_human_review": needs_human_review,
        "status": status,
        "errors": errors,
        "progress_history": _append_history(
            state,
            "monitor_candidate",
            {
                "goal_status": goal_status,
                "score": report.get("score"),
                "unresolved_goals": _unresolved_goal_ids(report),
                "safety_flags": report.get("safety_flags", []),
            },
        ),
    }


def revise_candidate(state: GoalMonitoringState) -> dict[str, Any]:
    return _produce_candidate(state, node="revise_candidate", revision=True)


def mark_needs_review(state: GoalMonitoringState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    report = dict(state.get("monitoring_report", {}))
    unresolved = _unresolved_goal_ids(report)
    reason = (
        state.get("revision_feedback")
        or report.get("feedback")
        or "The goal-monitoring loop requires human review."
    )
    if state.get("goal_status") == "needs_revision" and state.get(
        "iteration_count", 0
    ) >= state.get("max_iterations", DEFAULT_MAX_ITERATIONS):
        reason = "Maximum goal-monitoring attempts reached. " + str(reason)
        if "Maximum goal-monitoring attempts reached." not in errors:
            errors.append("Maximum goal-monitoring attempts reached.")

    status = "failed" if state.get("status") == "failed" else "needs_review"
    return {
        "status": status,
        "goal_status": "failed" if status == "failed" else "needs_review",
        "needs_human_review": status != "failed",
        "revision_feedback": reason,
        "errors": errors,
        "progress_history": _append_history(
            state,
            "mark_needs_review",
            {
                "status": status,
                "reason": reason,
                "unresolved_goals": unresolved,
            },
        ),
    }


def finalize(state: GoalMonitoringState) -> dict[str, Any]:
    status = _final_status(state)
    report = dict(state.get("monitoring_report", {}))
    unresolved_goals = _unresolved_goal_ids(report)
    progress_history = _append_history(
        state,
        "finalize",
        {
            "status": status,
            "unresolved_goals": unresolved_goals,
            "iteration_count": state.get("iteration_count", 0),
        },
    )
    final_output = {
        "status": status,
        "artifact": state.get("candidate_artifact"),
        "iteration_count": state.get("iteration_count", 0),
        "goal_verdicts": report.get("goal_verdicts", []),
        "monitoring_report": report,
        "unresolved_goals": unresolved_goals,
        "reason": state.get("revision_feedback"),
        "errors": state.get("errors", []),
        "progress_history": progress_history,
    }
    return {
        "status": status,
        "final_output": final_output,
        "progress_history": progress_history,
    }


def _produce_candidate(
    state: GoalMonitoringState,
    *,
    node: str,
    revision: bool,
) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    previous_artifacts = list(state.get("previous_artifacts", []))
    current_artifact = state.get("candidate_artifact")
    if revision and current_artifact:
        previous_artifacts.append(current_artifact)

    try:
        content = _call_candidate_generator(state, revision=revision)
    except Exception as exc:  # pragma: no cover - concrete provider errors vary.
        errors.append(f"{node} model invocation failed: {exc}")
        return {
            "status": "failed",
            "goal_status": "failed",
            "needs_human_review": False,
            "errors": errors,
            "previous_artifacts": previous_artifacts,
            "progress_history": _append_history(
                state,
                node,
                {"error": str(exc), "revision": revision},
            ),
        }

    candidate = _strip_code_fence(str(content)).strip()
    iteration_count = state.get("iteration_count", 0) + 1
    if not candidate:
        errors.append(f"{node} produced an empty candidate artifact.")

    return {
        "candidate_artifact": candidate,
        "previous_artifacts": previous_artifacts,
        "iteration_count": iteration_count,
        "errors": errors,
        "status": "ok" if candidate else "failed",
        "goal_status": "needs_revision" if candidate else "failed",
        "progress_history": _append_history(
            state,
            node,
            {
                "iteration_count": iteration_count,
                "artifact_length": len(candidate),
                "revision": revision,
            },
        ),
    }


def _call_candidate_generator(
    state: GoalMonitoringState,
    *,
    revision: bool,
) -> str:
    generator = state.get("candidate_generator")
    if callable(generator):
        result = generator(state)
        if isinstance(result, dict):
            result = result.get("artifact", "")
        return str(result)

    if revision:
        user_prompt = REVISION_USER_PROMPT.format(
            use_case=state.get("use_case", ""),
            goal_contract=_json_dumps(state.get("goal_contract", [])),
            candidate_artifact=state.get("candidate_artifact") or "",
            check_results=_json_dumps(state.get("check_results", {})),
            monitoring_report=_json_dumps(state.get("monitoring_report", {})),
            revision_feedback=state.get("revision_feedback")
            or "Address unresolved goals.",
        )
    else:
        user_prompt = GENERATOR_USER_PROMPT.format(
            use_case=state.get("use_case", ""),
            goal_contract=_json_dumps(state.get("goal_contract", [])),
            iteration_count=state.get("iteration_count", 0) + 1,
            max_iterations=state.get("max_iterations", DEFAULT_MAX_ITERATIONS),
            revision_feedback=state.get("revision_feedback") or "None",
        )
    return _invoke_model(GENERATOR_SYSTEM_PROMPT, user_prompt)


def _invoke_model(system_prompt: str, user_prompt: str) -> str:
    response = get_chat_model().invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
    )
    content = getattr(response, "content", response)
    if isinstance(content, list):
        return "\n".join(str(part) for part in content)
    return str(content)


def _extract_task_and_goals(
    state: GoalMonitoringState,
    normalized_input: str,
) -> tuple[str, list[str]]:
    explicit_use_case = _normalize_text(str(state.get("use_case", "")))
    explicit_goals = _normalize_goal_list(state.get("raw_goals", []))
    if explicit_use_case or explicit_goals:
        return explicit_use_case or _strip_use_case_label(normalized_input), explicit_goals

    pattern = re.compile(
        r"\b(?:goals?|success criteria|criteria|requirements)\s*:\s*",
        re.IGNORECASE,
    )
    match = pattern.search(normalized_input)
    if not match:
        return _strip_use_case_label(normalized_input), []

    use_case = _strip_use_case_label(normalized_input[: match.start()])
    goals_text = normalized_input[match.end() :]
    return use_case, _normalize_goal_list(goals_text)


def _normalize_goal_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        chunks = re.split(r"(?:,|;|\n|(?:\s+-\s+)|(?:\s*\d+[.)]\s+))", value)
    elif isinstance(value, list):
        chunks = []
        for item in value:
            chunks.extend(_normalize_goal_list(item))
    else:
        chunks = [str(value)]

    goals: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        goal = _normalize_text(re.sub(r"^\s*[-*]\s*", "", str(chunk)))
        if not goal:
            continue
        key = goal.lower()
        if key in seen:
            continue
        seen.add(key)
        goals.append(goal)
    return goals


def _strip_use_case_label(text: str) -> str:
    text = re.sub(r"^\s*(?:use case|task|request)\s*:\s*", "", text, flags=re.I)
    return _normalize_text(text)


def _goal_contract_item(goal: str, index: int) -> GoalContractItem:
    normalized = goal.lower()
    goal_id = _goal_id(goal, index)
    criteria = _criteria_for(goal_id, goal)
    priority = "optional" if re.search(r"\b(optional|nice to have)\b", normalized) else "required"
    return {
        "id": goal_id,
        "description": goal,
        "priority": priority,
        "acceptance_criteria": criteria,
        "measurement": _measurement_for(goal_id),
    }


def _goal_id(goal: str, index: int) -> str:
    normalized = goal.lower()
    mappings = (
        ("edge_cases", ("edge", "boundary", "empty", "invalid input")),
        ("correctness", ("correct", "functionally", "accurate", "passes")),
        ("simplicity", ("simple", "readable", "understand", "clear")),
        ("examples", ("example", "usage", "demo")),
        ("documentation", ("docstring", "document", "comment")),
        ("typing", ("type", "annotation", "hint")),
        ("safety", ("safe", "no file", "no network", "side effect")),
        ("performance", ("fast", "efficient", "performance")),
        ("tests", ("test", "fixture")),
    )
    for goal_id, terms in mappings:
        if any(term in normalized for term in terms):
            return goal_id

    slug = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
    return slug[:40] or f"goal_{index}"


def _criteria_for(goal_id: str, goal: str) -> list[str]:
    criteria_by_goal = {
        "correctness": [
            "The code directly satisfies the requested use case.",
            "The Python syntax parses successfully.",
            "Objective checks and reviewer verdicts do not identify logic gaps.",
        ],
        "simplicity": [
            "The code uses straightforward control flow and clear names.",
            "The solution avoids unnecessary abstractions for the task size.",
        ],
        "edge_cases": [
            "The code handles empty, boundary, or invalid inputs explicitly.",
            "The reviewer identifies no unhandled critical edge cases.",
        ],
        "examples": [
            "The artifact includes a concise example usage or docstring example.",
        ],
        "documentation": [
            "The code includes a useful docstring or concise explanatory comments.",
        ],
        "typing": [
            "Function signatures include practical type annotations.",
        ],
        "safety": [
            "The code does not perform file, network, subprocess, credential, or destructive operations.",
        ],
        "performance": [
            "The implementation avoids avoidable expensive work for the task size.",
        ],
        "tests": [
            "The artifact includes testable examples or clear fixture behavior.",
        ],
    }
    return criteria_by_goal.get(
        goal_id,
        [f"The artifact provides measurable evidence for this goal: {goal}."],
    )


def _measurement_for(goal_id: str) -> str:
    measurements = {
        "correctness": "syntax checks plus reviewer verdict",
        "simplicity": "reviewer readability verdict",
        "edge_cases": "reviewer edge-case verdict and static evidence",
        "examples": "presence of example usage or docstring evidence",
        "documentation": "docstring/comment evidence",
        "typing": "annotation evidence",
        "safety": "static restricted-operation scan",
        "performance": "reviewer complexity verdict",
        "tests": "example or fixture evidence",
    }
    return measurements.get(goal_id, "reviewer verdict against acceptance criteria")


def _is_vague_goal(goal: str) -> bool:
    normalized = _normalize_text(goal).lower()
    return normalized in VAGUE_GOAL_PHRASES or normalized.startswith("make it good")


def _contradiction_reason(goals: list[str]) -> str | None:
    joined = " ".join(goals).lower()
    wants_shortest = any(term in joined for term in ("shortest possible", "one line", "minimal only"))
    wants_detail = any(
        term in joined
        for term in (
            "comprehensive explanation",
            "detailed explanation",
            "full tutorial",
            "thorough documentation",
        )
    )
    if wants_shortest and wants_detail:
        return (
            "Contradictory goals: shortest/minimal output conflicts with detailed "
            "or comprehensive explanation requirements."
        )
    return None


def _unsafe_task_reason(use_case: str, goals: list[str]) -> str | None:
    haystack = f"{use_case} {' '.join(goals)}".lower()
    for term in sorted(HIGH_RISK_TERMS):
        if term in haystack:
            return (
                "The task or goals appear to require side effects, credentials, "
                f"or high-impact operations ({term}); human review is required."
            )
    return None


def _static_code_checks(candidate: str) -> dict[str, Any]:
    if not candidate:
        return {
            "passed": False,
            "status": "failed",
            "syntax_valid": False,
            "syntax_error": "Candidate artifact is empty.",
            "has_function_definition": False,
            "unsafe_operations": [],
            "recoverable": True,
        }

    try:
        tree = ast.parse(candidate)
        syntax_valid = True
        syntax_error = None
    except SyntaxError as exc:
        tree = None
        syntax_valid = False
        syntax_error = f"{exc.msg} at line {exc.lineno or '?'}"

    unsafe_operations = _detect_unsafe_operations(tree) if tree is not None else []
    has_function_definition = (
        any(isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) for node in ast.walk(tree))
        if tree is not None
        else False
    )
    passed = syntax_valid and has_function_definition and not unsafe_operations
    return {
        "passed": passed,
        "status": "passed" if passed else "failed",
        "syntax_valid": syntax_valid,
        "syntax_error": syntax_error,
        "has_function_definition": has_function_definition,
        "unsafe_operations": unsafe_operations,
        "recoverable": not unsafe_operations,
    }


def _detect_unsafe_operations(tree: ast.AST | None) -> list[str]:
    if tree is None:
        return []

    unsafe: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module_names = []
            if isinstance(node, ast.Import):
                module_names = [alias.name.split(".")[0] for alias in node.names]
            elif node.module:
                module_names = [node.module.split(".")[0]]
            for module in module_names:
                if module in UNSAFE_MODULES:
                    unsafe.append(f"import:{module}")
        elif isinstance(node, ast.Call):
            call_name = _call_name(node.func)
            root_name = call_name.split(".")[0]
            attr_name = call_name.split(".")[-1]
            if call_name in UNSAFE_CALLS or root_name in UNSAFE_MODULES or attr_name in UNSAFE_ATTRIBUTES:
                unsafe.append(f"call:{call_name}")

    return sorted(set(unsafe))


def _call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _call_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    return ""


def _merge_check_results(
    base_results: dict[str, Any],
    injected: dict[str, Any],
) -> dict[str, Any]:
    merged = {**base_results, **injected}
    unsafe = list(base_results.get("unsafe_operations", []))
    unsafe.extend(str(item) for item in injected.get("unsafe_operations", []))
    merged["unsafe_operations"] = sorted(set(unsafe))
    merged["passed"] = bool(
        merged.get(
            "passed",
            base_results.get("passed", False) and not merged["unsafe_operations"],
        )
    )
    merged["status"] = str(
        merged.get("status") or ("passed" if merged["passed"] else "failed")
    )
    merged["recoverable"] = bool(
        merged.get("recoverable", not merged["unsafe_operations"])
    )
    return merged


def _normalize_monitoring_report(
    raw_report: dict[str, Any],
    state: GoalMonitoringState,
) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    check_results = state.get("check_results", {})
    raw_verdicts = raw_report.get("goal_verdicts", raw_report.get("goals", []))
    verdicts, verdict_errors = _normalize_goal_verdicts(raw_verdicts, state)
    errors.extend(verdict_errors)

    score = _coerce_score(raw_report.get("score"), verdicts)
    feedback = _normalize_text(str(raw_report.get("feedback") or "No reviewer feedback."))
    safety_flags = _normalize_string_list(raw_report.get("safety_flags", []))
    safety_flags.extend(str(flag) for flag in check_results.get("unsafe_operations", []))
    safety_flags = sorted(set(safety_flags))

    if not check_results.get("syntax_valid", True):
        _force_goal_status(verdicts, "correctness", "unmet", "Python syntax did not parse.")
    if not check_results.get("has_function_definition", True):
        _force_goal_status(verdicts, "correctness", "unmet", "No function definition was found.")
    if safety_flags:
        _force_goal_status(
            verdicts,
            "safety",
            "unmet",
            "Static checks found restricted operations.",
        )

    overall_status = _normalize_overall_status(raw_report.get("overall_status"))
    critical_uncertainty = bool(raw_report.get("uncertain", False)) or any(
        verdict.get("required", True) and verdict.get("status") == "uncertain"
        for verdict in verdicts
    )
    actionable = bool(raw_report.get("actionable", raw_report.get("recoverable", True)))
    report = {
        "overall_status": overall_status,
        "score": score,
        "feedback": feedback,
        "goal_verdicts": verdicts,
        "safety_flags": safety_flags,
        "critical_uncertainty": critical_uncertainty,
        "actionable": actionable,
        "objective_checks_passed": bool(check_results.get("passed", False)),
    }
    if raw_report.get("unsupported_claims"):
        report["unsupported_claims"] = _normalize_string_list(
            raw_report.get("unsupported_claims", [])
        )
    return report, errors


def _normalize_goal_verdicts(
    raw_verdicts: Any,
    state: GoalMonitoringState,
) -> tuple[list[GoalVerdict], list[str]]:
    errors: list[str] = []
    contract = state.get("goal_contract", [])
    by_goal: dict[str, dict[str, Any]] = {}

    if isinstance(raw_verdicts, dict):
        iterable = [
            {"goal_id": goal_id, **value}
            if isinstance(value, dict)
            else {"goal_id": goal_id, "status": value}
            for goal_id, value in raw_verdicts.items()
        ]
    elif isinstance(raw_verdicts, list):
        iterable = raw_verdicts
    else:
        iterable = []
        errors.append("Monitoring report did not include goal verdicts.")

    for raw in iterable:
        if not isinstance(raw, dict):
            errors.append("Goal verdict entries must be objects.")
            continue
        goal_id = _normalize_text(str(raw.get("goal_id") or raw.get("id") or ""))
        if not goal_id:
            errors.append("Goal verdict is missing goal_id.")
            continue
        by_goal[goal_id] = raw

    verdicts: list[GoalVerdict] = []
    for item in contract:
        goal_id = item.get("id", "")
        raw = by_goal.get(goal_id, {})
        status = _normalize_verdict_status(raw.get("status"))
        evidence = _normalize_text(str(raw.get("evidence") or "No evidence provided."))
        recoverable = bool(raw.get("recoverable", status != "uncertain"))
        verdicts.append(
            {
                "goal_id": goal_id,
                "status": status,
                "evidence": evidence,
                "required": item.get("priority", "required") == "required",
                "recoverable": recoverable,
            }
        )
    return verdicts, errors


def _force_goal_status(
    verdicts: list[GoalVerdict],
    goal_id: str,
    status: str,
    evidence: str,
) -> None:
    target = next((verdict for verdict in verdicts if verdict.get("goal_id") == goal_id), None)
    if target is None and verdicts:
        target = next(
            (verdict for verdict in verdicts if verdict.get("required", True)),
            verdicts[0],
        )
    if target is not None:
        target["status"] = status  # type: ignore[typeddict-item]
        target["evidence"] = evidence
        target["recoverable"] = status != "uncertain"


def _decide_goal_status(report: dict[str, Any], state: GoalMonitoringState) -> str:
    check_results = state.get("check_results", {})
    unresolved = _unresolved_goal_ids(report)
    score = float(report.get("score", 0.0))
    threshold = float(
        state.get("success_criteria", {}).get(
            "score_threshold",
            DEFAULT_SCORE_THRESHOLD,
        )
    )

    if report.get("safety_flags") or report.get("unsupported_claims"):
        return "needs_review"
    if report.get("critical_uncertainty"):
        return "needs_review"
    if not check_results.get("recoverable", True):
        return "needs_review"
    if not check_results.get("syntax_valid", True) or not check_results.get(
        "has_function_definition",
        True,
    ):
        return "needs_revision"
    if not unresolved and score >= threshold and report.get("objective_checks_passed"):
        return "met"
    if report.get("overall_status") == "needs_review" or not report.get("actionable", True):
        return "needs_review"
    return "needs_revision"


def _review_failure_report(state: GoalMonitoringState, feedback: str) -> dict[str, Any]:
    verdicts: list[GoalVerdict] = [
        {
            "goal_id": item.get("id", ""),
            "status": "uncertain",
            "evidence": "Reviewer output was unavailable or malformed.",
            "required": item.get("priority", "required") == "required",
            "recoverable": False,
        }
        for item in state.get("goal_contract", [])
    ]
    return {
        "overall_status": "needs_review",
        "score": 0.0,
        "feedback": feedback,
        "goal_verdicts": verdicts,
        "safety_flags": [],
        "critical_uncertainty": True,
        "actionable": False,
        "objective_checks_passed": bool(state.get("check_results", {}).get("passed")),
    }


def _revision_feedback(report: dict[str, Any]) -> str:
    unresolved = _unresolved_goal_ids(report)
    feedback = _normalize_text(str(report.get("feedback") or ""))
    if unresolved:
        return f"{feedback} Unresolved goals: {', '.join(unresolved)}.".strip()
    return feedback or "All required goals are met."


def _unresolved_goal_ids(report: dict[str, Any]) -> list[str]:
    return [
        str(verdict.get("goal_id"))
        for verdict in report.get("goal_verdicts", [])
        if verdict.get("required", True) and verdict.get("status") != "met"
    ]


def _final_status(state: GoalMonitoringState) -> str:
    if state.get("status") == "failed" or state.get("goal_status") == "failed":
        return "failed"
    if state.get("needs_human_review") or state.get("goal_status") == "needs_review":
        return "needs_review"
    if state.get("goal_status") == "met":
        return "ok"
    return "needs_review"


def _normalize_overall_status(value: Any) -> str:
    status = _normalize_text(str(value or "needs_revision")).lower()
    return status if status in ALLOWED_OVERALL_STATUSES else "needs_review"


def _normalize_verdict_status(value: Any) -> str:
    status = _normalize_text(str(value or "uncertain")).lower()
    return status if status in ALLOWED_VERDICT_STATUSES else "uncertain"


def _coerce_score(value: Any, verdicts: list[GoalVerdict]) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        if not verdicts:
            return 0.0
        met = sum(1 for verdict in verdicts if verdict.get("status") == "met")
        score = met / len(verdicts)
    return min(1.0, max(0.0, score))


def _normalize_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value else []
    if isinstance(value, list):
        return [_normalize_text(str(item)) for item in value if _normalize_text(str(item))]
    return [_normalize_text(str(value))]


def _parse_json_object(raw_text: str) -> tuple[dict[str, Any] | None, list[str]]:
    text = _strip_code_fence(raw_text)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            return None, ["Malformed monitoring output: JSON object not found."]
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            return None, [f"Malformed monitoring output: {exc.msg}."]

    if not isinstance(parsed, dict):
        return None, ["Malformed monitoring output: expected a JSON object."]
    return parsed, []


def _strip_code_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    stripped = re.sub(r"^```(?:python|json|text)?\s*", "", stripped, flags=re.I)
    stripped = re.sub(r"\s*```$", "", stripped)
    return stripped.strip()


def _append_history(
    state: GoalMonitoringState,
    node: str,
    details: dict[str, Any],
) -> list[ProgressEvent]:
    return [*state.get("progress_history", []), {"node": node, "details": details}]


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True)


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(0, parsed)


def _coerce_positive_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, parsed)
