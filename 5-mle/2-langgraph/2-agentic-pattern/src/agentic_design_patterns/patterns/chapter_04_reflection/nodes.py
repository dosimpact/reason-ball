from __future__ import annotations

import ast
import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_04_reflection.prompts import (
    CRITIC_SYSTEM_PROMPT,
    CRITIC_USER_PROMPT,
    DEFAULT_FACTORIAL_REQUIREMENTS,
    DEFAULT_FACTORIAL_TASK,
    INITIAL_DRAFT_USER_PROMPT,
    PRODUCER_SYSTEM_PROMPT,
    REVISION_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_04_reflection.state import (
    CritiqueStatus,
    ReflectionState,
    RevisionHistoryEntry,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_MAX_ITERATIONS = 3
MAX_TASK_CHARS = 6000


def prepare_task(state: ReflectionState) -> dict[str, Any]:
    raw_input = state.get("input")
    errors = list(state.get("errors", []))
    metadata = _metadata(state)
    metadata.update(
        {
            "pattern": "reflection",
            "example": "reflection_code_reviewer",
            "prompt_version": "chapter_04_reflection_v1",
        }
    )

    task = DEFAULT_FACTORIAL_TASK if raw_input is None else _normalize_text(str(raw_input))
    if raw_input is not None and not task:
        errors.append("Input is empty.")
        return {
            "input": "",
            "requirements": _requirements(state),
            "current_draft": None,
            "critique": None,
            "critique_status": None,
            "iteration": 0,
            "max_iterations": _coerce_positive_int(
                state.get("max_iterations", DEFAULT_MAX_ITERATIONS),
                DEFAULT_MAX_ITERATIONS,
            ),
            "revision_history": [],
            "errors": errors,
            "status": "failed",
            "metadata": metadata,
        }

    if len(task) > MAX_TASK_CHARS:
        task = task[:MAX_TASK_CHARS].rstrip()
        errors.append(f"Input was truncated to {MAX_TASK_CHARS} characters.")

    return {
        "input": task,
        "requirements": _requirements(state),
        "current_draft": None,
        "critique": None,
        "critique_status": None,
        "iteration": 0,
        "max_iterations": _coerce_positive_int(
            state.get("max_iterations", DEFAULT_MAX_ITERATIONS),
            DEFAULT_MAX_ITERATIONS,
        ),
        "revision_history": [],
        "errors": errors,
        "status": None,
        "final_output": None,
        "metadata": metadata,
    }


def generate_initial_draft(state: ReflectionState) -> dict[str, Any]:
    try:
        content = _invoke_model(
            PRODUCER_SYSTEM_PROMPT,
            INITIAL_DRAFT_USER_PROMPT.format(
                task=state.get("input", DEFAULT_FACTORIAL_TASK),
                requirements=_format_requirements(state.get("requirements", [])),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        return _runtime_failure(state, "generate_initial_draft", exc)

    return _draft_update(
        state,
        step="generate_initial_draft",
        content=content,
        iteration=1,
    )


def critique_draft(state: ReflectionState) -> dict[str, Any]:
    current_draft = state.get("current_draft")
    if not current_draft:
        errors = [*state.get("errors", []), "Cannot critique without a draft."]
        return {
            "status": "failed",
            "critique_status": "invalid",
            "critique": "Cannot critique without a draft.",
            "errors": errors,
            "revision_history": _append_history(
                state,
                {
                    "step": "critique_draft",
                    "iteration": state.get("iteration", 0),
                    "critique": "Cannot critique without a draft.",
                    "critique_status": "invalid",
                    "errors": errors,
                },
            ),
        }

    static_check_results = _factorial_static_checks(current_draft)

    try:
        content = _invoke_model(
            CRITIC_SYSTEM_PROMPT,
            CRITIC_USER_PROMPT.format(
                task=state.get("input", DEFAULT_FACTORIAL_TASK),
                requirements=_format_requirements(state.get("requirements", [])),
                current_draft=current_draft,
                static_check_results=json.dumps(static_check_results, indent=2),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        errors = [
            *state.get("errors", []),
            f"critique_draft model invocation failed: {exc}",
        ]
        critique = "Critic model invocation failed."
        return {
            "critique": critique,
            "critique_status": "invalid",
            "raw_critic_output": None,
            "static_check_results": static_check_results,
            "errors": errors,
            "revision_history": _append_history(
                state,
                {
                    "step": "critique_draft",
                    "iteration": state.get("iteration", 0),
                    "critique": critique,
                    "critique_status": "invalid",
                    "static_check_results": static_check_results,
                    "errors": errors,
                },
            ),
        }

    status, critique, parse_errors = _parse_critic_output(content)
    errors = [*state.get("errors", []), *parse_errors]
    return {
        "critique": critique,
        "critique_status": status,
        "raw_critic_output": content,
        "static_check_results": static_check_results,
        "errors": errors,
        "revision_history": _append_history(
            state,
            {
                "step": "critique_draft",
                "iteration": state.get("iteration", 0),
                "critique": critique,
                "critique_status": status,
                "static_check_results": static_check_results,
                "raw_critic_output": content,
                "errors": parse_errors,
            },
        ),
    }


def refine_draft(state: ReflectionState) -> dict[str, Any]:
    iteration = state.get("iteration", 0)
    max_iterations = state.get("max_iterations", DEFAULT_MAX_ITERATIONS)
    if iteration >= max_iterations:
        return {
            "critique_status": "invalid",
            "errors": [
                *state.get("errors", []),
                "Refinement requested after max_iterations was reached.",
            ],
        }

    current_draft = state.get("current_draft")
    if not current_draft:
        return {
            "status": "failed",
            "critique_status": "invalid",
            "errors": [*state.get("errors", []), "Cannot refine without a draft."],
        }

    next_iteration = iteration + 1
    try:
        content = _invoke_model(
            PRODUCER_SYSTEM_PROMPT,
            REVISION_USER_PROMPT.format(
                task=state.get("input", DEFAULT_FACTORIAL_TASK),
                requirements=_format_requirements(state.get("requirements", [])),
                current_draft=current_draft,
                critique=state.get("critique", ""),
                revision_history=_format_history(state),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        errors = [
            *state.get("errors", []),
            f"refine_draft model invocation failed: {exc}",
        ]
        return {
            "critique_status": "invalid",
            "errors": errors,
            "revision_history": _append_history(
                state,
                {
                    "step": "refine_draft",
                    "iteration": next_iteration,
                    "draft": current_draft,
                    "critique": state.get("critique"),
                    "critique_status": "invalid",
                    "errors": errors,
                },
            ),
        }

    return _draft_update(
        state,
        step="refine_draft",
        content=content,
        iteration=next_iteration,
    )


def finalize(state: ReflectionState) -> dict[str, Any]:
    final_output = _final_output(state, status="ok", accepted=True)
    metadata = _metadata(state)
    metadata["completed_reason"] = "critic accepted draft"
    return {
        "status": "ok",
        "final_output": final_output,
        "metadata": metadata,
    }


def mark_needs_review(state: ReflectionState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    if (
        state.get("critique_status") == "needs_revision"
        and state.get("iteration", 0) >= state.get("max_iterations", DEFAULT_MAX_ITERATIONS)
        and "max_iterations reached before acceptance" not in errors
    ):
        errors.append("max_iterations reached before acceptance")

    final_state: ReflectionState = {**state, "errors": errors, "status": "needs_review"}
    return {
        "status": "needs_review",
        "errors": errors,
        "final_output": _final_output(final_state, status="needs_review", accepted=False),
    }


def handle_failure(state: ReflectionState) -> dict[str, Any]:
    errors = list(state.get("errors", [])) or ["Reflection workflow failed."]
    final_state: ReflectionState = {**state, "errors": errors, "status": "failed"}
    return {
        "status": "failed",
        "errors": errors,
        "final_output": _final_output(final_state, status="failed", accepted=False),
    }


def _draft_update(
    state: ReflectionState,
    *,
    step: str,
    content: str,
    iteration: int,
) -> dict[str, Any]:
    draft = _extract_python_code(content)
    errors = list(state.get("errors", []))

    if not draft:
        errors.append(f"{step} returned no draft.")
        return {
            "status": "failed",
            "current_draft": None,
            "critique_status": "invalid",
            "errors": errors,
        }

    static_check_results = _factorial_static_checks(draft)
    history_entry: RevisionHistoryEntry = {
        "step": step,
        "iteration": iteration,
        "draft": draft,
        "static_check_results": static_check_results,
    }

    if not _contains_function_definition(draft):
        errors.append(f"{step} returned an unusable draft without a function definition.")
        history_entry["errors"] = [errors[-1]]
        return {
            "current_draft": draft,
            "critique_status": "invalid",
            "iteration": iteration,
            "static_check_results": static_check_results,
            "errors": errors,
            "revision_history": _append_history(state, history_entry),
        }

    return {
        "current_draft": draft,
        "critique_status": None,
        "iteration": iteration,
        "static_check_results": static_check_results,
        "revision_history": _append_history(state, history_entry),
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


def _parse_critic_output(raw_output: str) -> tuple[CritiqueStatus, str, list[str]]:
    text = _strip_code_fence(raw_output)
    if text.strip().upper() == "CODE_IS_PERFECT":
        return "accepted", "Accepted: all requirements are satisfied.", []

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return (
            "invalid",
            "Critic output could not be normalized.",
            ["Critic output could not be normalized."],
        )

    if not isinstance(parsed, dict):
        return (
            "invalid",
            "Critic output must be a JSON object.",
            ["Critic output must be a JSON object."],
        )

    raw_status = parsed.get("status")
    status = _normalize_critique_status(raw_status)
    critique = _normalize_text(str(parsed.get("critique") or parsed.get("feedback") or ""))

    if status is None:
        return (
            "invalid",
            critique or "Critic output is missing a valid status.",
            [f"Critic output has unsupported status: {raw_status!r}."],
        )

    if not critique:
        critique = (
            "Accepted: all requirements are satisfied."
            if status == "accepted"
            else "Revision requested without detailed feedback."
        )

    return status, critique, []


def _normalize_critique_status(value: Any) -> CritiqueStatus | None:
    if not isinstance(value, str):
        return None

    normalized = re.sub(r"[\s-]+", "_", value.strip().lower())
    if normalized in {"accepted", "accept", "approved", "ok", "pass", "perfect"}:
        return "accepted"
    if normalized in {
        "needs_revision",
        "needs_revisions",
        "revision_needed",
        "revise",
        "changes_requested",
        "needs_changes",
    }:
        return "needs_revision"
    if normalized == "invalid":
        return "invalid"
    return None


def _extract_python_code(content: str) -> str:
    text = str(content).strip()
    if not text:
        return ""

    fenced = re.search(r"```(?:python|py)?\s*(.*?)```", text, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        return fenced.group(1).strip()
    return text


def _strip_code_fence(raw_text: str) -> str:
    text = str(raw_text).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _contains_function_definition(draft: str) -> bool:
    try:
        tree = ast.parse(draft)
    except SyntaxError:
        return bool(re.search(r"^\s*def\s+\w+\s*\(", draft, flags=re.MULTILINE))
    return any(isinstance(node, ast.FunctionDef) for node in ast.walk(tree))


def _factorial_static_checks(draft: str) -> dict[str, Any]:
    checks: dict[str, Any] = {
        "syntax_valid": False,
        "defines_calculate_factorial": False,
        "has_docstring": False,
        "handles_zero": False,
        "raises_value_error_for_negative": False,
    }

    try:
        tree = ast.parse(draft)
    except SyntaxError as exc:
        checks["syntax_error"] = f"{exc.msg} at line {exc.lineno}"
        return checks

    checks["syntax_valid"] = True
    function = next(
        (
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.FunctionDef) and node.name == "calculate_factorial"
        ),
        None,
    )
    if function is None:
        return checks

    checks["defines_calculate_factorial"] = True
    checks["has_docstring"] = ast.get_docstring(function) is not None
    source = _normalize_text(draft)
    checks["handles_zero"] = bool(
        re.search(r"\bn\s*==\s*0\b", source)
        or re.search(r"\bn\s+in\s+\(\s*0\s*,\s*1\s*\)", source)
        or re.search(r"\bn\s*<=\s*1\b", source)
    )
    checks["raises_value_error_for_negative"] = bool(
        "ValueError" in source and re.search(r"\bn\s*<\s*0\b", source)
    )
    return checks


def _final_output(
    state: ReflectionState,
    *,
    status: str,
    accepted: bool,
) -> dict[str, Any]:
    return {
        "status": status,
        "accepted": accepted,
        "iterations": state.get("iteration", 0),
        "final_code": state.get("current_draft"),
        "final_critique": state.get("critique"),
        "critique_status": state.get("critique_status"),
        "errors": state.get("errors", []),
        "revision_history": state.get("revision_history", []),
        "static_check_results": state.get("static_check_results"),
    }


def _runtime_failure(
    state: ReflectionState,
    step: str,
    exc: Exception,
) -> dict[str, Any]:
    error = f"{step} model invocation failed: {exc}"
    return {
        "status": "failed",
        "critique_status": "invalid",
        "errors": [*state.get("errors", []), error],
        "revision_history": _append_history(
            state,
            {
                "step": step,
                "iteration": state.get("iteration", 0),
                "errors": [error],
            },
        ),
    }


def _append_history(
    state: ReflectionState,
    entry: RevisionHistoryEntry,
) -> list[RevisionHistoryEntry]:
    return [*state.get("revision_history", []), entry]


def _requirements(state: ReflectionState) -> list[str]:
    supplied = state.get("requirements")
    if not supplied:
        return list(DEFAULT_FACTORIAL_REQUIREMENTS)

    cleaned = [_normalize_text(str(item)) for item in supplied if _normalize_text(str(item))]
    return cleaned or list(DEFAULT_FACTORIAL_REQUIREMENTS)


def _format_requirements(requirements: list[str]) -> str:
    if not requirements:
        requirements = list(DEFAULT_FACTORIAL_REQUIREMENTS)
    return "\n".join(f"- {requirement}" for requirement in requirements)


def _format_history(state: ReflectionState) -> str:
    history = state.get("revision_history", [])
    if not history:
        return "No prior revisions."
    return json.dumps(history[-6:], indent=2)


def _metadata(state: ReflectionState) -> dict[str, Any]:
    metadata = state.get("metadata", {})
    if isinstance(metadata, dict):
        return dict(metadata)
    return {}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _coerce_positive_int(value: Any, default: int) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return default
