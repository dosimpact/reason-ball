from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_06_planning.prompts import (
    CREATE_PLAN_SYSTEM_PROMPT,
    CREATE_PLAN_USER_PROMPT,
    REPAIR_PLAN_SYSTEM_PROMPT,
    REPAIR_PLAN_USER_PROMPT,
    REPLAN_SYSTEM_PROMPT,
    REPLAN_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_06_planning.state import (
    ExecutionEvent,
    PlanStep,
    PlanningState,
    SourceNote,
    StepResult,
)
from agentic_design_patterns.shared.models import get_chat_model


ALLOWED_TOOLS = {"source_notes", "analysis", "none"}
REQUIRED_STEP_FIELDS = (
    "id",
    "description",
    "depends_on",
    "tool",
    "acceptance_criteria",
)
DEFAULT_MAX_REPAIRS = 1
DEFAULT_MAX_REPLANS = 1
DEFAULT_MAX_STEPS = 5
STOPWORDS = {
    "about",
    "after",
    "against",
    "also",
    "and",
    "brief",
    "from",
    "evidence",
    "find",
    "gather",
    "goal",
    "into",
    "main",
    "must",
    "note",
    "notes",
    "only",
    "plan",
    "research",
    "relevant",
    "source",
    "step",
    "that",
    "the",
    "this",
    "with",
}
DEFAULT_SOURCE_NOTES: list[SourceNote] = [
    {
        "source_id": "note_1",
        "title": "Remote work productivity",
        "text": (
            "Remote work can improve productivity when teams define async norms, "
            "meeting hygiene, and focus blocks."
        ),
        "summary": "Remote productivity improves with async norms and meeting hygiene.",
    },
    {
        "source_id": "note_2",
        "title": "Hybrid retention",
        "text": (
            "Hybrid teams report stronger retention when managers coordinate "
            "mentorship, onboarding, and social connection."
        ),
        "summary": "Hybrid retention depends on mentorship and social connection.",
    },
    {
        "source_id": "note_3",
        "title": "Distributed security",
        "text": (
            "Security reviews should cover device management, access controls, "
            "data handling, and incident escalation."
        ),
        "summary": "Distributed teams need device, access, and data controls.",
    },
]


def prepare_input(state: PlanningState) -> dict[str, Any]:
    raw_input = "" if state.get("input") is None else str(state.get("input", ""))
    goal = _normalize_text(state.get("goal") or raw_input)
    constraints = _dict_or_empty(state.get("constraints"))
    source_notes = _normalize_source_notes(state.get("source_notes") or DEFAULT_SOURCE_NOTES)
    max_steps = _coerce_positive_int(state.get("max_steps"), DEFAULT_MAX_STEPS)

    updates: dict[str, Any] = {
        "goal": goal,
        "constraints": constraints,
        "source_notes": source_notes,
        "plan": state.get("plan", []),
        "plan_errors": [],
        "approved_plan": state.get("approved_plan", True),
        "current_step_id": None,
        "step_results": dict(state.get("step_results", {})),
        "observations": list(state.get("observations", [])),
        "knowledge_gaps": list(state.get("knowledge_gaps", [])),
        "repair_count": _coerce_non_negative_int(state.get("repair_count"), 0),
        "max_repairs": _coerce_non_negative_int(
            state.get("max_repairs"), DEFAULT_MAX_REPAIRS
        ),
        "replan_count": _coerce_non_negative_int(state.get("replan_count"), 0),
        "max_replans": _coerce_non_negative_int(
            state.get("max_replans"), DEFAULT_MAX_REPLANS
        ),
        "max_steps": max_steps,
        "blocked_reason": None,
        "status": "ok",
    }

    if not goal:
        updates.update(
            {
                "status": "failed",
                "plan_errors": ["Input is empty."],
                "blocked_reason": "Input is empty.",
            }
        )

    updates["execution_history"] = _append_history(
        state,
        "prepare_input",
        {
            "goal": goal,
            "source_note_count": len(source_notes),
            "max_steps": max_steps,
            "status": updates["status"],
        },
    )
    return updates


def create_plan(state: PlanningState) -> dict[str, Any]:
    if state.get("status") == "failed":
        return {}

    try:
        content = _invoke_model(
            CREATE_PLAN_SYSTEM_PROMPT,
            CREATE_PLAN_USER_PROMPT.format(
                goal=state.get("goal", ""),
                constraints=_json_dumps(state.get("constraints", {})),
                source_notes=_json_dumps(state.get("source_notes", [])),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        error = f"create_plan model invocation failed: {exc}"
        return {
            "status": "failed",
            "blocked_reason": error,
            "plan_errors": [*state.get("plan_errors", []), error],
            "execution_history": _append_history(
                state,
                "create_plan",
                {"error": error},
            ),
        }

    plan, parse_errors, normalized_goal = _parse_plan_response(content)
    return {
        "raw_plan_output": content,
        "goal": normalized_goal or state.get("goal", ""),
        "plan": plan,
        "plan_errors": parse_errors,
        "execution_history": _append_history(
            state,
            "create_plan",
            {
                "step_count": len(plan),
                "parse_errors": parse_errors,
            },
        ),
    }


def validate_plan(state: PlanningState) -> dict[str, Any]:
    errors = list(state.get("plan_errors", []))
    plan = list(state.get("plan", []))

    if state.get("status") == "failed":
        return {
            "status": "failed",
            "plan_errors": errors,
            "execution_history": _append_history(
                state,
                "validate_plan",
                {"plan_errors": errors, "status": "failed"},
            ),
        }

    errors.extend(_validate_plan_schema(plan, state.get("max_steps", DEFAULT_MAX_STEPS)))
    status = "ok" if not errors else "needs_review"
    blocked_reason = None if not errors else "Plan validation failed."
    normalized_plan = _normalize_step_statuses(plan)

    return {
        "plan": normalized_plan,
        "plan_errors": errors,
        "status": status,
        "blocked_reason": blocked_reason,
        "execution_history": _append_history(
            state,
            "validate_plan",
            {
                "plan_errors": errors,
                "status": status,
            },
        ),
    }


def repair_plan(state: PlanningState) -> dict[str, Any]:
    repair_count = state.get("repair_count", 0) + 1

    try:
        content = _invoke_model(
            REPAIR_PLAN_SYSTEM_PROMPT,
            REPAIR_PLAN_USER_PROMPT.format(
                goal=state.get("goal", ""),
                raw_plan_output=state.get("raw_plan_output")
                or _json_dumps(state.get("plan", [])),
                plan_errors="\n".join(state.get("plan_errors", [])),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        error = f"repair_plan model invocation failed: {exc}"
        return {
            "status": "failed",
            "blocked_reason": error,
            "repair_count": repair_count,
            "plan_errors": [*state.get("plan_errors", []), error],
            "execution_history": _append_history(
                state,
                "repair_plan",
                {"repair_count": repair_count, "error": error},
            ),
        }

    plan, parse_errors, normalized_goal = _parse_plan_response(content)
    return {
        "raw_plan_output": content,
        "goal": normalized_goal or state.get("goal", ""),
        "plan": plan,
        "plan_errors": parse_errors,
        "repair_count": repair_count,
        "status": "ok" if not parse_errors else "needs_review",
        "blocked_reason": None,
        "execution_history": _append_history(
            state,
            "repair_plan",
            {
                "repair_count": repair_count,
                "step_count": len(plan),
                "parse_errors": parse_errors,
            },
        ),
    }


def review_plan(state: PlanningState) -> dict[str, Any]:
    approved = bool(state.get("approved_plan", True))
    if not approved:
        return {
            "status": "needs_review",
            "blocked_reason": "Plan approval was denied.",
            "execution_history": _append_history(
                state,
                "review_plan",
                {"approved": False},
            ),
        }

    return {
        "status": "ok",
        "blocked_reason": None,
        "execution_history": _append_history(
            state,
            "review_plan",
            {"approved": True},
        ),
    }


def select_next_step(state: PlanningState) -> dict[str, Any]:
    plan = list(state.get("plan", []))
    completed = _completed_step_ids(plan)
    pending = [step for step in plan if _step_status(step) not in {"complete", "skipped"}]
    executed_count = len(state.get("step_results", {}))

    if not pending:
        return {
            "current_step_id": None,
            "next_action": "synthesize_report",
            "execution_history": _append_history(
                state,
                "select_next_step",
                {"selected": None, "reason": "all_steps_complete"},
            ),
        }

    if executed_count >= state.get("max_steps", DEFAULT_MAX_STEPS):
        reason = (
            "Maximum step execution limit reached before the plan completed: "
            f"{executed_count}."
        )
        return {
            "status": "needs_review",
            "blocked_reason": reason,
            "current_step_id": None,
            "next_action": "mark_needs_review",
            "plan_errors": [*state.get("plan_errors", []), reason],
            "execution_history": _append_history(
                state,
                "select_next_step",
                {"selected": None, "reason": reason},
            ),
        }

    for step in pending:
        if set(_dependencies_for(step)).issubset(completed):
            step_id = str(step.get("id", ""))
            return {
                "current_step_id": step_id,
                "next_action": "select_next_step",
                "execution_history": _append_history(
                    state,
                    "select_next_step",
                    {"selected": step_id},
                ),
            }

    reason = "No executable steps are ready; dependencies may be blocked."
    return {
        "status": "needs_review",
        "blocked_reason": reason,
        "current_step_id": None,
        "next_action": "mark_needs_review",
        "plan_errors": [*state.get("plan_errors", []), reason],
        "execution_history": _append_history(
            state,
            "select_next_step",
            {"selected": None, "reason": reason},
        ),
    }


def execute_step(state: PlanningState) -> dict[str, Any]:
    step_id = state.get("current_step_id")
    step = _find_step(state.get("plan", []), step_id)
    if step is None:
        reason = f"Selected step does not exist: {step_id!r}."
        return _execution_blocked_update(state, reason)

    missing_dependencies = [
        dependency
        for dependency in _dependencies_for(step)
        if dependency not in _completed_step_ids(state.get("plan", []))
    ]
    if missing_dependencies:
        reason = (
            f"Step {step_id} cannot execute before dependencies complete: "
            + ", ".join(missing_dependencies)
            + "."
        )
        return _execution_blocked_update(state, reason)

    tool = _normalize_text(step.get("tool", "")).lower()
    if tool == "source_notes":
        result = _execute_source_notes_step(state, step)
    elif tool in {"analysis", "none"}:
        result = _execute_analysis_step(state, step)
    else:
        result = {
            "step_id": str(step_id),
            "status": "blocked",
            "summary": "",
            "evidence": [],
            "gaps": [f"Unsupported tool for execution: {tool!r}."],
            "error": f"Unsupported tool: {tool!r}.",
        }

    plan = _set_step_status(
        state.get("plan", []),
        str(step_id),
        "complete" if result["status"] == "complete" else "blocked",
    )
    step_results = dict(state.get("step_results", {}))
    step_results[str(step_id)] = result
    observations = list(state.get("observations", []))
    if result.get("summary"):
        observations.append(str(result["summary"]))
    observations.extend(result.get("gaps", []))

    return {
        "plan": plan,
        "step_results": step_results,
        "observations": observations,
        "execution_history": _append_history(
            state,
            "execute_step",
            {
                "step_id": step_id,
                "status": result["status"],
                "evidence_count": len(result.get("evidence", [])),
                "gaps": result.get("gaps", []),
            },
        ),
    }


def assess_progress(state: PlanningState) -> dict[str, Any]:
    step_id = state.get("current_step_id")
    result = state.get("step_results", {}).get(str(step_id))
    if result is None:
        reason = f"No result was recorded for selected step: {step_id!r}."
        return {
            "status": "needs_review",
            "blocked_reason": reason,
            "next_action": "mark_needs_review",
            "plan_errors": [*state.get("plan_errors", []), reason],
            "execution_history": _append_history(
                state,
                "assess_progress",
                {"step_id": step_id, "reason": reason},
            ),
        }

    gaps = _merge_unique(state.get("knowledge_gaps", []), result.get("gaps", []))
    if result.get("status") == "blocked":
        if state.get("replan_count", 0) < state.get("max_replans", DEFAULT_MAX_REPLANS):
            return {
                "knowledge_gaps": gaps,
                "next_action": "replan",
                "blocked_reason": (
                    f"Step {step_id} did not meet its acceptance criteria; replanning."
                ),
                "execution_history": _append_history(
                    state,
                    "assess_progress",
                    {
                        "step_id": step_id,
                        "status": "blocked",
                        "next_action": "replan",
                    },
                ),
            }

        reason = (
            f"Replanning limit reached after blocked step {step_id}: "
            f"{state.get('replan_count', 0)}."
        )
        return {
            "status": "needs_review",
            "blocked_reason": reason,
            "knowledge_gaps": gaps,
            "next_action": "mark_needs_review",
            "execution_history": _append_history(
                state,
                "assess_progress",
                {
                    "step_id": step_id,
                    "status": "blocked",
                    "next_action": "mark_needs_review",
                },
            ),
        }

    next_action = (
        "synthesize_report"
        if _all_required_steps_complete(state.get("plan", []))
        else "select_next_step"
    )
    return {
        "status": "ok",
        "blocked_reason": None,
        "current_step_id": None,
        "knowledge_gaps": gaps,
        "next_action": next_action,
        "execution_history": _append_history(
            state,
            "assess_progress",
            {
                "step_id": step_id,
                "status": "complete",
                "next_action": next_action,
            },
        ),
    }


def replan(state: PlanningState) -> dict[str, Any]:
    replan_count = state.get("replan_count", 0) + 1
    try:
        content = _invoke_model(
            REPLAN_SYSTEM_PROMPT,
            REPLAN_USER_PROMPT.format(
                goal=state.get("goal", ""),
                plan=_json_dumps(state.get("plan", [])),
                step_results=_json_dumps(state.get("step_results", {})),
                observations=_json_dumps(state.get("observations", [])),
                knowledge_gaps=_json_dumps(state.get("knowledge_gaps", [])),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        error = f"replan model invocation failed: {exc}"
        return {
            "status": "failed",
            "blocked_reason": error,
            "replan_count": replan_count,
            "plan_errors": [*state.get("plan_errors", []), error],
            "execution_history": _append_history(
                state,
                "replan",
                {"replan_count": replan_count, "error": error},
            ),
        }

    new_plan, parse_errors, normalized_goal = _parse_plan_response(content)
    merged_plan = _merge_completed_steps(state.get("plan", []), new_plan)
    return {
        "raw_replan_output": content,
        "goal": normalized_goal or state.get("goal", ""),
        "plan": merged_plan,
        "plan_errors": parse_errors,
        "status": "ok" if not parse_errors else "needs_review",
        "blocked_reason": None,
        "current_step_id": None,
        "replan_count": replan_count,
        "execution_history": _append_history(
            state,
            "replan",
            {
                "replan_count": replan_count,
                "step_count": len(merged_plan),
                "parse_errors": parse_errors,
            },
        ),
    }


def synthesize_report(state: PlanningState) -> dict[str, Any]:
    status = "failed" if state.get("status") == "failed" else "ok"
    final_report = _format_final_report(state)
    final_output = {
        "status": status,
        "final_report": final_report,
        "plan": state.get("plan", []),
        "step_results": state.get("step_results", {}),
        "knowledge_gaps": state.get("knowledge_gaps", []),
        "evidence": _collect_evidence(state.get("step_results", {})),
        "plan_errors": state.get("plan_errors", []),
        "replan_count": state.get("replan_count", 0),
    }
    return {
        "status": status,
        "final_report": final_report,
        "final_output": final_output,
        "execution_history": _append_history(
            state,
            "synthesize_report",
            {
                "status": status,
                "evidence_count": len(final_output["evidence"]),
                "gap_count": len(final_output["knowledge_gaps"]),
            },
        ),
    }


def mark_needs_review(state: PlanningState) -> dict[str, Any]:
    status = "failed" if state.get("status") == "failed" else "needs_review"
    reason = state.get("blocked_reason") or "Planning workflow needs review."
    final_report = "\n".join(
        [
            "Planning workflow needs review.",
            f"Reason: {reason}",
            "",
            "Plan Errors:",
            _format_items(state.get("plan_errors", []), "None"),
            "",
            "Knowledge Gaps:",
            _format_items(state.get("knowledge_gaps", []), "None"),
        ]
    )
    final_output = {
        "status": status,
        "final_report": final_report,
        "blocked_reason": reason,
        "plan": state.get("plan", []),
        "step_results": state.get("step_results", {}),
        "knowledge_gaps": state.get("knowledge_gaps", []),
        "plan_errors": state.get("plan_errors", []),
        "evidence": _collect_evidence(state.get("step_results", {})),
        "replan_count": state.get("replan_count", 0),
        "repair_count": state.get("repair_count", 0),
    }
    return {
        "status": status,
        "final_report": final_report,
        "final_output": final_output,
        "execution_history": _append_history(
            state,
            "mark_needs_review",
            {"status": status, "reason": reason},
        ),
    }


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


def _execute_source_notes_step(
    state: PlanningState, step: PlanStep
) -> StepResult:
    query = " ".join(
        [
            str(step.get("description", "")),
            " ".join(str(item) for item in step.get("acceptance_criteria", [])),
        ]
    )
    evidence = _matching_notes(
        state.get("source_notes", []),
        query,
    )
    if not evidence and not _significant_tokens(query):
        evidence = _matching_notes(state.get("source_notes", []), state.get("goal", ""))

    step_id = str(step.get("id", ""))
    if not evidence:
        gap = f"No source evidence found for {step_id}: {step.get('description', '')}."
        return {
            "step_id": step_id,
            "status": "blocked",
            "summary": "",
            "evidence": [],
            "gaps": [gap],
            "error": gap,
        }

    source_ids = ", ".join(item["source_id"] for item in evidence)
    summaries = "; ".join(item["summary"] for item in evidence)
    return {
        "step_id": step_id,
        "status": "complete",
        "summary": f"Found evidence in {source_ids}: {summaries}",
        "evidence": evidence,
        "gaps": [],
        "error": None,
    }


def _execute_analysis_step(state: PlanningState, step: PlanStep) -> StepResult:
    prior_summaries = [
        result.get("summary", "")
        for result in state.get("step_results", {}).values()
        if result.get("summary")
    ]
    step_id = str(step.get("id", ""))
    detail = " ".join(prior_summaries) or "No prior evidence was required."
    return {
        "step_id": step_id,
        "status": "complete",
        "summary": (
            f"Completed analysis for {step_id}: {step.get('description', '')}. "
            f"Inputs considered: {detail}"
        ),
        "evidence": _collect_evidence(state.get("step_results", {})),
        "gaps": [],
        "error": None,
    }


def _execution_blocked_update(state: PlanningState, reason: str) -> dict[str, Any]:
    return {
        "status": "needs_review",
        "blocked_reason": reason,
        "plan_errors": [*state.get("plan_errors", []), reason],
        "execution_history": _append_history(
            state,
            "execute_step",
            {"error": reason},
        ),
    }


def _parse_plan_response(
    raw_text: str,
) -> tuple[list[PlanStep], list[str], str | None]:
    candidate = _strip_code_fence(raw_text)
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return [], [f"Malformed plan JSON: {exc.msg}."], None

    normalized_goal: str | None = None
    if isinstance(parsed, dict):
        plan_value = parsed.get("plan")
        normalized_goal = _string_or_none(parsed.get("goal"))
    elif isinstance(parsed, list):
        plan_value = parsed
    else:
        return [], ["Plan output must be a JSON object or list."], None

    if not isinstance(plan_value, list):
        return [], ["Plan output must include a plan list."], normalized_goal

    plan: list[PlanStep] = []
    errors: list[str] = []
    for index, item in enumerate(plan_value):
        if not isinstance(item, dict):
            errors.append(f"Plan step at index {index} must be an object.")
            continue
        plan.append(_coerce_plan_step(item))

    return plan, errors, normalized_goal


def _coerce_plan_step(item: dict[str, Any]) -> PlanStep:
    step = dict(item)
    if "status" not in step or _normalize_text(step.get("status", "")).lower() == "":
        step["status"] = "pending"
    return step  # type: ignore[return-value]


def _validate_plan_schema(plan: list[PlanStep], max_steps: int) -> list[str]:
    errors: list[str] = []
    if not plan:
        errors.append("Plan must contain at least one step.")
        return errors

    if len(plan) > max_steps:
        errors.append(f"Plan has {len(plan)} steps; maximum is {max_steps}.")

    step_ids: list[str] = []
    seen_ids: set[str] = set()
    for index, step in enumerate(plan):
        label = _step_label(step, index)
        for field in REQUIRED_STEP_FIELDS:
            if field not in step:
                errors.append(f"{label} is missing required field: {field}.")

        step_id = _string_or_none(step.get("id"))
        if step_id is None:
            continue
        if step_id in seen_ids:
            errors.append(f"Duplicate step id: {step_id}.")
        seen_ids.add(step_id)
        step_ids.append(step_id)

        if not _string_or_none(step.get("description")):
            errors.append(f"{label} must include a non-empty description.")

        depends_on = step.get("depends_on")
        if not isinstance(depends_on, list):
            errors.append(f"{label} depends_on must be a list.")
        elif not all(isinstance(item, str) and item.strip() for item in depends_on):
            errors.append(f"{label} depends_on must contain only non-empty strings.")

        tool = _normalize_text(step.get("tool", "")).lower()
        if tool not in ALLOWED_TOOLS:
            errors.append(f"{label} uses unsupported tool: {step.get('tool')!r}.")

        criteria = step.get("acceptance_criteria")
        if not isinstance(criteria, list) or not criteria:
            errors.append(f"{label} must include acceptance criteria.")
        elif not all(isinstance(item, str) and item.strip() for item in criteria):
            errors.append(
                f"{label} acceptance_criteria must contain only non-empty strings."
            )

    known_ids = set(step_ids)
    graph: dict[str, list[str]] = {}
    for index, step in enumerate(plan):
        step_id = _string_or_none(step.get("id"))
        if step_id is None:
            continue
        dependencies = _dependencies_for(step)
        unknown = [dependency for dependency in dependencies if dependency not in known_ids]
        if unknown:
            errors.append(
                f"{_step_label(step, index)} depends on unknown step ids: "
                + ", ".join(unknown)
                + "."
            )
        graph[step_id] = dependencies

    cycle = _find_cycle(graph)
    if cycle:
        errors.append("Plan contains circular dependencies: " + " -> ".join(cycle) + ".")

    return errors


def _normalize_step_statuses(plan: list[PlanStep]) -> list[PlanStep]:
    normalized: list[PlanStep] = []
    for step in plan:
        new_step = dict(step)
        status = _normalize_text(new_step.get("status", "")).lower()
        if status not in {"pending", "complete", "blocked", "skipped"}:
            status = "pending"
        new_step["status"] = status
        normalized.append(new_step)  # type: ignore[arg-type]
    return normalized


def _find_cycle(graph: dict[str, list[str]]) -> list[str]:
    visiting: set[str] = set()
    visited: set[str] = set()
    path: list[str] = []

    def visit(node: str) -> list[str]:
        if node in visiting:
            try:
                cycle_start = path.index(node)
            except ValueError:
                cycle_start = 0
            return [*path[cycle_start:], node]
        if node in visited:
            return []
        visiting.add(node)
        path.append(node)
        for dependency in graph.get(node, []):
            cycle = visit(dependency)
            if cycle:
                return cycle
        path.pop()
        visiting.remove(node)
        visited.add(node)
        return []

    for node in graph:
        cycle = visit(node)
        if cycle:
            return cycle
    return []


def _merge_completed_steps(
    previous_plan: list[PlanStep], new_plan: list[PlanStep]
) -> list[PlanStep]:
    completed = {
        str(step.get("id")): step
        for step in previous_plan
        if _step_status(step) == "complete" and _string_or_none(step.get("id"))
    }
    merged: list[PlanStep] = []
    seen: set[str] = set()

    for step in new_plan:
        step_id = _string_or_none(step.get("id"))
        if step_id in completed:
            merged.append(completed[step_id])
            seen.add(step_id)
        else:
            merged.append(step)
            if step_id:
                seen.add(step_id)

    for step_id, step in completed.items():
        if step_id not in seen:
            merged.insert(0, step)

    return merged


def _matching_notes(source_notes: list[SourceNote], query: str) -> list[dict[str, Any]]:
    query_tokens = set(_significant_tokens(query))
    scored: list[tuple[int, SourceNote]] = []
    for note in source_notes:
        searchable = " ".join(
            [
                str(note.get("source_id", "")),
                str(note.get("title", "")),
                str(note.get("summary", "")),
                str(note.get("text", "")),
            ]
        )
        note_tokens = set(_significant_tokens(searchable))
        score = len(query_tokens.intersection(note_tokens))
        if score:
            scored.append((score, note))

    scored.sort(key=lambda item: (-item[0], item[1].get("source_id", "")))
    evidence: list[dict[str, Any]] = []
    for _, note in scored[:3]:
        evidence.append(
            {
                "source_id": note.get("source_id", "unknown"),
                "title": note.get("title", ""),
                "summary": note.get("summary") or _first_sentence(note.get("text", "")),
            }
        )
    return evidence


def _collect_evidence(step_results: dict[str, StepResult]) -> list[dict[str, Any]]:
    evidence_by_id: dict[str, dict[str, Any]] = {}
    for result in step_results.values():
        for item in result.get("evidence", []):
            source_id = str(item.get("source_id", "unknown"))
            evidence_by_id[source_id] = dict(item)
    return list(evidence_by_id.values())


def _format_final_report(state: PlanningState) -> str:
    completed_steps = [
        f"- {step.get('id')}: {step.get('description')}"
        for step in state.get("plan", [])
        if _step_status(step) == "complete"
    ]
    result_summaries = [
        f"- {step_id}: {result.get('summary')}"
        for step_id, result in state.get("step_results", {}).items()
        if result.get("summary")
    ]
    evidence = [
        f"- [{item.get('source_id')}] {item.get('summary')}"
        for item in _collect_evidence(state.get("step_results", {}))
    ]
    gaps = state.get("knowledge_gaps", [])

    return "\n".join(
        [
            f"Research Goal: {state.get('goal', '')}",
            "",
            "Completed Plan Steps:",
            _format_items(completed_steps, "None"),
            "",
            "Brief:",
            _format_items(result_summaries, "No completed step summaries are available."),
            "",
            "Evidence Notes:",
            _format_items(evidence, "None"),
            "",
            "Unresolved Gaps:",
            _format_items(gaps, "None"),
        ]
    )


def _format_items(items: list[str], fallback: str) -> str:
    if not items:
        return fallback
    return "\n".join(str(item) for item in items)


def _find_step(plan: list[PlanStep], step_id: str | None) -> PlanStep | None:
    for step in plan:
        if step.get("id") == step_id:
            return step
    return None


def _set_step_status(
    plan: list[PlanStep], step_id: str, status: str
) -> list[PlanStep]:
    updated: list[PlanStep] = []
    for step in plan:
        new_step = dict(step)
        if new_step.get("id") == step_id:
            new_step["status"] = status
        updated.append(new_step)  # type: ignore[arg-type]
    return updated


def _completed_step_ids(plan: list[PlanStep]) -> set[str]:
    return {
        str(step.get("id"))
        for step in plan
        if _step_status(step) == "complete" and _string_or_none(step.get("id"))
    }


def _all_required_steps_complete(plan: list[PlanStep]) -> bool:
    for step in plan:
        if step.get("required", True) and _step_status(step) != "complete":
            return False
    return True


def _dependencies_for(step: PlanStep) -> list[str]:
    depends_on = step.get("depends_on", [])
    if not isinstance(depends_on, list):
        return []
    return [str(item).strip() for item in depends_on if str(item).strip()]


def _step_status(step: PlanStep) -> str:
    return _normalize_text(step.get("status", "pending")).lower() or "pending"


def _step_label(step: PlanStep, index: int) -> str:
    step_id = _string_or_none(step.get("id"))
    return f"Step {step_id}" if step_id else f"Step at index {index}"


def _append_history(
    state: PlanningState, node: str, details: dict[str, Any]
) -> list[ExecutionEvent]:
    return [*state.get("execution_history", []), {"node": node, "details": details}]


def _normalize_source_notes(source_notes: list[SourceNote]) -> list[SourceNote]:
    normalized: list[SourceNote] = []
    for index, note in enumerate(source_notes, start=1):
        if not isinstance(note, dict):
            continue
        source_id = _normalize_text(note.get("source_id") or f"note_{index}")
        text = _normalize_text(note.get("text") or note.get("summary") or "")
        summary = _normalize_text(note.get("summary") or _first_sentence(text))
        normalized.append(
            {
                "source_id": source_id,
                "title": _normalize_text(note.get("title", "")),
                "text": text,
                "summary": summary,
            }
        )
    return normalized


def _first_sentence(text: str) -> str:
    normalized = _normalize_text(text)
    if not normalized:
        return ""
    return re.split(r"(?<=[.!?])\s+", normalized)[0]


def _significant_tokens(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
        if len(token) >= 4 and token not in STOPWORDS
    ]


def _strip_code_fence(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = _normalize_text(value)
    return text or None


def _dict_or_empty(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    return {}


def _json_dumps(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True)


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def _coerce_positive_int(value: Any, default: int) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return default


def _merge_unique(existing: list[str], new_items: list[str]) -> list[str]:
    merged = list(existing)
    seen = set(existing)
    for item in new_items:
        if item not in seen:
            merged.append(item)
            seen.add(item)
    return merged
