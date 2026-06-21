from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_12_exception_handling_and_recovery.prompts import (
    LOCATION_PARSE_SYSTEM_PROMPT,
    LOCATION_PARSE_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_12_exception_handling_and_recovery.state import (
    ErrorCategory,
    EventLogEntry,
    ExceptionRecoveryState,
    ToolError,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_MAX_RETRIES = 1
MAX_INPUT_CHARS = 1000
RECOVERY_PATH_EVENTS = {
    "request_rejected",
    "primary_success",
    "primary_failed",
    "retry_scheduled",
    "fallback_success",
    "fallback_failed",
    "escalated_for_review",
    "recovery_failed",
}


class TransientLocationError(RuntimeError):
    """Raised by lookup tools for temporary failures."""


class LocationNotFoundError(RuntimeError):
    """Raised by lookup tools when a location cannot be found."""


class ServiceUnavailableError(RuntimeError):
    """Raised by lookup tools when a service is unavailable."""


class SevereLocationError(RuntimeError):
    """Raised by lookup tools for failures requiring escalation."""


def prepare_request(state: ExceptionRecoveryState) -> dict[str, Any]:
    raw_input = "" if state.get("input") is None else str(state.get("input", ""))
    normalized_query = _normalize_text(raw_input)
    max_retries = _coerce_non_negative_int(
        state.get("max_retries", DEFAULT_MAX_RETRIES),
        DEFAULT_MAX_RETRIES,
    )
    retry_count = _coerce_non_negative_int(state.get("retry_count", 0), 0)
    event_log = _append_event(
        state,
        "prepare_request",
        "request_prepared",
        {
            "input_length": len(raw_input),
            "normalized_length": len(normalized_query),
            "max_retries": max_retries,
        },
    )

    base: dict[str, Any] = {
        "normalized_query": normalized_query[:MAX_INPUT_CHARS].rstrip(),
        "address": None,
        "city": None,
        "primary_result": None,
        "fallback_result": None,
        "location_result": None,
        "primary_location_failed": False,
        "fallback_location_failed": False,
        "last_error": None,
        "tool_errors": [],
        "event_log": event_log,
        "retry_count": retry_count,
        "max_retries": max_retries,
        "error_category": None,
        "recovery_action": None,
        "needs_human_review": False,
        "final_output": None,
        "status": "in_progress",
    }

    if not normalized_query:
        error = _make_error(
            "prepare_request",
            "invalid_input",
            "Input is empty.",
            retryable=False,
            retry_count=retry_count,
        )
        return {
            **base,
            "status": "failed",
            "primary_location_failed": True,
            "last_error": error,
            "tool_errors": [error],
            "error_category": "invalid_input",
            "recovery_action": "review",
            "needs_human_review": True,
            "event_log": _append_event_to_log(
                event_log,
                "prepare_request",
                "request_rejected",
                {"category": "invalid_input"},
            ),
        }

    if len(normalized_query) > MAX_INPUT_CHARS:
        base["event_log"] = _append_event_to_log(
            event_log,
            "prepare_request",
            "request_truncated",
            {"max_input_chars": MAX_INPUT_CHARS},
        )

    return base


def parse_location_query(state: ExceptionRecoveryState) -> dict[str, Any]:
    normalized_query = state.get("normalized_query", "")
    parse_errors: list[str] = []
    raw_parse_output: str | None = None
    parsed: dict[str, Any] = {}

    try:
        raw_parse_output = _invoke_model(
            LOCATION_PARSE_SYSTEM_PROMPT,
            LOCATION_PARSE_USER_PROMPT.format(normalized_query=normalized_query),
        )
        parsed, parse_errors = _parse_json_object(raw_parse_output)
    except Exception as exc:  # pragma: no cover - concrete provider errors vary.
        parse_errors = [f"location parser model invocation failed: {_safe_message(exc)}"]

    heuristic_address, heuristic_city = _heuristic_location_parts(normalized_query)
    address = _string_or_none(
        parsed.get("address")
        or parsed.get("place")
        or parsed.get("location")
        or heuristic_address
    )
    city = _string_or_none(
        parsed.get("city")
        or parsed.get("area")
        or parsed.get("fallback_area")
        or heuristic_city
    )

    updates: dict[str, Any] = {
        "address": address,
        "city": city,
        "event_log": _append_event(
            state,
            "parse_location_query",
            "location_parsed",
            {
                "has_address": address is not None,
                "has_city": city is not None,
                "used_heuristic": bool(parse_errors),
                "parse_errors": parse_errors,
                "raw_parse_output": _truncate(raw_parse_output or "", 200),
            },
        ),
    }

    if address is None:
        error = _make_error(
            "parse_location_query",
            "invalid_input",
            "Could not extract a usable location from the request.",
            retryable=False,
            retry_count=state.get("retry_count", 0),
        )
        updates.update(
            {
                "primary_location_failed": True,
                "last_error": error,
                "tool_errors": _append_tool_error(state, error),
                "error_category": "invalid_input",
            }
        )

    return updates


def call_precise_lookup(state: ExceptionRecoveryState) -> dict[str, Any]:
    address = _string_or_none(state.get("address"))
    retry_count = state.get("retry_count", 0)
    if address is None:
        error = _make_error(
            "precise_location_lookup",
            "invalid_input",
            "Precise lookup requires a non-empty address or place.",
            retryable=False,
            retry_count=retry_count,
        )
        return _primary_failure_update(state, error)

    try:
        result = _resolve_precise_lookup(state)(address, state)
        validated, error = _validate_primary_result(result, retry_count)
    except Exception as exc:
        category, retryable = _classify_exception(exc)
        error = _make_error(
            "precise_location_lookup",
            category,
            _safe_message(exc),
            retryable=retryable,
            retry_count=retry_count,
        )
        return _primary_failure_update(state, error)

    if error is not None:
        return _primary_failure_update(state, error)

    return {
        "primary_result": validated,
        "primary_location_failed": False,
        "error_category": None,
        "recovery_action": None,
        "status": "in_progress",
        "event_log": _append_event(
            state,
            "call_precise_lookup",
            "primary_success",
            {"address": validated.get("address"), "retry_count": retry_count},
        ),
    }


def diagnose_failure(state: ExceptionRecoveryState) -> dict[str, Any]:
    if state.get("primary_result"):
        return {
            "error_category": None,
            "recovery_action": "return_primary",
            "event_log": _append_event(
                state,
                "diagnose_failure",
                "diagnosis_return_primary",
                {"reason": "primary lookup produced a valid result"},
            ),
        }

    last_error = state.get("last_error") or {}
    category = _normalize_error_category(last_error.get("category")) or "severe"
    retryable = bool(last_error.get("retryable", False))
    retry_count = state.get("retry_count", 0)
    max_retries = state.get("max_retries", DEFAULT_MAX_RETRIES)
    fallback_area = _fallback_area(state)

    if category == "transient" and retryable and retry_count < max_retries:
        return {
            "error_category": category,
            "recovery_action": "retry",
            "event_log": _append_event(
                state,
                "diagnose_failure",
                "diagnosis_retry",
                {
                    "retry_count": retry_count,
                    "max_retries": max_retries,
                    "category": category,
                },
            ),
        }

    if category != "severe" and fallback_area is not None:
        return {
            "error_category": category,
            "recovery_action": "fallback",
            "event_log": _append_event(
                state,
                "diagnose_failure",
                "diagnosis_fallback",
                {"fallback_area": fallback_area, "category": category},
            ),
        }

    return {
        "error_category": category,
        "recovery_action": "review",
        "needs_human_review": True,
        "status": "needs_review",
        "event_log": _append_event(
            state,
            "diagnose_failure",
            "diagnosis_review",
            {"category": category, "fallback_available": fallback_area is not None},
        ),
    }


def retry_precise_lookup(state: ExceptionRecoveryState) -> dict[str, Any]:
    next_retry_count = state.get("retry_count", 0) + 1
    return {
        "retry_count": next_retry_count,
        "status": "in_progress",
        "event_log": _append_event(
            state,
            "retry_precise_lookup",
            "retry_scheduled",
            {
                "retry_count": next_retry_count,
                "max_retries": state.get("max_retries", DEFAULT_MAX_RETRIES),
                "category": state.get("error_category"),
            },
        ),
    }


def call_general_area_lookup(state: ExceptionRecoveryState) -> dict[str, Any]:
    fallback_area = _fallback_area(state)
    retry_count = state.get("retry_count", 0)
    if fallback_area is None:
        error = _make_error(
            "general_area_lookup",
            "invalid_input",
            "Fallback lookup requires a city or broader area.",
            retryable=False,
            retry_count=retry_count,
        )
        return _fallback_failure_update(state, error)

    try:
        result = _resolve_fallback_lookup(state)(fallback_area, state)
        validated, error = _validate_fallback_result(
            result,
            fallback_area=fallback_area,
            retry_count=retry_count,
        )
    except Exception as exc:
        category, retryable = _classify_exception(exc)
        error = _make_error(
            "general_area_lookup",
            category,
            _safe_message(exc),
            retryable=retryable,
            retry_count=retry_count,
        )
        return _fallback_failure_update(state, error)

    if error is not None:
        return _fallback_failure_update(state, error)

    return {
        "fallback_result": validated,
        "fallback_location_failed": False,
        "status": "in_progress",
        "event_log": _append_event(
            state,
            "call_general_area_lookup",
            "fallback_success",
            {"city": validated.get("city")},
        ),
    }


def select_recovered_result(state: ExceptionRecoveryState) -> dict[str, Any]:
    primary_result = state.get("primary_result")
    fallback_result = state.get("fallback_result")

    if primary_result:
        return {
            "location_result": primary_result,
            "recovery_action": "return_primary",
            "status": "ok",
            "event_log": _append_event(
                state,
                "select_recovered_result",
                "result_selected",
                {"source": "primary"},
            ),
        }

    if fallback_result:
        return {
            "location_result": fallback_result,
            "recovery_action": "degrade",
            "status": "degraded",
            "event_log": _append_event(
                state,
                "select_recovered_result",
                "result_selected",
                {"source": "fallback"},
            ),
        }

    return {
        "location_result": None,
        "recovery_action": "fail",
        "status": "failed",
        "needs_human_review": bool(state.get("needs_human_review", True)),
        "event_log": _append_event(
            state,
            "select_recovered_result",
            "recovery_failed",
            {"error_count": len(state.get("tool_errors", []))},
        ),
    }


def mark_for_review(state: ExceptionRecoveryState) -> dict[str, Any]:
    return {
        "needs_human_review": True,
        "recovery_action": "review",
        "status": "needs_review",
        "event_log": _append_event(
            state,
            "mark_for_review",
            "escalated_for_review",
            {
                "category": state.get("error_category"),
                "last_error": _last_error_summary(state),
            },
        ),
    }


def finalize_response(state: ExceptionRecoveryState) -> dict[str, Any]:
    primary_result = state.get("primary_result")
    fallback_result = state.get("fallback_result")
    event_log = state.get("event_log", [])
    recovery_path = _recovery_path(event_log)

    if primary_result:
        status = "ok"
        result_source = "primary"
        result = primary_result
        message = "Found precise location information for the requested address."
    elif fallback_result:
        status = "degraded"
        result_source = "fallback"
        result = fallback_result
        message = "Precise lookup failed, but general area information is available."
    else:
        status = "failed"
        result_source = None
        result = None
        message = (
            "Location lookup failed after controlled recovery handling. "
            "The case is marked for review."
            if state.get("needs_human_review", False)
            else "Location lookup failed after controlled recovery handling."
        )

    final_output = {
        "status": status,
        "message": message,
        "result": result,
        "result_source": result_source,
        "recovery_path": recovery_path,
        "needs_human_review": bool(state.get("needs_human_review", False)),
        "diagnostics": _diagnostics_summary(state),
    }

    return {
        "status": status,
        "final_output": final_output,
        "event_log": _append_event(
            state,
            "finalize_response",
            "finalized",
            {"status": status, "result_source": result_source},
        ),
    }


def precise_location_lookup(
    address: str, state: ExceptionRecoveryState
) -> dict[str, Any]:
    text = address.lower()
    if "timeout" in text:
        raise TimeoutError("simulated precise lookup timeout")
    if "temporary" in text:
        raise TransientLocationError("simulated temporary precise lookup failure")
    if "unknown" in text or "not found" in text:
        raise LocationNotFoundError("simulated precise location not found")
    if "unavailable" in text:
        raise ServiceUnavailableError("simulated precise lookup service unavailable")
    if "severe" in text:
        raise SevereLocationError("simulated severe precise lookup failure")
    if "malformed" in text:
        return {"status": "ok", "value": address}

    return {
        "address": address,
        "confidence": 0.88,
        "source": "simulated_precise_lookup",
    }


def general_area_lookup(
    city: str, state: ExceptionRecoveryState
) -> dict[str, Any]:
    text = city.lower()
    if "timeout" in text:
        raise TimeoutError("simulated general area lookup timeout")
    if "unknown" in text or "not found" in text:
        raise LocationNotFoundError("simulated general area not found")
    if "unavailable" in text:
        raise ServiceUnavailableError("simulated general area service unavailable")
    if "severe" in text:
        raise SevereLocationError("simulated severe fallback lookup failure")

    return {
        "city": city,
        "summary": f"General area information for {city}.",
        "confidence": 0.62,
        "source": "simulated_general_area_lookup",
    }


def _primary_failure_update(
    state: ExceptionRecoveryState,
    error: ToolError,
) -> dict[str, Any]:
    return {
        "primary_location_failed": True,
        "primary_result": None,
        "last_error": error,
        "tool_errors": _append_tool_error(state, error),
        "error_category": error["category"],
        "status": "in_progress",
        "event_log": _append_event(
            state,
            "call_precise_lookup",
            "primary_failed",
            {
                "category": error["category"],
                "retryable": error["retryable"],
                "retry_count": error["retry_count"],
            },
        ),
    }


def _fallback_failure_update(
    state: ExceptionRecoveryState,
    error: ToolError,
) -> dict[str, Any]:
    needs_review = state.get("needs_human_review", False) or error["category"] in {
        "severe",
        "service_unavailable",
    }
    return {
        "fallback_location_failed": True,
        "fallback_result": None,
        "last_error": error,
        "tool_errors": _append_tool_error(state, error),
        "error_category": error["category"],
        "needs_human_review": needs_review,
        "status": "in_progress",
        "event_log": _append_event(
            state,
            "call_general_area_lookup",
            "fallback_failed",
            {
                "category": error["category"],
                "retryable": error["retryable"],
                "retry_count": error["retry_count"],
            },
        ),
    }


def _validate_primary_result(
    result: Any, retry_count: int
) -> tuple[dict[str, Any] | None, ToolError | None]:
    if not isinstance(result, dict):
        return None, _make_error(
            "precise_location_lookup",
            "malformed_output",
            "Precise lookup returned a non-object result.",
            retryable=False,
            retry_count=retry_count,
        )

    status = _normalize_text(result.get("status", "")).lower()
    if status in {"not_found", "missing"}:
        return None, _make_error(
            "precise_location_lookup",
            "not_found",
            "Precise lookup reported no matching location.",
            retryable=False,
            retry_count=retry_count,
        )
    if status in {"timeout", "temporary", "transient"}:
        return None, _make_error(
            "precise_location_lookup",
            "transient",
            "Precise lookup reported a transient failure.",
            retryable=True,
            retry_count=retry_count,
        )
    if status in {"unavailable", "service_unavailable"}:
        return None, _make_error(
            "precise_location_lookup",
            "service_unavailable",
            "Precise lookup service is unavailable.",
            retryable=False,
            retry_count=retry_count,
        )
    if status in {"severe", "fatal"}:
        return None, _make_error(
            "precise_location_lookup",
            "severe",
            "Precise lookup reported a severe failure.",
            retryable=False,
            retry_count=retry_count,
        )

    address = _string_or_none(
        result.get("address")
        or result.get("formatted_address")
        or result.get("place")
        or result.get("name")
    )
    if address is None:
        return None, _make_error(
            "precise_location_lookup",
            "malformed_output",
            "Precise lookup result is missing address.",
            retryable=False,
            retry_count=retry_count,
        )

    validated = dict(result)
    validated["address"] = address
    confidence = _coerce_score(result.get("confidence"))
    if confidence is not None:
        validated["confidence"] = confidence
    return validated, None


def _validate_fallback_result(
    result: Any,
    *,
    fallback_area: str,
    retry_count: int,
) -> tuple[dict[str, Any] | None, ToolError | None]:
    if not isinstance(result, dict):
        return None, _make_error(
            "general_area_lookup",
            "malformed_output",
            "Fallback lookup returned a non-object result.",
            retryable=False,
            retry_count=retry_count,
        )

    status = _normalize_text(result.get("status", "")).lower()
    if status in {"not_found", "missing"}:
        return None, _make_error(
            "general_area_lookup",
            "not_found",
            "Fallback lookup reported no matching area.",
            retryable=False,
            retry_count=retry_count,
        )
    if status in {"unavailable", "service_unavailable"}:
        return None, _make_error(
            "general_area_lookup",
            "service_unavailable",
            "Fallback lookup service is unavailable.",
            retryable=False,
            retry_count=retry_count,
        )
    if status in {"severe", "fatal"}:
        return None, _make_error(
            "general_area_lookup",
            "severe",
            "Fallback lookup reported a severe failure.",
            retryable=False,
            retry_count=retry_count,
        )

    city = _string_or_none(result.get("city") or result.get("area") or fallback_area)
    summary = _string_or_none(result.get("summary") or result.get("description"))
    if city is None or summary is None:
        return None, _make_error(
            "general_area_lookup",
            "malformed_output",
            "Fallback lookup result is missing city or summary.",
            retryable=False,
            retry_count=retry_count,
        )

    validated = dict(result)
    validated["city"] = city
    validated["summary"] = summary
    confidence = _coerce_score(result.get("confidence"))
    if confidence is not None:
        validated["confidence"] = confidence
    return validated, None


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


def _parse_json_object(raw_text: str) -> tuple[dict[str, Any], list[str]]:
    candidate = _strip_code_fence(raw_text)
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return {}, [f"Malformed parser JSON: {exc.msg}."]

    if not isinstance(parsed, dict):
        return {}, ["Parser JSON root must be an object."]

    return parsed, []


def _strip_code_fence(raw_text: str) -> str:
    text = str(raw_text).strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _heuristic_location_parts(query: str) -> tuple[str | None, str | None]:
    query = _normalize_text(query)
    if not query:
        return None, None

    address = query
    city: str | None = None
    comma_parts = [part.strip() for part in query.split(",") if part.strip()]
    if len(comma_parts) >= 2:
        last_part = comma_parts[-1]
        city = comma_parts[-2] if _looks_like_region_code(last_part) else last_part
    else:
        match = re.search(
            r"\b(?:in|near|around|for)\s+([A-Z][A-Za-z .'-]{2,})\b",
            query,
        )
        if match:
            city = _normalize_text(match.group(1))

    return address, city


def _looks_like_region_code(value: str) -> bool:
    cleaned = re.sub(r"[^A-Za-z]", "", value)
    return 1 <= len(cleaned) <= 3 and cleaned.upper() == cleaned


def _resolve_precise_lookup(state: ExceptionRecoveryState):
    tool = state.get("primary_lookup_tool")
    return tool if callable(tool) else precise_location_lookup


def _resolve_fallback_lookup(state: ExceptionRecoveryState):
    tool = state.get("fallback_lookup_tool")
    return tool if callable(tool) else general_area_lookup


def _classify_exception(exc: Exception) -> tuple[ErrorCategory, bool]:
    if isinstance(exc, (TimeoutError, TransientLocationError)):
        return "transient", True
    if isinstance(exc, LocationNotFoundError):
        return "not_found", False
    if isinstance(exc, ServiceUnavailableError):
        return "service_unavailable", False
    if isinstance(exc, SevereLocationError):
        return "severe", False
    if isinstance(exc, ValueError):
        return "invalid_input", False

    message = str(exc).lower()
    if any(term in message for term in ("timeout", "timed out", "temporary")):
        return "transient", True
    if "not found" in message or "no matching" in message:
        return "not_found", False
    if any(term in message for term in ("unavailable", "offline", "down")):
        return "service_unavailable", False
    if any(term in message for term in ("credential", "permission", "auth", "fatal")):
        return "severe", False
    return "severe", False


def _make_error(
    operation: str,
    category: ErrorCategory,
    message: str,
    *,
    retryable: bool,
    retry_count: int,
) -> ToolError:
    return {
        "operation": operation,
        "category": category,
        "message": _truncate(_redact_sensitive(_normalize_text(message)), 240),
        "retryable": retryable,
        "retry_count": retry_count,
    }


def _append_tool_error(
    state: ExceptionRecoveryState,
    error: ToolError,
) -> list[ToolError]:
    return [*state.get("tool_errors", []), error]


def _append_event(
    state: ExceptionRecoveryState,
    node: str,
    event: str,
    details: dict[str, Any] | None = None,
) -> list[EventLogEntry]:
    return _append_event_to_log(state.get("event_log", []), node, event, details)


def _append_event_to_log(
    event_log: list[EventLogEntry],
    node: str,
    event: str,
    details: dict[str, Any] | None = None,
) -> list[EventLogEntry]:
    return [
        *event_log,
        {
            "node": node,
            "event": event,
            "details": details or {},
        },
    ]


def _diagnostics_summary(state: ExceptionRecoveryState) -> dict[str, Any]:
    tool_errors = state.get("tool_errors", [])
    categories: list[str] = []
    for error in tool_errors:
        category = str(error.get("category", ""))
        if category and category not in categories:
            categories.append(category)

    return {
        "error_count": len(tool_errors),
        "error_categories": categories,
        "last_error": _last_error_summary(state),
        "retry_count": state.get("retry_count", 0),
        "max_retries": state.get("max_retries", DEFAULT_MAX_RETRIES),
        "primary_location_failed": bool(state.get("primary_location_failed", False)),
        "fallback_location_failed": bool(state.get("fallback_location_failed", False)),
    }


def _last_error_summary(state: ExceptionRecoveryState) -> dict[str, Any] | None:
    last_error = state.get("last_error")
    if not last_error:
        return None
    return {
        "operation": last_error.get("operation"),
        "category": last_error.get("category"),
        "message": last_error.get("message"),
        "retryable": last_error.get("retryable"),
        "retry_count": last_error.get("retry_count"),
    }


def _recovery_path(event_log: list[EventLogEntry]) -> list[str]:
    return [
        str(entry.get("event"))
        for entry in event_log
        if entry.get("event") in RECOVERY_PATH_EVENTS
    ]


def _fallback_area(state: ExceptionRecoveryState) -> str | None:
    return _string_or_none(state.get("city"))


def _normalize_error_category(value: Any) -> ErrorCategory | None:
    if value in {
        "transient",
        "not_found",
        "invalid_input",
        "malformed_output",
        "service_unavailable",
        "severe",
    }:
        return value
    return None


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = _normalize_text(value)
    if not text or text.lower() in {"none", "null", "unknown"}:
        return None
    return text


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def _coerce_score(value: Any) -> float | None:
    if value is None:
        return None
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, score))


def _safe_message(exc: Exception) -> str:
    return str(exc) or exc.__class__.__name__


def _redact_sensitive(text: str) -> str:
    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[redacted-email]", text)
    text = re.sub(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b", "[redacted-phone]", text)
    text = re.sub(r"\b(?:sk|pk|api)[_-]?[A-Za-z0-9]{16,}\b", "[redacted-token]", text)
    return text


def _truncate(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."
