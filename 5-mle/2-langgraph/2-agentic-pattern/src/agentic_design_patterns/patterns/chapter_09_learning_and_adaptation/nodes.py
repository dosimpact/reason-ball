from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_09_learning_and_adaptation.prompts import (
    SUPPORT_RESPONSE_SYSTEM_PROMPT,
    SUPPORT_RESPONSE_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_09_learning_and_adaptation.state import (
    LearningAdaptationState,
    StrategyLabel,
    TaskCategory,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_MAX_RETRIES = 1
DEFAULT_SCORE_THRESHOLD = 0.75
MAX_INPUT_CHARS = 4000
MAX_ARCHIVE_MATCHES = 3
ALLOWED_ADAPTATION_ACTIONS = {"reinforce_strategy", "record_failure_only"}
HIGH_RISK_TERMS = {
    "account takeover",
    "admin",
    "billing access",
    "burning",
    "delete account",
    "electric shock",
    "fire",
    "password reset",
    "privileged",
    "refund",
    "security",
    "smoke",
    "sparking",
}
UNSUPPORTED_ACTION_TERMS = {
    "factory reset",
    "guaranteed",
    "replace the motherboard",
    "delete your account",
    "disable security",
    "bypass",
}


def preprocess_input(state: LearningAdaptationState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    normalized_input = _normalize_text("" if raw_input is None else str(raw_input))
    errors = list(state.get("errors", []))
    max_retries = _coerce_non_negative_int(
        state.get("max_retries", _metadata(state).get("max_retries")),
        DEFAULT_MAX_RETRIES,
    )

    updates: dict[str, Any] = {
        "normalized_input": normalized_input[:MAX_INPUT_CHARS].rstrip(),
        "retry_count": _coerce_non_negative_int(state.get("retry_count", 0), 0),
        "max_retries": max_retries,
        "errors": errors,
        "needs_human_review": bool(state.get("needs_human_review", False)),
        "experience_matches": list(state.get("experience_matches", [])),
        "strategy_profile": dict(state.get("strategy_profile", {})),
        "feedback_summary": dict(state.get("feedback_summary", {})),
        "evaluation": dict(state.get("evaluation", {})),
        "archive_update": state.get("archive_update"),
        "rollback_record": state.get("rollback_record"),
        "status": state.get("status", "ok"),
    }

    if not normalized_input:
        errors.append("Input is empty.")
        updates.update(
            {
                "status": "failed",
                "needs_human_review": True,
                "selected_strategy": "clarify_first",
                "strategy_reason": "The support request is blank.",
                "evaluation": {
                    "score": 0.0,
                    "threshold": _score_threshold(state),
                    "passed": False,
                    "notes": ["Input is empty."],
                    "safety_flags": [],
                    "unsupported_claims": [],
                    "missing_information": ["support request"],
                    "recoverable": False,
                    "performance": {
                        "relevance": 0.0,
                        "actionability": 0.0,
                        "safety": 1.0,
                    },
                },
                "adaptation_record": {
                    "outcome": "failed",
                    "lesson": "No adaptation was applied because the input was blank.",
                    "score": 0.0,
                },
                "applied_adaptation": {
                    "applied": False,
                    "reason": "Blank input is not a valid learning signal.",
                },
            }
        )

    if len(normalized_input) > MAX_INPUT_CHARS:
        errors.append(f"Input was truncated to {MAX_INPUT_CHARS} characters.")

    return updates


def classify_task(state: LearningAdaptationState) -> dict[str, Any]:
    text = state.get("normalized_input", "").lower()

    if _contains_any(text, {"wifi", "wi-fi", "network", "router", "internet", "bluetooth", "connect"}):
        category: TaskCategory = "connectivity"
    elif _contains_any(text, {"login", "password", "account", "billing", "subscription"}):
        category = "account"
    elif _contains_any(text, {"app", "software", "install", "update", "crash", "error"}):
        category = "software"
    elif _contains_any(text, {"battery", "screen", "printer", "keyboard", "laptop", "device"}):
        category = "hardware"
    else:
        category = "unknown"

    return {"task_category": category}


def retrieve_experience(state: LearningAdaptationState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    retriever = state.get("memory_retriever")

    try:
        if callable(retriever):
            records = retriever(state)
        else:
            records = _default_retrieve_from_archive(state)
    except Exception as exc:
        records = []
        errors.append(f"retrieve_experience failed: {exc}")

    matches = _normalize_records(records)[:MAX_ARCHIVE_MATCHES]
    strategy_profile = _build_strategy_profile(matches, state.get("strategy_profile", {}))

    return {
        "experience_matches": matches,
        "strategy_profile": strategy_profile,
        "errors": errors,
    }


def select_strategy(state: LearningAdaptationState) -> dict[str, Any]:
    normalized_input = state.get("normalized_input", "")
    category = state.get("task_category") or "unknown"
    matches = state.get("experience_matches", [])

    if _needs_immediate_review(normalized_input):
        return {
            "selected_strategy": "escalate",
            "strategy_reason": (
                "The request may involve safety, security, or privileged account "
                "action, so automatic adaptation is bounded by review."
            ),
        }

    best_match = _best_successful_match(matches)
    if best_match is not None:
        strategy = _strategy_or_default(best_match.get("strategy"), category)
        return {
            "selected_strategy": strategy,
            "strategy_reason": (
                f"Similar prior {category} cases succeeded with "
                f"{strategy.replace('_', ' ')}."
            ),
        }

    if _has_low_information(normalized_input):
        return {
            "selected_strategy": "clarify_first",
            "strategy_reason": "The request lacks enough concrete detail to troubleshoot safely.",
        }

    if category in {"connectivity", "software", "hardware", "unknown"}:
        return {
            "selected_strategy": "diagnostic_steps",
            "strategy_reason": (
                "No reliable prior case was found, so use a reversible diagnostic "
                "checklist before escalation."
            ),
        }

    return {
        "selected_strategy": "clarify_first",
        "strategy_reason": "Account-related requests need identity-safe clarification first.",
    }


def generate_response(state: LearningAdaptationState) -> dict[str, Any]:
    generator = state.get("response_generator")
    errors = list(state.get("errors", []))

    try:
        if callable(generator):
            draft = generator(state)
        else:
            draft = _invoke_model(
                SUPPORT_RESPONSE_SYSTEM_PROMPT,
                SUPPORT_RESPONSE_USER_PROMPT.format(
                    normalized_input=state.get("normalized_input", ""),
                    task_category=state.get("task_category") or "unknown",
                    selected_strategy=state.get("selected_strategy") or "diagnostic_steps",
                    strategy_reason=state.get("strategy_reason") or "No reason recorded.",
                    retry_count=state.get("retry_count", 0),
                    experience_lessons=_format_experience_lessons(
                        state.get("experience_matches", [])
                    ),
                    feedback_notes=_format_feedback_notes(state),
                ),
            )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        errors.append(f"generate_response model invocation failed: {exc}")
        draft = _fallback_response(state)

    return {
        "draft_output": _normalize_text(str(draft)),
        "errors": errors,
    }


def collect_feedback(state: LearningAdaptationState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    feedback = state.get("feedback", _metadata(state).get("feedback"))
    summary = _summarize_feedback(feedback, errors)
    return {
        "feedback_summary": summary,
        "errors": errors,
    }


def evaluate_response(state: LearningAdaptationState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    evaluator = state.get("evaluator")

    try:
        if callable(evaluator):
            raw_evaluation = evaluator(state)
        else:
            raw_evaluation = _heuristic_evaluate(state)
    except Exception as exc:
        raw_evaluation = {
            "score": 0.0,
            "passed": False,
            "notes": [f"Evaluator failed: {exc}"],
            "safety_flags": ["evaluator_failure"],
            "unsupported_claims": [],
            "missing_information": [],
            "recoverable": False,
            "performance": {
                "relevance": 0.0,
                "actionability": 0.0,
                "safety": 0.0,
            },
        }
        errors.append(f"evaluate_response failed: {exc}")

    evaluation, validation_errors = _normalize_evaluation(raw_evaluation, state)
    errors.extend(validation_errors)

    return {
        "evaluation": evaluation,
        "errors": errors,
        "status": "ok" if evaluation["passed"] else state.get("status", "ok"),
    }


def revise_strategy(state: LearningAdaptationState) -> dict[str, Any]:
    retry_count = state.get("retry_count", 0) + 1
    current_strategy = state.get("selected_strategy") or "diagnostic_steps"
    evaluation = state.get("evaluation", {})
    missing_information = evaluation.get("missing_information", [])

    if missing_information:
        revised_strategy: StrategyLabel = "clarify_first"
        reason = (
            "The evaluator found missing context, so the retry should ask for "
            "the specific detail instead of guessing."
        )
    elif current_strategy == "reuse_known_solution":
        revised_strategy = "diagnostic_steps"
        reason = (
            "The reused lesson was not strong enough; retry with a fresh "
            "diagnostic checklist."
        )
    elif current_strategy == "diagnostic_steps":
        revised_strategy = "diagnostic_steps"
        reason = (
            "The first draft scored low; retry with clearer ordered steps, "
            "checks, and escalation criteria."
        )
    else:
        revised_strategy = "diagnostic_steps"
        reason = "Retry with safer reversible diagnostics before any escalation."

    return {
        "retry_count": retry_count,
        "selected_strategy": revised_strategy,
        "strategy_reason": reason,
    }


def mark_needs_review(state: LearningAdaptationState) -> dict[str, Any]:
    evaluation = state.get("evaluation", {})
    reasons = _review_reasons(evaluation)
    if not reasons:
        reasons = ["The response did not meet the adaptation threshold."]

    review_response = (
        "I cannot safely finalize this support answer automatically. A human "
        "support reviewer should inspect the request, prior lessons, and draft "
        "before it is used. Review reasons: "
        + "; ".join(reasons)
        + "."
    )

    return {
        "needs_human_review": True,
        "status": "needs_review",
        "draft_output": review_response,
    }


def adapt_from_result(state: LearningAdaptationState) -> dict[str, Any]:
    evaluation = state.get("evaluation", {})
    success = bool(evaluation.get("passed")) and not state.get("needs_human_review", False)
    score = _coerce_score(evaluation.get("score"), 0.0)
    outcome = "success" if success else "needs_review"
    strategy = state.get("selected_strategy") or "diagnostic_steps"
    category = state.get("task_category") or "unknown"
    lesson = _learning_lesson(state, success)
    archive_record = {
        "user_namespace": _user_namespace(state),
        "input_summary": _redact_sensitive(_truncate(state.get("normalized_input", ""), 180)),
        "task_category": category,
        "strategy": strategy,
        "strategy_reason": state.get("strategy_reason"),
        "score": score,
        "outcome": outcome,
        "lesson": lesson,
        "feedback_summary": state.get("feedback_summary", {}),
        "retry_count": state.get("retry_count", 0),
        "needs_human_review": bool(state.get("needs_human_review", False)),
        "evaluation_notes": list(evaluation.get("notes", [])),
    }
    action = "reinforce_strategy" if success else "record_failure_only"
    safe_to_apply = (
        success
        and action in ALLOWED_ADAPTATION_ACTIONS
        and not evaluation.get("safety_flags")
        and not evaluation.get("unsupported_claims")
    )
    proposal = {
        "action": action,
        "strategy": strategy,
        "safe_to_apply": safe_to_apply,
        "reason": (
            "Evaluator passed without guardrail flags."
            if safe_to_apply
            else "Guardrails prevent reinforcing this strategy automatically."
        ),
        "profile_update": {
            "success_delta": 1 if success else 0,
            "failure_delta": 0 if success else 1,
            "score": score,
            "lesson": lesson,
        },
    }

    adaptation_record = {
        "outcome": outcome,
        "lesson": lesson,
        "score": score,
        "strategy": strategy,
        "proposal_action": action,
        "safe_to_apply": safe_to_apply,
    }

    return {
        "adaptation_record": adaptation_record,
        "adaptation_proposal": proposal,
        "archive_update": archive_record,
    }


def apply_adaptation(state: LearningAdaptationState) -> dict[str, Any]:
    proposal = dict(state.get("adaptation_proposal", {}))
    action = proposal.get("action")
    profile = dict(state.get("strategy_profile", {}))

    if action not in ALLOWED_ADAPTATION_ACTIONS:
        return _rollback_update(
            state,
            profile,
            f"Unsupported adaptation action: {action!r}.",
        )

    if not proposal.get("safe_to_apply", False):
        return _rollback_update(
            state,
            profile,
            proposal.get("reason") or "Adaptation proposal was not safe to apply.",
        )

    strategy = str(proposal.get("strategy") or state.get("selected_strategy") or "diagnostic_steps")
    profile_update = proposal.get("profile_update", {})
    updated_profile = _apply_profile_update(profile, strategy, profile_update)

    return {
        "strategy_profile": updated_profile,
        "applied_adaptation": {
            "applied": True,
            "action": action,
            "strategy": strategy,
            "score": profile_update.get("score"),
        },
        "rollback_record": None,
    }


def persist_adaptation(state: LearningAdaptationState) -> dict[str, Any]:
    archive_update = state.get("archive_update")
    if not archive_update:
        return {"archive_update": None}

    errors = list(state.get("errors", []))
    persister = state.get("memory_persister")
    persisted_record = dict(archive_update)

    if callable(persister):
        try:
            persister(persisted_record, state)
            persisted_record["persistence_status"] = "persisted"
            return {"archive_update": persisted_record, "errors": errors}
        except Exception as exc:
            errors.append(f"persist_adaptation failed: {exc}")
            persisted_record["persistence_status"] = "failed"
            return {"archive_update": persisted_record, "errors": errors}

    archive = list(state.get("experience_archive", []))
    archive.append(persisted_record)
    persisted_record["persistence_status"] = "in_state"
    return {
        "archive_update": persisted_record,
        "experience_archive": archive,
        "errors": errors,
    }


def finalize(state: LearningAdaptationState) -> dict[str, Any]:
    status: str
    if state.get("status") == "failed":
        status = "failed"
    elif state.get("needs_human_review"):
        status = "needs_review"
    else:
        status = "ok"

    answer = state.get("draft_output")
    if not answer:
        answer = (
            "Please provide a concrete technical support request so the adaptive "
            "workflow can evaluate and learn from the outcome."
        )

    final_output = {
        "status": status,
        "answer": answer,
        "selected_strategy": state.get("selected_strategy"),
        "strategy_reason": state.get("strategy_reason"),
        "task_category": state.get("task_category"),
        "evaluation": state.get("evaluation", {}),
        "feedback_summary": state.get("feedback_summary", {}),
        "adaptation_record": state.get("adaptation_record", {}),
        "adaptation_proposal": state.get("adaptation_proposal", {}),
        "applied_adaptation": state.get("applied_adaptation", {}),
        "rollback_record": state.get("rollback_record"),
        "archive_update": state.get("archive_update"),
        "retry_count": state.get("retry_count", 0),
        "needs_human_review": bool(state.get("needs_human_review", False)),
        "errors": state.get("errors", []),
    }
    return {"final_output": final_output, "status": status}


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


def _heuristic_evaluate(state: LearningAdaptationState) -> dict[str, Any]:
    draft = state.get("draft_output") or ""
    draft_lower = draft.lower()
    request_lower = state.get("normalized_input", "").lower()
    category = state.get("task_category") or "unknown"
    threshold = _score_threshold(state)

    relevance = 0.55
    actionability = 0.45
    safety = 1.0
    notes: list[str] = []

    if _contains_any(draft_lower, _category_terms(category)):
        relevance += 0.2
        notes.append("response references the task category")
    if _contains_any(draft_lower, {"step", "first", "then", "check", "restart", "reconnect", "update"}):
        actionability += 0.25
        notes.append("clear diagnostic steps")
    if _contains_any(draft_lower, {"if it still", "if the issue", "escalate", "support", "review"}):
        actionability += 0.1
        notes.append("includes escalation or next-step guidance")
    if state.get("experience_matches"):
        relevance += 0.05
        notes.append("used relevant prior experience")

    safety_flags = _safety_flags(request_lower, draft_lower)
    unsupported_claims = _unsupported_claims(draft_lower)
    missing_information = _missing_information(state, draft_lower)

    if safety_flags:
        safety -= 0.65
        notes.append("safety or security guardrail triggered")
    if unsupported_claims:
        relevance -= 0.3
        actionability -= 0.2
        notes.append("draft included unsupported high-impact claims")
    if missing_information:
        relevance -= 0.2
        notes.append("missing information should be requested")

    feedback_summary = state.get("feedback_summary", {})
    feedback_score = feedback_summary.get("score")
    if isinstance(feedback_score, (int, float)):
        if feedback_score < 0.4:
            relevance -= 0.15
            actionability -= 0.15
            notes.append("explicit feedback was negative")
        elif feedback_score >= 0.8:
            relevance += 0.05
            notes.append("explicit feedback was positive")
    elif feedback_summary.get("insufficient"):
        notes.append("no explicit feedback was available")

    performance = {
        "relevance": _clamp(relevance),
        "actionability": _clamp(actionability),
        "safety": _clamp(safety),
    }
    score = round(
        performance["relevance"] * 0.4
        + performance["actionability"] * 0.35
        + performance["safety"] * 0.25,
        2,
    )
    passed = (
        score >= threshold
        and not safety_flags
        and not unsupported_claims
        and not missing_information
    )
    recoverable = (
        not passed
        and not safety_flags
        and not unsupported_claims
        and state.get("retry_count", 0) < state.get("max_retries", DEFAULT_MAX_RETRIES)
    )

    return {
        "score": score,
        "threshold": threshold,
        "passed": passed,
        "notes": notes or ["rubric evaluation completed"],
        "safety_flags": safety_flags,
        "unsupported_claims": unsupported_claims,
        "missing_information": missing_information,
        "recoverable": recoverable,
        "performance": performance,
        "insufficient_feedback": bool(feedback_summary.get("insufficient", False)),
    }


def _normalize_evaluation(
    raw_evaluation: Any, state: LearningAdaptationState
) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    threshold = _score_threshold(state)

    if not isinstance(raw_evaluation, dict):
        raw_evaluation = {}
        errors.append("Evaluator output must be a dictionary.")

    score = _coerce_score(raw_evaluation.get("score"), None)
    if score is None:
        score = 0.0
        errors.append("Evaluator did not return a numeric score.")

    safety_flags = _string_list(raw_evaluation.get("safety_flags"))
    unsupported_claims = _string_list(raw_evaluation.get("unsupported_claims"))
    missing_information = _string_list(raw_evaluation.get("missing_information"))
    notes = _string_list(raw_evaluation.get("notes")) or ["No evaluator notes provided."]
    performance = raw_evaluation.get("performance")
    if not isinstance(performance, dict):
        performance = {
            "relevance": score,
            "actionability": score,
            "safety": 0.0 if safety_flags else 1.0,
        }

    passed = bool(raw_evaluation.get("passed", score >= threshold))
    passed = passed and not safety_flags and not unsupported_claims and not missing_information
    recoverable = bool(
        raw_evaluation.get(
            "recoverable",
            not passed
            and not safety_flags
            and not unsupported_claims
            and state.get("retry_count", 0) < state.get("max_retries", DEFAULT_MAX_RETRIES),
        )
    )

    evaluation = {
        "score": score,
        "threshold": threshold,
        "passed": passed,
        "notes": notes,
        "safety_flags": safety_flags,
        "unsupported_claims": unsupported_claims,
        "missing_information": missing_information,
        "recoverable": recoverable,
        "performance": performance,
        "insufficient_feedback": bool(
            raw_evaluation.get(
                "insufficient_feedback",
                state.get("feedback_summary", {}).get("insufficient", False),
            )
        ),
    }
    return evaluation, errors


def _default_retrieve_from_archive(state: LearningAdaptationState) -> list[dict[str, Any]]:
    archive = state.get("experience_archive", _metadata(state).get("experience_archive", []))
    if not isinstance(archive, list):
        return []

    normalized_input = state.get("normalized_input", "")
    category = state.get("task_category")
    candidates: list[tuple[float, dict[str, Any]]] = []

    for record in archive:
        if not isinstance(record, dict) or not _same_namespace(record, state):
            continue
        score = _record_relevance(record, normalized_input, category)
        if score > 0:
            candidates.append((score, record))

    candidates.sort(key=lambda item: item[0], reverse=True)
    return [record for _, record in candidates]


def _build_strategy_profile(
    records: list[dict[str, Any]], existing_profile: dict[str, Any]
) -> dict[str, Any]:
    profile = dict(existing_profile)
    strategies = dict(profile.get("strategies", {}))

    for record in records:
        strategy = str(record.get("strategy") or "diagnostic_steps")
        current = dict(
            strategies.get(
                strategy,
                {
                    "successes": 0,
                    "failures": 0,
                    "average_score": 0.0,
                    "lessons": [],
                },
            )
        )
        score = _coerce_score(record.get("score"), 0.0)
        outcome = str(record.get("outcome") or "")
        if outcome == "success" or score >= DEFAULT_SCORE_THRESHOLD:
            current["successes"] = int(current.get("successes", 0)) + 1
        else:
            current["failures"] = int(current.get("failures", 0)) + 1
        current["average_score"] = _running_average(
            _coerce_score(current.get("average_score"), 0.0),
            int(current.get("successes", 0)) + int(current.get("failures", 0)),
            score,
        )
        lesson = _normalize_text(str(record.get("lesson") or ""))
        if lesson:
            current["lessons"] = [*current.get("lessons", []), lesson][-5:]
        strategies[strategy] = current

    profile["strategies"] = strategies
    return profile


def _apply_profile_update(
    profile: dict[str, Any], strategy: str, profile_update: dict[str, Any]
) -> dict[str, Any]:
    strategies = dict(profile.get("strategies", {}))
    current = dict(
        strategies.get(
            strategy,
            {
                "successes": 0,
                "failures": 0,
                "average_score": 0.0,
                "lessons": [],
            },
        )
    )
    current["successes"] = int(current.get("successes", 0)) + int(
        profile_update.get("success_delta", 0)
    )
    current["failures"] = int(current.get("failures", 0)) + int(
        profile_update.get("failure_delta", 0)
    )
    score = _coerce_score(profile_update.get("score"), 0.0)
    total = current["successes"] + current["failures"]
    current["average_score"] = _running_average(
        _coerce_score(current.get("average_score"), 0.0),
        max(total, 1),
        score,
    )
    lesson = _normalize_text(str(profile_update.get("lesson") or ""))
    if lesson:
        current["lessons"] = [*current.get("lessons", []), lesson][-5:]
    strategies[strategy] = current
    profile["strategies"] = strategies
    return profile


def _rollback_update(
    state: LearningAdaptationState, profile: dict[str, Any], reason: str
) -> dict[str, Any]:
    rollback_record = {
        "rolled_back": True,
        "reason": reason,
        "strategy": state.get("selected_strategy"),
        "score": state.get("evaluation", {}).get("score"),
    }
    return {
        "strategy_profile": profile,
        "applied_adaptation": {
            "applied": False,
            "reason": reason,
        },
        "rollback_record": rollback_record,
    }


def _summarize_feedback(feedback: Any, errors: list[str]) -> dict[str, Any]:
    if feedback is None or feedback == "":
        return {
            "source": "implicit",
            "score": None,
            "notes": ["No explicit feedback was provided; using rubric evaluation."],
            "insufficient": True,
        }

    if isinstance(feedback, str):
        return {
            "source": "explicit",
            "score": None,
            "notes": [_normalize_text(feedback)],
            "insufficient": False,
        }

    if not isinstance(feedback, dict):
        errors.append("Feedback must be a string, dictionary, or omitted.")
        return {
            "source": "malformed",
            "score": None,
            "notes": ["Feedback could not be parsed."],
            "insufficient": True,
        }

    score = _coerce_score(feedback.get("score"), None)
    if feedback.get("score") is not None and score is None:
        errors.append(f"Feedback score is not numeric: {feedback.get('score')!r}.")
    notes = _string_list(feedback.get("notes"))
    if not notes and feedback.get("note"):
        notes = [_normalize_text(str(feedback["note"]))]

    return {
        "source": "explicit",
        "score": score,
        "notes": notes or ["Explicit feedback was provided without notes."],
        "insufficient": score is None and not notes,
    }


def _fallback_response(state: LearningAdaptationState) -> str:
    category = state.get("task_category") or "unknown"
    if state.get("selected_strategy") == "clarify_first":
        return (
            "Please share the device or app name, the exact error message, what "
            "changed recently, and the troubleshooting steps already tried."
        )
    if state.get("selected_strategy") == "escalate":
        return (
            "This may involve safety, security, or account access. Pause the "
            "automatic workflow and have a qualified support specialist review it."
        )
    return (
        f"For this {category} issue, start with reversible diagnostics: restart "
        "the affected device or app, check connectivity and recent updates, note "
        "any exact error messages, and escalate to support if the issue persists."
    )


def _format_experience_lessons(records: list[dict[str, Any]]) -> str:
    lessons = []
    for record in records:
        lesson = _normalize_text(str(record.get("lesson") or ""))
        if lesson:
            lessons.append(f"- {lesson}")
    return "\n".join(lessons) if lessons else "- No relevant prior lesson found."


def _format_feedback_notes(state: LearningAdaptationState) -> str:
    feedback_summary = state.get("feedback_summary", {})
    evaluation = state.get("evaluation", {})
    notes = _string_list(feedback_summary.get("notes")) + _string_list(
        evaluation.get("notes")
    )
    return "\n".join(f"- {note}" for note in notes) if notes else "- None."


def _learning_lesson(state: LearningAdaptationState, success: bool) -> str:
    category = state.get("task_category") or "unknown"
    strategy = state.get("selected_strategy") or "diagnostic_steps"
    if success:
        return (
            f"For {category} requests, {strategy.replace('_', ' ')} worked when "
            "grounded in reversible steps and clear escalation criteria."
        )
    reasons = _review_reasons(state.get("evaluation", {}))
    if reasons:
        return (
            f"Do not reinforce {strategy.replace('_', ' ')} for {category} until "
            f"review resolves: {'; '.join(reasons)}."
        )
    return (
        f"Do not reinforce {strategy.replace('_', ' ')} for {category} without "
        "stronger feedback or evaluator evidence."
    )


def _review_reasons(evaluation: dict[str, Any]) -> list[str]:
    reasons = []
    reasons.extend(_string_list(evaluation.get("safety_flags")))
    reasons.extend(_string_list(evaluation.get("unsupported_claims")))
    reasons.extend(_string_list(evaluation.get("missing_information")))
    if not reasons and _coerce_score(evaluation.get("score"), 0.0) < _coerce_score(
        evaluation.get("threshold"), DEFAULT_SCORE_THRESHOLD
    ):
        reasons.append("low evaluation score")
    return reasons


def _record_relevance(
    record: dict[str, Any], normalized_input: str, category: str | None
) -> float:
    score = 0.0
    if category and record.get("task_category") == category:
        score += 0.7
    record_text = " ".join(
        str(record.get(key, ""))
        for key in ("input_summary", "lesson", "strategy_reason", "outcome")
    )
    overlap = set(_significant_tokens(normalized_input)).intersection(
        _significant_tokens(record_text)
    )
    score += min(0.3, len(overlap) * 0.05)
    return score


def _normalize_records(records: Any) -> list[dict[str, Any]]:
    if not isinstance(records, list):
        return []
    return [dict(record) for record in records if isinstance(record, dict)]


def _same_namespace(record: dict[str, Any], state: LearningAdaptationState) -> bool:
    namespace = record.get("user_namespace", record.get("user_id", "global"))
    return namespace in {_user_namespace(state), "global", None}


def _user_namespace(state: LearningAdaptationState) -> str:
    user_id = state.get("user_id")
    return _normalize_text(str(user_id)) if user_id else "global"


def _best_successful_match(records: list[dict[str, Any]]) -> dict[str, Any] | None:
    successful = [
        record
        for record in records
        if record.get("outcome") == "success"
        or _coerce_score(record.get("score"), 0.0) >= DEFAULT_SCORE_THRESHOLD
    ]
    if not successful:
        return None
    return max(successful, key=lambda record: _coerce_score(record.get("score"), 0.0))


def _strategy_or_default(value: Any, category: str) -> StrategyLabel:
    if value in {"reuse_known_solution", "diagnostic_steps", "clarify_first", "escalate"}:
        return value
    if category == "account":
        return "clarify_first"
    return "diagnostic_steps"


def _category_terms(category: str) -> set[str]:
    if category == "connectivity":
        return {"wifi", "wi-fi", "network", "router", "internet", "connect", "reconnect"}
    if category == "account":
        return {"account", "login", "password", "billing", "security"}
    if category == "software":
        return {"app", "software", "update", "install", "crash", "error"}
    if category == "hardware":
        return {"device", "battery", "screen", "printer", "keyboard", "laptop"}
    return {"issue", "problem", "support"}


def _safety_flags(request_lower: str, draft_lower: str) -> list[str]:
    flags: list[str] = []
    risky_request = _contains_any(request_lower, HIGH_RISK_TERMS)
    risky_draft = _contains_any(draft_lower, {"open the device", "bypass", "disable security"})
    review_language = _contains_any(draft_lower, {"human", "specialist", "review", "qualified"})
    if risky_request and not review_language:
        flags.append("high_risk_request_without_review")
    if risky_draft:
        flags.append("unsafe_instruction")
    return flags


def _unsupported_claims(draft_lower: str) -> list[str]:
    return sorted(term for term in UNSUPPORTED_ACTION_TERMS if term in draft_lower)


def _missing_information(
    state: LearningAdaptationState, draft_lower: str
) -> list[str]:
    normalized_input = state.get("normalized_input", "")
    if not _has_low_information(normalized_input):
        return []
    asks_question = "?" in draft_lower or _contains_any(
        draft_lower,
        {"please share", "provide", "what error", "which device", "more detail"},
    )
    return [] if asks_question else ["missing troubleshooting details"]


def _has_low_information(text: str) -> bool:
    tokens = _significant_tokens(text)
    vague_terms = {"thing", "stuff", "problem", "issue", "broken", "help"}
    return len(tokens) < 4 or set(tokens).issubset(vague_terms)


def _needs_immediate_review(text: str) -> bool:
    return _contains_any(text.lower(), HIGH_RISK_TERMS)


def _score_threshold(state: LearningAdaptationState) -> float:
    value = _metadata(state).get("score_threshold", DEFAULT_SCORE_THRESHOLD)
    return _clamp(_coerce_score(value, DEFAULT_SCORE_THRESHOLD))


def _metadata(state: LearningAdaptationState) -> dict[str, Any]:
    metadata = state.get("metadata", {})
    return dict(metadata) if isinstance(metadata, dict) else {}


def _coerce_score(value: Any, default: float | None) -> float | None:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return default
    return _clamp(score)


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def _running_average(current_average: float, total_after_update: int, new_score: float) -> float:
    if total_after_update <= 1:
        return round(new_score, 3)
    previous_total = max(total_after_update - 1, 1)
    return round(((current_average * previous_total) + new_score) / total_after_update, 3)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _contains_any(text: str, terms: set[str]) -> bool:
    return any(term in text for term in terms)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _significant_tokens(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
        if len(token) >= 3
    ]


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [_normalize_text(str(item)) for item in value if _normalize_text(str(item))]
    text = _normalize_text(str(value))
    return [text] if text else []


def _redact_sensitive(text: str) -> str:
    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[redacted-email]", text)
    text = re.sub(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", "[redacted-phone]", text)
    return text


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."
