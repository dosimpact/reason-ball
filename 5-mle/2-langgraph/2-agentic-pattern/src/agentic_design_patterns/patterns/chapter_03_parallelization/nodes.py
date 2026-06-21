from __future__ import annotations

import json
import re
import time
import uuid
from typing import Any, Callable

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_03_parallelization.prompts import (
    KEY_TERMS_SYSTEM_PROMPT,
    KEY_TERMS_USER_PROMPT,
    QUESTIONS_SYSTEM_PROMPT,
    QUESTIONS_USER_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    SUMMARY_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_03_parallelization.state import (
    BranchError,
    BranchResult,
    ParallelizationState,
)
from agentic_design_patterns.shared.models import get_chat_model


MIN_TOPIC_CHARS = 3
DEFAULT_BRANCH_RETRY_LIMIT = 1
BRANCH_NAMES = ("summary", "questions", "key_terms")


def initialize(state: ParallelizationState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    topic = _normalize_text("" if raw_input is None else str(raw_input))
    retry_limit = _coerce_non_negative_int(
        state.get("branch_retry_limit", DEFAULT_BRANCH_RETRY_LIMIT),
        DEFAULT_BRANCH_RETRY_LIMIT,
    )
    allow_partial_synthesis = bool(state.get("allow_partial_synthesis", True))
    run_id = uuid.uuid4().hex
    metadata = _metadata(state)
    metadata.update(
        {
            "pattern": "parallelization",
            "run_id": run_id,
            "branch_count": len(BRANCH_NAMES),
            "allow_partial_synthesis": allow_partial_synthesis,
            "branch_retry_limit": retry_limit,
            "input_length": len(topic),
        }
    )

    initialized: dict[str, Any] = {
        "input": topic,
        "branch_outputs": {},
        "summary": None,
        "questions": [],
        "key_terms": [],
        "branch_errors": [],
        "completed_branches": [],
        "started_at": time.perf_counter(),
        "metadata": metadata,
        "allow_partial_synthesis": allow_partial_synthesis,
        "branch_retry_limit": retry_limit,
        "failure_reason": None,
    }

    if not topic:
        initialized.update(
            {
                "status": "failed",
                "failure_reason": "Input topic is empty.",
            }
        )
        return initialized

    if len(topic) < MIN_TOPIC_CHARS:
        initialized.update(
            {
                "status": "failed",
                "failure_reason": (
                    f"Input topic must be at least {MIN_TOPIC_CHARS} characters."
                ),
            }
        )
        return initialized

    initialized["status"] = "ok"
    return initialized


def fan_out_branches(state: ParallelizationState) -> dict[str, Any]:
    return {}


def collect_branch_outputs(state: ParallelizationState) -> dict[str, Any]:
    return {
        "summary": _branch_values(state)["summary"],
        "questions": _branch_values(state)["questions"],
        "key_terms": _branch_values(state)["key_terms"],
        "branch_errors": _branch_errors(state),
        "completed_branches": _completed_branches(state),
    }


def summarize_topic(state: ParallelizationState) -> dict[str, Any]:
    result = _run_branch(
        state,
        branch="summary",
        system_prompt=SUMMARY_SYSTEM_PROMPT,
        user_prompt=SUMMARY_USER_PROMPT.format(topic=state.get("input", "")),
        parser=lambda content: _normalize_text(content),
    )
    return _branch_update("summary", result)


def generate_questions(state: ParallelizationState) -> dict[str, Any]:
    result = _run_branch(
        state,
        branch="questions",
        system_prompt=QUESTIONS_SYSTEM_PROMPT,
        user_prompt=QUESTIONS_USER_PROMPT.format(topic=state.get("input", "")),
        parser=_parse_list_response,
    )
    return _branch_update("questions", result)


def extract_key_terms(state: ParallelizationState) -> dict[str, Any]:
    result = _run_branch(
        state,
        branch="key_terms",
        system_prompt=KEY_TERMS_SYSTEM_PROMPT,
        user_prompt=KEY_TERMS_USER_PROMPT.format(topic=state.get("input", "")),
        parser=_parse_list_response,
    )
    return _branch_update("key_terms", result)


def synthesize_answer(state: ParallelizationState) -> dict[str, Any]:
    branch_values = _branch_values(state)
    branch_errors = _branch_errors(state)
    completed_branches = _completed_branches(state)
    missing = _missing_required_outputs(branch_values)
    metadata = _metadata(state)
    metadata["elapsed_seconds"] = _elapsed_seconds(state)
    metadata["missing_branches"] = missing

    if missing and not state.get("allow_partial_synthesis", True):
        return {
            "status": "failed",
            "failure_reason": (
                "Required branch output missing and partial synthesis is disabled: "
                + ", ".join(missing)
                + "."
            ),
            "metadata": metadata,
        }

    status = "partial" if missing or branch_errors else "ok"
    final_answer = _format_final_answer(
        state,
        branch_values,
        branch_errors,
        missing,
        status,
    )
    return {
        "status": status,
        "summary": branch_values["summary"],
        "questions": branch_values["questions"],
        "key_terms": branch_values["key_terms"],
        "branch_errors": branch_errors,
        "completed_branches": completed_branches,
        "final_answer": final_answer,
        "metadata": metadata,
    }


def handle_failure(state: ParallelizationState) -> dict[str, Any]:
    reason = state.get("failure_reason") or "Parallel analysis failed."
    branch_values = _branch_values(state)
    branch_errors = _branch_errors(state)
    completed_branches = _completed_branches(state)
    metadata = _metadata(state)
    metadata["elapsed_seconds"] = _elapsed_seconds(state)
    return {
        "status": "failed",
        "summary": branch_values["summary"],
        "questions": branch_values["questions"],
        "key_terms": branch_values["key_terms"],
        "branch_errors": branch_errors,
        "completed_branches": completed_branches,
        "final_answer": _format_failure_answer(
            state,
            branch_values,
            branch_errors,
            reason,
        ),
        "metadata": metadata,
    }


def _run_branch(
    state: ParallelizationState,
    *,
    branch: str,
    system_prompt: str,
    user_prompt: str,
    parser: Callable[[str], Any],
) -> dict[str, Any]:
    attempts = 0
    retry_limit = _coerce_non_negative_int(
        state.get("branch_retry_limit", DEFAULT_BRANCH_RETRY_LIMIT),
        DEFAULT_BRANCH_RETRY_LIMIT,
    )
    last_error: Exception | None = None

    for attempts in range(1, retry_limit + 2):
        try:
            content = _invoke_model(system_prompt, user_prompt)
            return {
                "value": parser(content),
                "attempts": attempts,
                "run_id": _run_id(state),
            }
        except Exception as exc:  # pragma: no cover - provider error types vary.
            last_error = exc

    error: BranchError = {
        "branch": branch,
        "message": str(last_error),
        "attempts": attempts,
    }
    return {"error": error, "run_id": _run_id(state)}


def _branch_update(branch: str, result: dict[str, Any]) -> dict[str, Any]:
    if "error" in result:
        branch_result: BranchResult = {
            "run_id": result["run_id"],
            "error": result["error"],
            "attempts": result["error"]["attempts"],
        }
    else:
        branch_result = {
            "run_id": result["run_id"],
            "value": result["value"],
            "attempts": result["attempts"],
        }
    return {"branch_outputs": {branch: branch_result}}


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


def _parse_list_response(content: str) -> list[str]:
    text = _strip_code_fence(content)
    parsed = _parse_json_list(text)
    if parsed:
        return parsed

    items: list[str] = []
    for line in text.splitlines():
        item = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip()
        if item:
            items.append(item)

    if len(items) == 1 and "," in items[0]:
        items = [item.strip() for item in items[0].split(",") if item.strip()]

    return items


def _parse_json_list(text: str) -> list[str]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return []

    if isinstance(parsed, list):
        return [str(item).strip() for item in parsed if str(item).strip()]

    if isinstance(parsed, dict):
        for key in ("questions", "key_terms", "terms", "items"):
            value = parsed.get(key)
            if isinstance(value, list):
                return [str(item).strip() for item in value if str(item).strip()]

    return []


def _strip_code_fence(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _branch_values(state: ParallelizationState) -> dict[str, Any]:
    outputs = _current_branch_outputs(state)
    return {
        "summary": outputs.get("summary", {}).get("value"),
        "questions": outputs.get("questions", {}).get("value", []),
        "key_terms": outputs.get("key_terms", {}).get("value", []),
    }


def _branch_errors(state: ParallelizationState) -> list[BranchError]:
    errors: list[BranchError] = []
    outputs = _current_branch_outputs(state)
    for branch in BRANCH_NAMES:
        error = outputs.get(branch, {}).get("error")
        if error:
            errors.append(error)
    return errors


def _completed_branches(state: ParallelizationState) -> list[str]:
    completed: list[str] = []
    outputs = _current_branch_outputs(state)
    for branch in BRANCH_NAMES:
        if "value" in outputs.get(branch, {}):
            completed.append(branch)
    return completed


def _current_branch_outputs(state: ParallelizationState) -> dict[str, BranchResult]:
    run_id = _run_id(state)
    if not run_id:
        return dict(state.get("branch_outputs", {}))
    return {
        branch: result
        for branch, result in state.get("branch_outputs", {}).items()
        if result.get("run_id") == run_id
    }


def _missing_required_outputs(branch_values: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not _normalize_text(branch_values.get("summary") or ""):
        missing.append("summary")
    if not branch_values.get("questions"):
        missing.append("questions")
    if not branch_values.get("key_terms"):
        missing.append("key_terms")
    return missing


def _format_final_answer(
    state: ParallelizationState,
    branch_values: dict[str, Any],
    branch_errors: list[BranchError],
    missing: list[str],
    status: str,
) -> str:
    topic = state.get("input", "")
    summary = branch_values.get("summary") or (
        "Unavailable - summary branch did not complete."
    )
    questions = _format_items(
        branch_values.get("questions", []),
        "Unavailable - questions branch did not complete.",
    )
    key_terms = _format_items(
        branch_values.get("key_terms", []),
        "Unavailable - key terms branch did not complete.",
    )
    errors = _format_branch_errors(branch_errors)

    if status == "partial":
        conclusion = (
            "This is a partial synthesis based only on completed branches. "
            "Rerun missing branches before relying on the unavailable sections."
        )
    else:
        conclusion = (
            "The branch outputs provide a compact topic overview, useful next "
            "questions, and terms to guide deeper research."
        )

    return "\n".join(
        [
            f"Topic: {topic}",
            "",
            "Summary:",
            summary,
            "",
            "Follow-up Questions:",
            questions,
            "",
            "Key Terms:",
            key_terms,
            "",
            "Conclusion:",
            conclusion,
            "",
            "Missing Branches:",
            ", ".join(missing) if missing else "None",
            "",
            "Branch Errors:",
            errors,
        ]
    )


def _format_failure_answer(
    state: ParallelizationState,
    branch_values: dict[str, Any],
    branch_errors: list[BranchError],
    reason: str,
) -> str:
    return "\n".join(
        [
            "Parallel topic analyzer failed before it could safely synthesize.",
            f"Reason: {reason}",
            "",
            "Available Branch Outputs:",
            f"- Summary: {branch_values.get('summary') or 'Unavailable'}",
            "- Questions: "
            + (
                ", ".join(branch_values.get("questions", []))
                if branch_values.get("questions")
                else "Unavailable"
            ),
            "- Key Terms: "
            + (
                ", ".join(branch_values.get("key_terms", []))
                if branch_values.get("key_terms")
                else "Unavailable"
            ),
            "",
            "Branch Errors:",
            _format_branch_errors(branch_errors),
        ]
    )


def _format_items(items: list[str], missing_message: str) -> str:
    if not items:
        return missing_message
    return "\n".join(f"- {item}" for item in items)


def _format_branch_errors(errors: list[BranchError]) -> str:
    if not errors:
        return "None"
    return "\n".join(
        f"- {error['branch']}: {error['message']} "
        f"(attempts: {error['attempts']})"
        for error in errors
    )


def _elapsed_seconds(state: ParallelizationState) -> float | None:
    started_at = state.get("started_at")
    if started_at is None:
        return None
    return round(time.perf_counter() - started_at, 6)


def _metadata(state: ParallelizationState) -> dict[str, Any]:
    metadata = state.get("metadata", {})
    if isinstance(metadata, dict):
        return dict(metadata)
    return {}


def _run_id(state: ParallelizationState) -> str | None:
    value = _metadata(state).get("run_id")
    if isinstance(value, str) and value:
        return value
    return None


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default
