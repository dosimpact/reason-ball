from __future__ import annotations

import copy
import hashlib
import re
from typing import Any, Callable

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_13_human_in_the_loop.prompts import (
    RECOMMENDATION_SYSTEM_PROMPT,
    RECOMMENDATION_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_13_human_in_the_loop.state import (
    AmbiguityLevel,
    HumanInTheLoopState,
    IssueType,
    RiskLevel,
    Sentiment,
)
from agentic_design_patterns.shared.models import get_chat_model


MAX_INPUT_CHARS = 6000

DEFAULT_ESCALATION_POLICY: dict[str, Any] = {
    "risk_review_threshold": "high",
    "ambiguity_review_threshold": "high",
    "sentiments_requiring_review": ["angry", "distressed"],
    "sensitive_issue_types": ["account", "billing", "safety"],
    "review_timeout_action": "awaiting_human",
    "review_timeout_seconds": 0,
    "critical_ticket_priority": "critical",
    "high_ticket_priority": "high",
    "default_ticket_priority": "normal",
    "sensitive_fields": [
        "address",
        "card",
        "credit_card",
        "customer_id",
        "email",
        "name",
        "order_id",
        "phone",
        "purchase_id",
        "serial_number",
        "ssn",
    ],
}

RISK_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}
AMBIGUITY_ORDER = {"low": 0, "medium": 1, "high": 2}

SAFETY_KEYWORDS = (
    "battery swelling",
    "swollen battery",
    "smoke",
    "burning",
    "fire",
    "sparks",
    "electric shock",
    "shock",
    "overheating",
    "melted",
    "exploded",
    "explosion",
    "injury",
)
ACCOUNT_KEYWORDS = (
    "account",
    "login",
    "password",
    "locked out",
    "2fa",
    "two-factor",
    "privacy",
    "data breach",
)
BILLING_KEYWORDS = (
    "billing",
    "invoice",
    "refund",
    "charge",
    "charged",
    "credit card",
    "payment",
)
HARDWARE_KEYWORDS = (
    "battery",
    "charger",
    "keyboard",
    "monitor",
    "screen",
    "laptop",
    "device",
    "fan",
    "port",
)
SOFTWARE_KEYWORDS = (
    "app",
    "software",
    "crash",
    "crashes",
    "update",
    "install",
    "error",
    "wifi",
    "wi-fi",
    "network",
)
FOLLOW_UP_KEYWORDS = (
    "replacement",
    "repair",
    "warranty",
    "shipping",
    "rma",
    "still not",
    "still broken",
    "persists",
    "follow up",
)
ANGRY_KEYWORDS = ("angry", "furious", "unacceptable", "lawsuit", "terrible")
FRUSTRATED_KEYWORDS = ("frustrated", "annoyed", "upset", "disappointed")
DISTRESSED_KEYWORDS = ("scared", "panic", "distressed", "unsafe", "danger")
AMBIGUOUS_PHRASES = (
    "doesn't work",
    "does not work",
    "broken",
    "problem",
    "issue",
    "help",
)
UNSAFE_HUMAN_INSTRUCTIONS = (
    "continue using",
    "keep using",
    "ignore",
    "do nothing",
    "safe to use",
)


def preprocess_input(state: HumanInTheLoopState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    normalized_input = _normalize_text(raw_input)
    errors = list(state.get("errors", []))
    escalation_policy = _merge_policy(state.get("escalation_policy", {}))

    if len(normalized_input) > MAX_INPUT_CHARS:
        normalized_input = normalized_input[:MAX_INPUT_CHARS].rstrip()
        errors.append(f"Input was truncated to {MAX_INPUT_CHARS} characters.")

    if not normalized_input:
        return {
            "normalized_input": "",
            "escalation_policy": escalation_policy,
            "customer_info": dict(state.get("customer_info", {})),
            "support_history": list(state.get("support_history", [])),
            "needs_human_review": False,
            "review_status": "not_required",
            "risk_level": "low",
            "ambiguity_level": "high",
            "errors": [*errors, "Input is empty."],
            "status": "failed",
        }

    return {
        "normalized_input": normalized_input,
        "escalation_policy": escalation_policy,
        "customer_info": dict(state.get("customer_info", {})),
        "support_history": list(state.get("support_history", [])),
        "needs_human_review": False,
        "review_status": "not_required",
        "risk_level": state.get("risk_level", "low"),
        "ambiguity_level": state.get("ambiguity_level", "low"),
        "errors": errors,
        "status": "ok",
    }


def load_customer_context(state: HumanInTheLoopState) -> dict[str, Any]:
    customer_info = dict(state.get("customer_info", {}))
    support_history = list(state.get("support_history", []))
    customer_id = state.get("customer_id")
    customer_contexts = state.get("customer_contexts", {})

    if customer_id and not customer_info and customer_id in customer_contexts:
        fixture = customer_contexts[customer_id]
        customer_info = dict(fixture.get("customer_info", {}))
        support_history = list(fixture.get("support_history", support_history))

    return {
        "customer_info": customer_info,
        "support_history": support_history,
    }


def classify_request(state: HumanInTheLoopState) -> dict[str, Any]:
    text = state.get("normalized_input", "")
    lower_text = text.lower()
    issue_type = _classify_issue_type(lower_text)
    sentiment = _classify_sentiment(lower_text)
    ambiguity_level = _classify_ambiguity(lower_text, issue_type)
    risk_level = _classify_risk(lower_text, issue_type, sentiment)

    return {
        "issue_type": issue_type,
        "sentiment": sentiment,
        "risk_level": risk_level,
        "ambiguity_level": ambiguity_level,
    }


def troubleshoot_issue(state: HumanInTheLoopState) -> dict[str, Any]:
    metadata = state.get("metadata", {})
    errors = list(state.get("errors", []))
    issue_type = state.get("issue_type") or "unknown"
    risk_level = state.get("risk_level", "low")
    text = state.get("normalized_input", "")
    lower_text = text.lower()

    if metadata.get("force_troubleshooting_error"):
        error = f"troubleshoot_issue failed: {metadata['force_troubleshooting_error']}"
        return {
            "troubleshooting_result": {
                "attempted": True,
                "resolved": False,
                "requires_follow_up": False,
                "summary": "Troubleshooting tool failed.",
                "error": error,
            },
            "errors": [*errors, error],
        }

    if risk_level in {"high", "critical"} or issue_type in {"account", "billing", "safety"}:
        return {
            "troubleshooting_result": {
                "attempted": False,
                "resolved": False,
                "requires_follow_up": False,
                "summary": "Routine automation skipped because policy requires review.",
                "reason": "sensitive_or_high_risk",
            }
        }

    steps = _routine_steps(issue_type)
    requires_follow_up = bool(
        metadata.get("force_follow_up")
        or any(keyword in lower_text for keyword in FOLLOW_UP_KEYWORDS)
    )
    resolved = not requires_follow_up and issue_type in {"software", "hardware"}

    return {
        "troubleshooting_result": {
            "attempted": True,
            "resolved": resolved,
            "requires_follow_up": requires_follow_up,
            "steps": steps,
            "summary": _troubleshooting_summary(issue_type, resolved, requires_follow_up),
        }
    }


def build_agent_recommendation(state: HumanInTheLoopState) -> dict[str, Any]:
    troubleshooting_result = state.get("troubleshooting_result") or {}
    escalation_reason = _initial_escalation_reason(state)
    errors = list(state.get("errors", []))

    try:
        model_answer = _invoke_model(
            RECOMMENDATION_SYSTEM_PROMPT,
            RECOMMENDATION_USER_PROMPT.format(
                normalized_input=state.get("normalized_input", ""),
                issue_type=state.get("issue_type"),
                risk_level=state.get("risk_level", "low"),
                ambiguity_level=state.get("ambiguity_level", "low"),
                sentiment=state.get("sentiment"),
                troubleshooting_summary=troubleshooting_result.get("summary", ""),
                escalation_reason=escalation_reason or "none",
            ),
        )
    except Exception as exc:  # pragma: no cover - provider errors vary.
        model_answer = _fallback_answer(state)
        errors.append(f"build_agent_recommendation model invocation failed: {exc}")

    recommended_action = _recommended_action(state)
    recommendation = {
        "recommended_action": recommended_action,
        "answer": model_answer or _fallback_answer(state),
        "rationale": escalation_reason or troubleshooting_result.get("summary", ""),
        "issue_type": state.get("issue_type", "unknown"),
        "risk_level": state.get("risk_level", "low"),
        "ambiguity_level": state.get("ambiguity_level", "low"),
        "ticket_priority": _ticket_priority(state.get("risk_level", "low"), state),
    }

    return {
        "agent_recommendation": recommendation,
        "escalation_reason": escalation_reason,
        "errors": errors,
    }


def assess_handoff_need(state: HumanInTheLoopState) -> dict[str, Any]:
    if state.get("status") == "failed":
        return {"needs_human_review": False, "review_status": "not_required"}

    reason = _handoff_reason(state)
    if reason:
        return {
            "needs_human_review": True,
            "escalation_reason": reason,
            "review_status": "requested",
        }

    return {
        "needs_human_review": False,
        "review_status": "not_required",
        "escalation_reason": None,
    }


def create_ticket(state: HumanInTheLoopState) -> dict[str, Any]:
    metadata = state.get("metadata", {})
    errors = list(state.get("errors", []))

    if metadata.get("force_ticket_error"):
        error = f"create_ticket failed: {metadata['force_ticket_error']}"
        return {
            "errors": [*errors, error],
            "needs_human_review": True,
            "review_status": "requested",
            "escalation_reason": "Ticket creation failed; human support must recover.",
        }

    ticket = _make_ticket(state)
    return {"ticket": ticket}


def redact_review_payload(state: HumanInTheLoopState) -> dict[str, Any]:
    metadata = state.get("metadata", {})
    errors = list(state.get("errors", []))

    if metadata.get("force_redaction_error"):
        error = f"redact_review_payload failed: {metadata['force_redaction_error']}"
        return {
            "errors": [*errors, error],
            "needs_human_review": True,
            "review_status": "review_unavailable",
            "status": "review_unavailable",
            "redacted_review_request": None,
            "review_interrupt": None,
        }

    review_request = _build_review_request(state)
    sensitive_values = _sensitive_values(state)
    redacted_review_request = _redact_value(
        review_request,
        set(state.get("escalation_policy", {}).get("sensitive_fields", [])),
        sensitive_values,
    )

    return {
        "review_request": review_request,
        "redacted_review_request": redacted_review_request,
    }


def request_human_review(state: HumanInTheLoopState) -> dict[str, Any]:
    if state.get("review_status") == "review_unavailable":
        return {}

    human_response = state.get("human_response")
    provider = state.get("human_review_provider")

    if human_response is None and callable(provider):
        human_response = _call_review_provider(provider, state)

    if human_response is not None:
        return {
            "human_response": _normalize_human_response(human_response),
            "status": "ok",
        }

    policy = state.get("escalation_policy", {})
    timeout_action = policy.get("review_timeout_action", "awaiting_human")
    review_interrupt = {
        "status": "awaiting_human",
        "resume_with": "human_response",
        "review_id": _stable_id("REVIEW", state.get("normalized_input", "")),
        "payload": state.get("redacted_review_request"),
        "timeout_action": timeout_action,
        "timeout_seconds": policy.get("review_timeout_seconds", 0),
    }

    if timeout_action == "auto_escalate":
        return {
            "human_response": {
                "decision": "escalate",
                "notes": "Default escalation policy applied after review timeout.",
                "source": "timeout_policy",
            },
            "review_interrupt": review_interrupt,
            "status": "ok",
        }

    return {
        "review_interrupt": review_interrupt,
        "review_status": "requested",
        "status": "awaiting_human",
    }


def apply_human_decision(state: HumanInTheLoopState) -> dict[str, Any]:
    human_response = state.get("human_response")
    if not human_response:
        return {}

    decision = human_response.get("decision", "request_more_info")
    errors = list(state.get("errors", []))

    if _conflicts_with_policy(state, human_response):
        errors.append(
            "Human instruction conflicted with stricter safety policy; escalated instead."
        )
        decision = "escalate"
        human_response = {
            **human_response,
            "decision": "escalate",
            "policy_override": True,
        }

    if decision == "approve":
        return {
            "human_response": human_response,
            "review_status": "approved",
            "final_answer": _approved_answer(state),
            "human_feedback": _feedback_from_response(human_response),
            "errors": errors,
            "status": "ok",
        }

    if decision == "edit":
        final_answer = (
            human_response.get("edited_answer")
            or human_response.get("message")
            or _approved_answer(state)
        )
        return {
            "human_response": human_response,
            "review_status": "edited",
            "final_answer": final_answer,
            "human_feedback": _feedback_from_response(human_response),
            "errors": errors,
            "status": "ok",
        }

    if decision == "reject":
        reason = human_response.get("reason") or human_response.get("notes")
        answer = (
            "A human reviewer rejected the automated recommendation. "
            "We need a specialist to reassess the case before giving final instructions."
        )
        if reason:
            answer = f"{answer} Reviewer note: {reason}"
        return {
            "human_response": human_response,
            "review_status": "rejected",
            "final_answer": answer,
            "human_feedback": _feedback_from_response(human_response),
            "errors": errors,
            "status": "ok",
        }

    if decision == "escalate":
        ticket = state.get("ticket") or _make_ticket(state)
        answer = human_response.get("message") or _escalation_answer(state)
        return {
            "human_response": human_response,
            "review_status": "escalated",
            "ticket": ticket,
            "final_answer": answer,
            "human_feedback": _feedback_from_response(human_response),
            "errors": errors,
            "status": "ok",
        }

    answer = (
        human_response.get("message")
        or "A human reviewer needs more information before this can be resolved."
    )
    return {
        "human_response": human_response,
        "review_status": "more_info_requested",
        "final_answer": answer,
        "human_feedback": _feedback_from_response(human_response),
        "errors": errors,
        "status": "ok",
    }


def record_review_outcome(state: HumanInTheLoopState) -> dict[str, Any]:
    human_response = state.get("human_response")
    if not human_response:
        return {}

    feedback = {
        **(state.get("human_feedback") or {}),
        "decision": human_response.get("decision"),
        "review_status": state.get("review_status"),
        "notes": human_response.get("notes") or human_response.get("reason"),
        "source": human_response.get("source", "human"),
    }
    return {"human_feedback": feedback}


def finalize(state: HumanInTheLoopState) -> dict[str, Any]:
    status = _final_status(state)
    answer = _final_answer(state, status)
    final_output = {
        "status": status,
        "answer": answer,
        "ticket": state.get("ticket"),
        "human_review": {
            "required": bool(state.get("needs_human_review", False)),
            "status": state.get("review_status", "not_required"),
            "decision": (state.get("human_response") or {}).get("decision"),
            "reason": state.get("escalation_reason"),
            "interrupt": _interrupt_summary(state.get("review_interrupt")),
        },
        "classification": {
            "issue_type": state.get("issue_type"),
            "risk_level": state.get("risk_level", "low"),
            "ambiguity_level": state.get("ambiguity_level", "low"),
            "sentiment": state.get("sentiment"),
        },
        "redaction_applied": bool(state.get("redacted_review_request")),
        "errors": state.get("errors", []),
    }

    return {
        "final_output": final_output,
        "status": state.get("status", "ok"),
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


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip()


def _merge_policy(policy: dict[str, Any]) -> dict[str, Any]:
    merged = copy.deepcopy(DEFAULT_ESCALATION_POLICY)
    for key, value in policy.items():
        if key == "sensitive_fields":
            merged[key] = sorted(set(merged[key]) | set(value))
        else:
            merged[key] = value
    return merged


def _classify_issue_type(text: str) -> IssueType:
    if "battery" in text and any(
        keyword in text for keyword in ("swelling", "swollen", "hot", "sparks")
    ):
        return "safety"
    if any(keyword in text for keyword in SAFETY_KEYWORDS):
        return "safety"
    if any(keyword in text for keyword in BILLING_KEYWORDS):
        return "billing"
    if any(keyword in text for keyword in ACCOUNT_KEYWORDS):
        return "account"
    if any(keyword in text for keyword in SOFTWARE_KEYWORDS):
        return "software"
    if any(keyword in text for keyword in HARDWARE_KEYWORDS):
        return "hardware"
    return "unknown"


def _classify_sentiment(text: str) -> Sentiment:
    if any(keyword in text for keyword in DISTRESSED_KEYWORDS):
        return "distressed"
    if any(keyword in text for keyword in ANGRY_KEYWORDS):
        return "angry"
    if any(keyword in text for keyword in FRUSTRATED_KEYWORDS):
        return "frustrated"
    return "neutral"


def _classify_ambiguity(text: str, issue_type: IssueType) -> AmbiguityLevel:
    word_count = len(text.split())
    has_vague_phrase = any(phrase in text for phrase in AMBIGUOUS_PHRASES)
    if word_count < 4:
        return "high"
    if issue_type == "unknown" and has_vague_phrase:
        return "high"
    if issue_type == "unknown" or (word_count < 8 and has_vague_phrase):
        return "medium"
    return "low"


def _classify_risk(
    text: str,
    issue_type: IssueType,
    sentiment: Sentiment,
) -> RiskLevel:
    if issue_type == "safety" and "battery" in text and any(
        keyword in text for keyword in ("swelling", "swollen", "hot", "sparks")
    ):
        return "critical"
    if issue_type == "safety" and any(
        keyword in text
        for keyword in ("battery swelling", "swollen battery", "smoke", "fire", "shock")
    ):
        return "critical"
    if issue_type == "safety":
        return "high"
    if "lawsuit" in text or "data breach" in text or "fraud" in text:
        return "high"
    if issue_type in {"account", "billing"}:
        return "high"
    if sentiment in {"angry", "distressed"}:
        return "medium"
    return "low"


def _routine_steps(issue_type: str) -> list[str]:
    if issue_type == "software":
        return [
            "Restart the application.",
            "Check for updates.",
            "Capture the exact error message if the issue persists.",
        ]
    if issue_type == "hardware":
        return [
            "Power cycle the device.",
            "Check cables and peripherals.",
            "Record any recurring error indicators.",
        ]
    return [
        "Confirm the affected product.",
        "Record the visible symptom.",
        "Contact support if the issue persists.",
    ]


def _troubleshooting_summary(
    issue_type: str,
    resolved: bool,
    requires_follow_up: bool,
) -> str:
    if requires_follow_up:
        return f"Routine {issue_type} troubleshooting indicates follow-up is needed."
    if resolved:
        return f"Routine {issue_type} troubleshooting can be handled automatically."
    return "Routine troubleshooting could not confidently resolve the request."


def _initial_escalation_reason(state: HumanInTheLoopState) -> str | None:
    reason = _handoff_reason(state)
    if reason:
        return reason
    troubleshooting_result = state.get("troubleshooting_result") or {}
    if troubleshooting_result.get("requires_follow_up"):
        return "Routine issue needs asynchronous support follow-up."
    return None


def _recommended_action(state: HumanInTheLoopState) -> str:
    if _handoff_reason(state):
        return "human_review"
    troubleshooting_result = state.get("troubleshooting_result") or {}
    if troubleshooting_result.get("requires_follow_up"):
        return "create_ticket"
    return "direct_answer"


def _handoff_reason(state: HumanInTheLoopState) -> str | None:
    policy = state.get("escalation_policy", DEFAULT_ESCALATION_POLICY)
    risk_level = state.get("risk_level", "low")
    ambiguity_level = state.get("ambiguity_level", "low")
    issue_type = state.get("issue_type") or "unknown"
    sentiment = state.get("sentiment") or "neutral"
    troubleshooting_result = state.get("troubleshooting_result") or {}
    errors = state.get("errors", [])

    if _risk_at_least(risk_level, policy.get("risk_review_threshold", "high")):
        return f"{risk_level} risk requires human judgment."
    if _ambiguity_at_least(
        ambiguity_level,
        policy.get("ambiguity_review_threshold", "high"),
    ):
        return f"{ambiguity_level} ambiguity requires human review."
    if issue_type in set(policy.get("sensitive_issue_types", [])):
        return f"{issue_type} issue is sensitive and requires review."
    if sentiment in set(policy.get("sentiments_requiring_review", [])):
        return f"{sentiment} sentiment requires human intervention."
    if troubleshooting_result.get("error"):
        return "Troubleshooting failed; human review is required."
    if errors and not troubleshooting_result.get("resolved", False):
        return "Recoverable workflow errors require human review."
    if troubleshooting_result.get("attempted") is False and issue_type == "unknown":
        return "Unsupported issue type requires human triage."
    return None


def _risk_at_least(actual: str, threshold: str) -> bool:
    return RISK_ORDER.get(actual, 0) >= RISK_ORDER.get(threshold, 2)


def _ambiguity_at_least(actual: str, threshold: str) -> bool:
    return AMBIGUITY_ORDER.get(actual, 0) >= AMBIGUITY_ORDER.get(threshold, 2)


def _fallback_answer(state: HumanInTheLoopState) -> str:
    if _handoff_reason(state):
        return "I am preparing this case for a human support specialist before final action."
    troubleshooting_result = state.get("troubleshooting_result") or {}
    steps = troubleshooting_result.get("steps") or []
    if steps:
        return "Try these approved steps: " + " ".join(steps)
    return "I need a little more information before I can recommend the next step."


def _ticket_priority(risk_level: str, state: HumanInTheLoopState) -> str:
    policy = state.get("escalation_policy", DEFAULT_ESCALATION_POLICY)
    if risk_level == "critical":
        return policy.get("critical_ticket_priority", "critical")
    if risk_level == "high":
        return policy.get("high_ticket_priority", "high")
    return policy.get("default_ticket_priority", "normal")


def _stable_id(prefix: str, text: str) -> str:
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:8].upper()
    return f"{prefix}-{digest}"


def _make_ticket(state: HumanInTheLoopState) -> dict[str, Any]:
    risk_level = state.get("risk_level", "low")
    return {
        "ticket_id": _stable_id("HITL", state.get("normalized_input", "")),
        "priority": _ticket_priority(risk_level, state),
        "issue_type": state.get("issue_type", "unknown"),
        "reason": state.get("escalation_reason") or "Support follow-up required.",
    }


def _build_review_request(state: HumanInTheLoopState) -> dict[str, Any]:
    return {
        "input": state.get("normalized_input", ""),
        "customer_id": state.get("customer_id"),
        "customer_info": state.get("customer_info", {}),
        "support_history": state.get("support_history", []),
        "classification": {
            "issue_type": state.get("issue_type"),
            "risk_level": state.get("risk_level", "low"),
            "ambiguity_level": state.get("ambiguity_level", "low"),
            "sentiment": state.get("sentiment"),
        },
        "troubleshooting_result": state.get("troubleshooting_result"),
        "agent_recommendation": state.get("agent_recommendation"),
        "escalation_reason": state.get("escalation_reason"),
        "errors": state.get("errors", []),
    }


def _sensitive_values(state: HumanInTheLoopState) -> set[str]:
    values: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)
        elif isinstance(value, str) and value:
            values.add(value)

    visit(state.get("customer_info", {}))
    if state.get("customer_id"):
        values.add(str(state["customer_id"]))
    return values


def _redact_value(
    value: Any,
    sensitive_fields: set[str],
    sensitive_values: set[str],
) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            if key.lower() in sensitive_fields:
                redacted[key] = "[REDACTED]"
            else:
                redacted[key] = _redact_value(item, sensitive_fields, sensitive_values)
        return redacted
    if isinstance(value, list):
        return [_redact_value(item, sensitive_fields, sensitive_values) for item in value]
    if isinstance(value, str):
        return _redact_text(value, sensitive_values)
    return value


def _redact_text(text: str, sensitive_values: set[str]) -> str:
    redacted = text
    for sensitive_value in sorted(sensitive_values, key=len, reverse=True):
        if len(sensitive_value) >= 3:
            redacted = redacted.replace(sensitive_value, "[REDACTED]")
    redacted = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[REDACTED]", redacted)
    redacted = re.sub(r"\b(?:\d[ -]*?){13,16}\b", "[REDACTED]", redacted)
    redacted = re.sub(r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b", "[REDACTED]", redacted)
    return redacted


def _call_review_provider(
    provider: Callable[..., Any],
    state: HumanInTheLoopState,
) -> dict[str, Any] | None:
    return provider(state.get("redacted_review_request"), state)


def _normalize_human_response(response: dict[str, Any]) -> dict[str, Any]:
    decision = str(response.get("decision", "request_more_info")).strip().lower()
    if decision not in {"approve", "edit", "reject", "escalate", "request_more_info"}:
        decision = "request_more_info"
    return {**response, "decision": decision}


def _conflicts_with_policy(
    state: HumanInTheLoopState,
    human_response: dict[str, Any],
) -> bool:
    if state.get("issue_type") != "safety" and state.get("risk_level") != "critical":
        return False
    text = " ".join(
        str(human_response.get(key, ""))
        for key in ("edited_answer", "message", "notes", "reason")
    ).lower()
    return any(phrase in text for phrase in UNSAFE_HUMAN_INSTRUCTIONS)


def _approved_answer(state: HumanInTheLoopState) -> str:
    recommendation = state.get("agent_recommendation") or {}
    return recommendation.get("answer") or _fallback_answer(state)


def _escalation_answer(state: HumanInTheLoopState) -> str:
    if state.get("issue_type") == "safety":
        return (
            "I have escalated this to a human specialist because the issue may "
            "involve hardware safety. Please stop using the device and wait for "
            "the specialist's next instructions."
        )
    return "I have escalated this case to a human specialist for follow-up."


def _feedback_from_response(human_response: dict[str, Any]) -> dict[str, Any]:
    return {
        "decision": human_response.get("decision"),
        "notes": human_response.get("notes") or human_response.get("reason"),
        "edited_answer": human_response.get("edited_answer"),
    }


def _final_status(state: HumanInTheLoopState) -> str:
    if state.get("status") == "failed":
        return "failed"
    if state.get("review_status") == "review_unavailable":
        return "review_unavailable"
    if state.get("status") == "awaiting_human":
        return "awaiting_human"
    review_status = state.get("review_status")
    if review_status == "escalated":
        return "escalated"
    if review_status == "rejected":
        return "rejected"
    if review_status == "more_info_requested":
        return "needs_more_info"
    if state.get("ticket"):
        return "ticket_created"
    return "resolved"


def _final_answer(state: HumanInTheLoopState, status: str) -> str:
    if state.get("final_answer"):
        return str(state["final_answer"])
    if status == "failed":
        return "The support request could not be processed. Please provide a request."
    if status == "review_unavailable":
        return "Human review could not be opened safely. Please contact support directly."
    if status == "awaiting_human":
        return "This case is waiting for a human reviewer before final action."
    if state.get("ticket"):
        ticket = state["ticket"]
        return (
            f"I created support ticket {ticket['ticket_id']} with "
            f"{ticket['priority']} priority for follow-up."
        )
    recommendation = state.get("agent_recommendation") or {}
    return recommendation.get("answer") or _fallback_answer(state)


def _interrupt_summary(review_interrupt: dict[str, Any] | None) -> dict[str, Any] | None:
    if not review_interrupt:
        return None
    return {
        "status": review_interrupt.get("status"),
        "resume_with": review_interrupt.get("resume_with"),
        "review_id": review_interrupt.get("review_id"),
        "timeout_action": review_interrupt.get("timeout_action"),
    }
