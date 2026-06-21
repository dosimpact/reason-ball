from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_02_routing.prompts import (
    ROUTE_SYSTEM_PROMPT,
    ROUTE_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_02_routing.state import (
    RouteLabel,
    RoutingState,
)
from agentic_design_patterns.shared.models import get_chat_model


ALLOWED_ROUTES: tuple[RouteLabel, ...] = (
    "order_status",
    "product_info",
    "technical_support",
    "clarify",
)
DEFAULT_MAX_RETRIES = 1
DEFAULT_MIN_CONFIDENCE = 0.6


def preprocess_input(state: RoutingState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    normalized_input = _normalize_text(raw_input)
    errors = list(state.get("errors", []))

    updates: dict[str, Any] = {
        "normalized_input": normalized_input,
        "errors": errors,
        "retry_count": state.get("retry_count", 0),
        "max_retries": state.get("max_retries", DEFAULT_MAX_RETRIES),
        "min_route_confidence": _min_confidence(state),
        "requires_human_review": state.get("requires_human_review", False),
        "handler_output": state.get("handler_output"),
        "final_output": state.get("final_output"),
    }

    if normalized_input:
        updates["messages"] = [HumanMessage(content=normalized_input)]

    if not normalized_input:
        errors.append("Input is empty.")
        updates.update(
            {
                "route": "clarify",
                "route_reason": "The request is missing or blank.",
                "route_confidence": 0.0,
                "errors": errors,
            }
        )

    return updates


def classify_route(state: RoutingState) -> dict[str, Any]:
    try:
        content = _invoke_model(
            ROUTE_SYSTEM_PROMPT,
            ROUTE_USER_PROMPT.format(
                normalized_input=state.get("normalized_input", "")
            ),
        )
    except Exception as exc:  # pragma: no cover - concrete provider errors vary.
        retry_count = state.get("retry_count", 0) + 1
        return {
            "retry_count": retry_count,
            "route": None,
            "route_reason": "The router model failed.",
            "route_confidence": None,
            "errors": [
                *state.get("errors", []),
                f"classify_route model invocation failed: {exc}",
            ],
        }

    return {
        "router_raw_output": content,
        "route": None,
        "route_reason": None,
        "route_confidence": None,
    }


def validate_route(state: RoutingState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    raw_output = state.get("router_raw_output")

    if raw_output is None:
        errors.append("Router did not return a decision.")
        return {
            "route": "clarify",
            "route_reason": "No route decision was available.",
            "route_confidence": 0.0,
            "errors": errors,
        }

    parsed, parse_errors = _parse_router_output(raw_output)
    if parse_errors:
        errors.extend(parse_errors)
        return {
            "route": "clarify",
            "route_reason": "The router returned an invalid decision.",
            "route_confidence": 0.0,
            "errors": errors,
        }

    route = _normalize_route(parsed.get("route"))
    reason = _string_or_none(parsed.get("reason")) or "No router reason provided."
    confidence, confidence_error = _parse_confidence(parsed.get("confidence"))

    if confidence_error:
        errors.append(confidence_error)
        return {
            "route": "clarify",
            "route_reason": "The router returned an invalid confidence score.",
            "route_confidence": 0.0,
            "errors": errors,
        }

    if route not in ALLOWED_ROUTES:
        errors.append(f"Unsupported route label: {parsed.get('route')!r}.")
        return {
            "route": "clarify",
            "route_reason": "The router selected an unsupported route.",
            "route_confidence": confidence,
            "errors": errors,
        }

    min_confidence = _min_confidence(state)
    if confidence is not None and confidence < min_confidence:
        errors.append(
            f"Router confidence {confidence:.2f} is below threshold "
            f"{min_confidence:.2f}."
        )
        return {
            "route": "clarify",
            "route_reason": "The router decision was too uncertain.",
            "route_confidence": confidence,
            "errors": errors,
        }

    return {
        "route": route,
        "route_reason": reason,
        "route_confidence": confidence,
        "errors": errors,
    }


def order_status_handler(state: RoutingState) -> dict[str, Any]:
    return _run_handler(state, "order_status_handler", _order_status_response)


def product_info_handler(state: RoutingState) -> dict[str, Any]:
    return _run_handler(state, "product_info_handler", _product_info_response)


def technical_support_handler(state: RoutingState) -> dict[str, Any]:
    return _run_handler(
        state,
        "technical_support_handler",
        _technical_support_response,
    )


def clarification_handler(state: RoutingState) -> dict[str, Any]:
    return _run_handler(state, "clarification_handler", _clarification_response)


def format_response(state: RoutingState) -> dict[str, Any]:
    handler_output = state.get("handler_output")
    errors = state.get("errors", [])

    if handler_output:
        final_output = handler_output
    elif errors:
        final_output = (
            "I could not complete the selected route. Please rephrase the "
            "request or provide the missing details."
        )
    else:
        final_output = "Please provide more detail so I can route the request."

    if state.get("requires_human_review") and "human review" not in final_output.lower():
        final_output = f"Human review required. {final_output}"

    return {
        "final_output": final_output,
        "messages": [AIMessage(content=final_output)],
    }


def should_retry_router(state: RoutingState) -> bool:
    return (
        state.get("router_raw_output") is None
        and state.get("route") is None
        and state.get("retry_count", 0) <= state.get("max_retries", DEFAULT_MAX_RETRIES)
    )


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
    return re.sub(r"\s+", " ", text).strip()


def _parse_router_output(raw_output: str) -> tuple[dict[str, Any], list[str]]:
    candidate = _strip_code_fence(raw_output)

    route = _normalize_route(candidate)
    if route in ALLOWED_ROUTES:
        return {"route": route, "reason": None, "confidence": None}, []

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        return {}, [f"Malformed router output: {exc.msg}."]

    if not isinstance(parsed, dict):
        return {}, ["Router output must be a JSON object."]

    return parsed, []


def _strip_code_fence(raw_text: str) -> str:
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
    return text


def _normalize_route(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = re.sub(r"[\s-]+", "_", value.strip().lower())
    return normalized or None


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_confidence(value: Any) -> tuple[float | None, str | None]:
    if value is None:
        return None, None

    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return None, f"Router confidence is not numeric: {value!r}."

    if confidence < 0 or confidence > 1:
        return None, f"Router confidence must be between 0 and 1: {confidence}."

    return confidence, None


def _min_confidence(state: RoutingState) -> float:
    raw_value = state.get("min_route_confidence", DEFAULT_MIN_CONFIDENCE)
    try:
        min_confidence = float(raw_value)
    except (TypeError, ValueError):
        return DEFAULT_MIN_CONFIDENCE
    return max(0.0, min(1.0, min_confidence))


def _run_handler(
    state: RoutingState,
    handler_name: str,
    handler: Callable[[RoutingState], dict[str, Any]],
) -> dict[str, Any]:
    try:
        return handler(state)
    except Exception as exc:
        return {
            "handler_output": (
                "I could not complete that route automatically. Please provide "
                "more detail or try again later."
            ),
            "errors": [
                *state.get("errors", []),
                f"{handler_name} failed: {exc}",
            ],
        }


def _order_status_response(state: RoutingState) -> dict[str, Any]:
    normalized_input = state.get("normalized_input", "")
    order_match = re.search(
        (
            r"\b(?:order|shipment|tracking)\s*"
            r"(?:number|no\.?|#|id)?\s*#?\s*([A-Z0-9-]{4,})\b"
        ),
        normalized_input,
        re.I,
    )
    if order_match:
        handler_output = (
            f"I routed this to order status. I can check order "
            f"{order_match.group(1)} once the account is verified."
        )
    else:
        handler_output = (
            "I routed this to order status. Please provide the order number "
            "or account email so I can look up the shipment."
        )
    return {"handler_output": handler_output, "requires_human_review": False}


def _product_info_response(state: RoutingState) -> dict[str, Any]:
    return {
        "handler_output": (
            "I routed this to product information. I can help with features, "
            "pricing, compatibility, or availability for the product you name."
        ),
        "requires_human_review": False,
    }


def _technical_support_response(state: RoutingState) -> dict[str, Any]:
    normalized_input = state.get("normalized_input", "").lower()
    requires_human_review = _requires_human_review(normalized_input)

    if requires_human_review:
        handler_output = (
            "Human review required. This support request may involve safety, "
            "account access, or privileged action, so I would escalate it to a "
            "qualified support specialist before giving instructions."
        )
    else:
        handler_output = (
            "I routed this to technical support. Start with the basic checks: "
            "restart the affected device or app, confirm connectivity, note any "
            "error messages, and share the model or software version."
        )

    return {
        "handler_output": handler_output,
        "requires_human_review": requires_human_review,
    }


def _clarification_response(state: RoutingState) -> dict[str, Any]:
    normalized_input = state.get("normalized_input", "")
    reason = (state.get("route_reason") or "").lower()

    if not normalized_input:
        handler_output = (
            "Please describe the order, product, or technical issue you need "
            "help with."
        )
    elif "multi" in reason:
        handler_output = (
            "Please choose one issue to handle first: order status, product "
            "information, or technical support."
        )
    else:
        handler_output = (
            "I need one more detail to route this correctly. Is this about an "
            "order, product information, or technical support?"
        )

    return {"handler_output": handler_output, "requires_human_review": False}


def _requires_human_review(normalized_input: str) -> bool:
    high_risk_terms = {
        "account takeover",
        "account access",
        "admin",
        "billing access",
        "burning",
        "delete account",
        "electric shock",
        "fire",
        "password reset",
        "privileged",
        "reset my password",
        "refund",
        "security",
        "smoke",
        "sparking",
    }
    return any(term in normalized_input for term in high_risk_terms)
