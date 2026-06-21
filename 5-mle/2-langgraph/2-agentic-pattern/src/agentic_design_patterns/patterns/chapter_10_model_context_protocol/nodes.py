from __future__ import annotations

import inspect
import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_10_model_context_protocol.prompts import (
    MCP_FINAL_SYSTEM_PROMPT,
    MCP_FINAL_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_10_model_context_protocol.state import (
    MCPState,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_MAX_INVOCATION_ATTEMPTS = 2
MAX_INPUT_CHARS = 4000
MAX_CONTEXT_CHARS = 5000
MANIFEST_VERSION = "chapter-10-mcp-adapter-v1"

READABLE_CONTENT_TYPES = {
    "",
    "application/json",
    "text/csv",
    "text/html",
    "text/markdown",
    "text/plain",
}
OPAQUE_CONTENT_TYPES = {
    "application/octet-stream",
    "application/pdf",
    "audio/mpeg",
    "image/jpeg",
    "image/png",
    "video/mp4",
}
SAFE_TOOL_PREFIXES = (
    "find",
    "get",
    "greet",
    "list",
    "lookup",
    "read",
    "render",
    "search",
    "summarize",
)
HIGH_IMPACT_TERMS = {
    "approve",
    "buy",
    "charge",
    "control device",
    "create",
    "delete",
    "deploy",
    "email",
    "external message",
    "financial",
    "message",
    "payment",
    "purchase",
    "refund",
    "send",
    "shutdown",
    "transfer",
    "update",
    "write",
}
RECOVERABLE_ERROR_TYPES = {"execution", "server_unavailable", "timeout", "transport"}
REVIEW_ERROR_TYPES = {"authentication", "authorization", "forbidden", "permission"}


def preprocess_request(state: MCPState) -> dict[str, Any]:
    raw_input = state.get("input", "")
    normalized_input = _normalize_text("" if raw_input is None else str(raw_input))
    errors = list(state.get("errors", []))
    metadata = dict(state.get("metadata", {}))
    metadata["pattern"] = "model_context_protocol"
    metadata["manifest_version"] = MANIFEST_VERSION

    if len(normalized_input) > MAX_INPUT_CHARS:
        normalized_input = normalized_input[:MAX_INPUT_CHARS].rstrip()
        errors.append(f"Input was truncated to {MAX_INPUT_CHARS} characters.")

    updates: dict[str, Any] = {
        "normalized_input": normalized_input,
        "intent": None,
        "operation_type": None,
        "server_preferences": _string_list(
            state.get("server_preferences", metadata.get("server_preferences", []))
        ),
        "capability_manifest": {},
        "candidate_capabilities": [],
        "selected_capability": None,
        "rejected_capabilities": list(state.get("rejected_capabilities", [])),
        "capability_validation": {},
        "mcp_request": None,
        "mcp_result": None,
        "context_update": None,
        "fallback_reason": None,
        "needs_human_review": False,
        "errors": errors,
        "invocation_attempts": _coerce_non_negative_int(
            state.get("invocation_attempts", 0),
            0,
        ),
        "max_invocation_attempts": max(
            1,
            _coerce_non_negative_int(
                state.get("max_invocation_attempts", DEFAULT_MAX_INVOCATION_ATTEMPTS),
                DEFAULT_MAX_INVOCATION_ATTEMPTS,
            ),
        ),
        "status": "ok",
        "metadata": metadata,
    }

    if not normalized_input:
        errors.append("Input is empty.")
        updates.update(
            {
                "status": "failed",
                "fallback_reason": "Input is empty.",
                "final_output": {
                    "status": "failed",
                    "response": "Input is empty.",
                    "selected_capability": None,
                    "mcp_result_summary": None,
                    "fallback_reason": "Input is empty.",
                    "errors": errors,
                },
            }
        )

    return updates


def classify_intent(state: MCPState) -> dict[str, Any]:
    text = state.get("normalized_input", "").lower()

    if _contains_any(text, {"prompt", "template", "checklist", "playbook"}):
        return {"intent": "use_prompt", "operation_type": "prompt"}

    if _contains_any(text, {"email", "send", "delete", "update", "write", "deploy"}):
        return {"intent": "execute_tool", "operation_type": "tool"}

    if _contains_any(
        text,
        {"list", "query", "search", "ticket", "tickets", "lookup", "greet", "call tool"},
    ):
        return {"intent": "execute_tool", "operation_type": "tool"}

    if _contains_any(
        text,
        {"read", "open", "show", "summarize", "resource", "file", "document", "contents"},
    ) or re.search(r"\b[\w.-]+\.(txt|md|json|csv)\b", text):
        return {"intent": "read_resource", "operation_type": "resource"}

    return {"intent": "answer_without_mcp", "operation_type": "none"}


def discover_capabilities(state: MCPState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    client = state.get("mcp_client")

    if client is None:
        return {
            "capability_manifest": {"servers": {}},
            "fallback_reason": "No MCP client or server is configured.",
            "status": "fallback",
            "errors": errors,
        }

    try:
        raw_manifest = _discover_from_client(client, state)
    except Exception as exc:
        errors.append(f"discover_capabilities failed: {exc}")
        return {
            "capability_manifest": {"servers": {}},
            "fallback_reason": "MCP capability discovery failed.",
            "status": "fallback",
            "errors": errors,
        }

    manifest, manifest_errors = _normalize_manifest(raw_manifest)
    errors.extend(manifest_errors)
    if manifest_errors:
        return {
            "capability_manifest": manifest,
            "fallback_reason": "MCP capability manifest is malformed.",
            "status": "fallback",
            "errors": errors,
        }

    if not manifest["servers"]:
        return {
            "capability_manifest": manifest,
            "fallback_reason": "No MCP servers exposed capabilities for this request.",
            "status": "fallback",
            "errors": errors,
        }

    return {
        "capability_manifest": manifest,
        "fallback_reason": None,
        "status": "ok",
        "errors": errors,
    }


def select_capability(state: MCPState) -> dict[str, Any]:
    operation_type = state.get("operation_type") or "none"
    if operation_type == "none":
        return {
            "candidate_capabilities": [],
            "selected_capability": None,
            "fallback_reason": None,
        }

    rejected = set(state.get("rejected_capabilities", []))
    capabilities = [
        capability
        for capability in _flatten_capabilities(state.get("capability_manifest", {}))
        if capability.get("type") == operation_type
        and _capability_id(capability) not in rejected
    ]

    candidates = [_score_candidate(capability, state) for capability in capabilities]
    candidates.sort(
        key=lambda capability: (
            capability.get("selection_score", 0),
            -len(capability.get("missing_arguments", [])),
        ),
        reverse=True,
    )

    if not candidates:
        return {
            "candidate_capabilities": [],
            "selected_capability": None,
            "fallback_reason": (
                f"No discovered MCP {operation_type} capability matched the request."
            ),
            "status": "fallback",
        }

    selected = candidates[0]
    if selected.get("selection_score", 0) <= 0:
        return {
            "candidate_capabilities": candidates,
            "selected_capability": None,
            "fallback_reason": "Only weak or irrelevant MCP capabilities were available.",
            "status": "fallback",
        }

    return {
        "candidate_capabilities": candidates,
        "selected_capability": selected,
        "fallback_reason": None,
        "status": "ok",
    }


def validate_capability(state: MCPState) -> dict[str, Any]:
    capability = state.get("selected_capability")
    if not capability:
        return {
            "capability_validation": {
                "allowed": False,
                "status": "fallback",
                "reason": "No MCP capability was selected.",
            },
            "fallback_reason": "No MCP capability was selected.",
            "status": "fallback",
        }

    errors = list(state.get("errors", []))
    missing_arguments = list(capability.get("missing_arguments", []))
    risk_flags = _risk_flags(capability)
    content_type = _content_type(capability)
    readable = _is_agent_readable_type(content_type)
    authorized = not _is_authorization_denied(capability)

    validation = {
        "allowed": authorized and not risk_flags and not missing_arguments and readable,
        "required_arguments": _required_arguments(capability),
        "missing_arguments": missing_arguments,
        "content_type": content_type or None,
        "agent_readable_output": readable,
        "risk_flags": risk_flags,
        "authorization": "allowed" if authorized else "denied",
        "status": "ok",
    }

    if not authorized:
        reason = "Authorization or permission policy denied the selected MCP capability."
        validation.update({"allowed": False, "status": "needs_review", "reason": reason})
        return {
            "capability_validation": validation,
            "fallback_reason": reason,
            "needs_human_review": True,
            "status": "needs_review",
            "errors": errors,
        }

    if risk_flags:
        reason = "High-impact MCP action requires human approval before execution."
        validation.update({"allowed": False, "status": "needs_review", "reason": reason})
        return {
            "capability_validation": validation,
            "fallback_reason": reason,
            "needs_human_review": True,
            "status": "needs_review",
            "errors": errors,
        }

    if missing_arguments:
        reason = "Missing required MCP parameters: " + ", ".join(missing_arguments) + "."
        validation.update({"allowed": False, "status": "fallback", "reason": reason})
        return {
            "capability_validation": validation,
            "fallback_reason": reason,
            "status": "fallback",
            "errors": errors,
        }

    if not readable:
        reason = (
            "Selected MCP capability is expected to return opaque output "
            f"({content_type}) that is not agent-readable."
        )
        validation.update({"allowed": False, "status": "fallback", "reason": reason})
        return {
            "capability_validation": validation,
            "fallback_reason": reason,
            "status": "fallback",
            "errors": errors,
        }

    return {
        "capability_validation": validation,
        "fallback_reason": None,
        "status": "ok",
        "errors": errors,
    }


def build_mcp_request(state: MCPState) -> dict[str, Any]:
    capability = state.get("selected_capability") or {}
    arguments = dict(capability.get("arguments", {}))
    request = {
        "server": capability.get("server"),
        "type": capability.get("type"),
        "name": capability.get("name"),
        "arguments": arguments,
        "metadata": {
            "intent": state.get("intent"),
            "operation_type": state.get("operation_type"),
            "user_request": state.get("normalized_input", ""),
        },
    }

    if capability.get("uri"):
        request["uri"] = capability["uri"]
    if capability.get("template"):
        request["template"] = capability["template"]

    return {"mcp_request": request}


def invoke_mcp_capability(state: MCPState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    request = state.get("mcp_request")
    client = state.get("mcp_client")
    invocation_attempts = state.get("invocation_attempts", 0) + 1
    selected = state.get("selected_capability")
    rejected = list(state.get("rejected_capabilities", []))

    if not request or client is None:
        reason = "No MCP request or client was available for invocation."
        errors.append(reason)
        return {
            "mcp_result": {
                "success": False,
                "error": reason,
                "error_type": "missing_request",
                "recoverable": False,
            },
            "fallback_reason": reason,
            "status": "fallback",
            "errors": errors,
            "invocation_attempts": invocation_attempts,
        }

    try:
        raw_result = _invoke_client(client, request, state)
        result = _normalize_result(raw_result)
    except Exception as exc:
        result = {
            "success": False,
            "error": str(exc),
            "error_type": "transport",
            "recoverable": True,
        }

    if not result.get("success", False):
        error_type = str(result.get("error_type") or "execution")
        error_message = str(result.get("error") or "MCP invocation failed.")
        errors.append(f"invoke_mcp_capability failed ({error_type}): {error_message}")
        if selected is not None:
            rejected.append(_capability_id(selected))
        result["recoverable"] = bool(
            result.get("recoverable", error_type in RECOVERABLE_ERROR_TYPES)
        )
        return {
            "mcp_result": result,
            "fallback_reason": error_message,
            "status": "fallback",
            "errors": errors,
            "rejected_capabilities": rejected,
            "invocation_attempts": invocation_attempts,
        }

    return {
        "mcp_result": result,
        "fallback_reason": None,
        "status": "ok",
        "errors": errors,
        "invocation_attempts": invocation_attempts,
    }


def integrate_result(state: MCPState) -> dict[str, Any]:
    result = state.get("mcp_result") or {}
    errors = list(state.get("errors", []))
    selected = state.get("selected_capability") or {}

    if not result.get("success", False):
        reason = str(result.get("error") or "MCP invocation did not succeed.")
        return {
            "context_update": None,
            "fallback_reason": reason,
            "status": "fallback",
            "errors": errors,
        }

    content_type = _content_type(result) or _content_type(selected)
    if not _is_agent_readable_type(content_type):
        reason = f"MCP output is opaque or not agent-readable ({content_type})."
        errors.append(reason)
        return {
            "context_update": None,
            "fallback_reason": reason,
            "needs_human_review": True,
            "status": "needs_review",
            "errors": errors,
        }

    content = _result_content(result)
    if content is None:
        reason = "MCP result did not contain agent-readable content."
        errors.append(reason)
        return {
            "context_update": None,
            "fallback_reason": reason,
            "needs_human_review": True,
            "status": "needs_review",
            "errors": errors,
        }

    rendered = _render_content(content)
    if len(rendered) > MAX_CONTEXT_CHARS:
        reason = f"MCP result exceeded the {MAX_CONTEXT_CHARS} character context limit."
        errors.append(reason)
        return {
            "context_update": None,
            "fallback_reason": reason,
            "needs_human_review": True,
            "status": "needs_review",
            "errors": errors,
        }

    context_update = {
        "server": selected.get("server"),
        "type": selected.get("type"),
        "name": selected.get("name"),
        "content_type": content_type or None,
        "content": content,
        "summary": _summarize_content(content),
        "item_count": _item_count(content),
    }
    return {
        "context_update": context_update,
        "fallback_reason": None,
        "status": "ok",
        "errors": errors,
    }


def answer_without_mcp(state: MCPState) -> dict[str, Any]:
    if state.get("status") == "failed":
        return {}

    operation_type = state.get("operation_type") or "none"
    fallback_reason = state.get("fallback_reason")
    if operation_type == "none":
        return {
            "context_update": {
                "type": "direct_answer",
                "summary": "No external MCP capability was needed.",
            },
            "status": "ok",
            "fallback_reason": None,
        }

    return {
        "context_update": {
            "type": "mcp_fallback",
            "summary": fallback_reason or "No safe MCP capability was available.",
        },
        "status": "fallback",
        "fallback_reason": fallback_reason or "No safe MCP capability was available.",
    }


def mark_needs_review(state: MCPState) -> dict[str, Any]:
    reason = state.get("fallback_reason") or "The MCP request requires human review."
    return {
        "needs_human_review": True,
        "status": "needs_review",
        "fallback_reason": reason,
    }


def generate_final_response(state: MCPState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    status = _final_status(state)
    selected_summary = _selected_capability_summary(state.get("selected_capability"))
    result_summary = _mcp_result_summary(state.get("mcp_result"))

    if status == "failed":
        response = state.get("fallback_reason") or "The MCP workflow failed."
    else:
        response = _generate_response_text(state, status, errors)

    final_output = {
        "status": status,
        "response": response,
        "selected_capability": selected_summary,
        "mcp_result_summary": result_summary,
        "fallback_reason": state.get("fallback_reason"),
        "needs_human_review": bool(state.get("needs_human_review", False)),
        "errors": errors,
    }
    return {"final_output": final_output, "status": status, "errors": errors}


def has_discovered_capabilities(state: MCPState) -> bool:
    return bool(_flatten_capabilities(state.get("capability_manifest", {})))


def has_remaining_candidate(state: MCPState) -> bool:
    operation_type = state.get("operation_type")
    if operation_type not in {"resource", "tool", "prompt"}:
        return False
    rejected = set(state.get("rejected_capabilities", []))
    return any(
        capability.get("type") == operation_type
        and _capability_id(capability) not in rejected
        for capability in _flatten_capabilities(state.get("capability_manifest", {}))
    )


def should_retry_invocation(state: MCPState) -> bool:
    result = state.get("mcp_result") or {}
    if result.get("success", False):
        return False
    if not result.get("recoverable", False):
        return False
    if state.get("invocation_attempts", 0) >= state.get(
        "max_invocation_attempts", DEFAULT_MAX_INVOCATION_ATTEMPTS
    ):
        return False
    return has_remaining_candidate(state)


def invocation_needs_review(state: MCPState) -> bool:
    result = state.get("mcp_result") or {}
    error_type = str(result.get("error_type") or "")
    return error_type in REVIEW_ERROR_TYPES


def _discover_from_client(client: Any, state: MCPState) -> Any:
    for method_name in ("discover_capabilities", "discover", "list_capabilities"):
        method = getattr(client, method_name, None)
        if callable(method):
            return _call_method(method, state)

    if callable(client):
        return _call_method(client, state)

    if isinstance(client, dict):
        return client.get("manifest", client)

    raise TypeError("MCP client must expose discover(), discover_capabilities(), or be callable.")


def _invoke_client(client: Any, request: dict[str, Any], state: MCPState) -> Any:
    method = getattr(client, "invoke", None)
    if callable(method):
        return _call_method(method, request, state)

    request_type = request.get("type")
    if request_type == "tool" and callable(getattr(client, "call_tool", None)):
        return _call_method(
            client.call_tool,
            request.get("server"),
            request.get("name"),
            request.get("arguments", {}),
            state,
        )
    if request_type == "resource" and callable(getattr(client, "read_resource", None)):
        return _call_method(
            client.read_resource,
            request.get("server"),
            request.get("uri") or request.get("name"),
            state,
        )
    if request_type == "prompt" and callable(getattr(client, "render_prompt", None)):
        return _call_method(
            client.render_prompt,
            request.get("server"),
            request.get("name"),
            request.get("arguments", {}),
            state,
        )

    if callable(client):
        return _call_method(client, request, state)

    raise TypeError("MCP client must expose invoke() or a type-specific invocation method.")


def _call_method(method: Any, *args: Any) -> Any:
    signature = inspect.signature(method)
    try:
        signature.bind_partial(*args)
        return method(*args)
    except TypeError:
        for count in range(len(args) - 1, -1, -1):
            try:
                signature.bind_partial(*args[:count])
            except TypeError:
                continue
            return method(*args[:count])
        raise


def _normalize_manifest(raw_manifest: Any) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    manifest = {"servers": {}}

    if raw_manifest is None:
        return manifest, errors

    if not isinstance(raw_manifest, dict):
        return manifest, ["MCP manifest must be a dictionary."]

    raw_servers = raw_manifest.get("servers", raw_manifest)
    if isinstance(raw_servers, dict):
        server_items = list(raw_servers.items())
    elif isinstance(raw_servers, list):
        server_items = []
        for index, server in enumerate(raw_servers):
            if not isinstance(server, dict):
                errors.append(f"MCP server entry {index} must be a dictionary.")
                continue
            server_name = server.get("name") or server.get("id")
            server_items.append((server_name, server))
    else:
        return manifest, ["MCP manifest servers must be a dictionary or list."]

    for server_name, server_data in server_items:
        if not server_name:
            errors.append("MCP server entry is missing a name.")
            continue
        if not isinstance(server_data, dict):
            errors.append(f"MCP server {server_name!r} must be a dictionary.")
            continue

        normalized_server = {
            "name": str(server_name),
            "description": str(server_data.get("description") or ""),
            "resources": [],
            "tools": [],
            "prompts": [],
        }
        for plural_name, capability_type in (
            ("resources", "resource"),
            ("tools", "tool"),
            ("prompts", "prompt"),
        ):
            entries = _capability_entries(server_data, plural_name)
            if not isinstance(entries, list):
                errors.append(
                    f"MCP server {server_name!r} field {plural_name!r} must be a list."
                )
                continue
            for index, entry in enumerate(entries):
                if not isinstance(entry, dict):
                    errors.append(
                        f"MCP {capability_type} entry {server_name!r}[{index}] must be a dictionary."
                    )
                    continue
                capability = dict(entry)
                name = capability.get("name") or capability.get("id") or capability.get("uri")
                if not name:
                    errors.append(
                        f"MCP {capability_type} entry {server_name!r}[{index}] is missing a name or URI."
                    )
                    continue
                capability["server"] = str(server_name)
                capability["type"] = capability_type
                capability["name"] = str(name)
                capability.setdefault("description", "")
                normalized_server[plural_name].append(capability)
        manifest["servers"][str(server_name)] = normalized_server

    return manifest, errors


def _capability_entries(server_data: dict[str, Any], plural_name: str) -> Any:
    if plural_name in server_data:
        return server_data[plural_name]
    capabilities = server_data.get("capabilities")
    if isinstance(capabilities, dict) and plural_name in capabilities:
        return capabilities[plural_name]
    return []


def _flatten_capabilities(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    servers = manifest.get("servers", {})
    if not isinstance(servers, dict):
        return []

    capabilities: list[dict[str, Any]] = []
    for server in servers.values():
        if not isinstance(server, dict):
            continue
        for plural_name in ("resources", "tools", "prompts"):
            entries = server.get(plural_name, [])
            if isinstance(entries, list):
                capabilities.extend(
                    entry for entry in entries if isinstance(entry, dict)
                )
    return capabilities


def _score_candidate(capability: dict[str, Any], state: MCPState) -> dict[str, Any]:
    candidate = dict(capability)
    input_text = state.get("normalized_input", "")
    input_tokens = set(_tokens(input_text))
    capability_tokens = set(_tokens(_capability_text(candidate)))
    score = len(input_tokens & capability_tokens)

    operation_type = state.get("operation_type")
    name = str(candidate.get("name") or "").lower()
    description = str(candidate.get("description") or "").lower()
    combined = f"{name} {description}".replace("_", " ")

    if operation_type == "tool":
        if "list" in input_tokens and _contains_any(combined, {"list", "directory", "folder", "files"}):
            score += 5
        if "ticket" in input_tokens or "tickets" in input_tokens:
            if _contains_any(combined, {"ticket", "tickets"}):
                score += 5
        if _contains_any(input_text.lower(), {"greet", "hello"}):
            if _contains_any(combined, {"greet", "hello"}):
                score += 5
        if _contains_any(input_text.lower(), {"email", "send"}):
            if _contains_any(combined, {"email", "send", "message"}):
                score += 5
    elif operation_type == "resource":
        if _contains_any(combined, {"file", "resource", "document", "read"}):
            score += 2
        uri = str(candidate.get("uri") or "").lower()
        if uri and any(token in uri for token in input_tokens):
            score += 5
    elif operation_type == "prompt":
        if _contains_any(combined, {"prompt", "template", "checklist", "playbook"}):
            score += 4

    if candidate.get("server") in state.get("server_preferences", []):
        score += 3

    arguments = _infer_arguments(candidate, state)
    missing = [
        argument
        for argument in _required_arguments(candidate)
        if _missing_argument(arguments.get(argument))
    ]
    candidate["arguments"] = arguments
    candidate["missing_arguments"] = missing
    candidate["selection_score"] = score
    candidate["capability_id"] = _capability_id(candidate)
    return candidate


def _infer_arguments(capability: dict[str, Any], state: MCPState) -> dict[str, Any]:
    arguments = _default_arguments(capability)
    text = state.get("normalized_input", "")
    text_lower = text.lower()
    required = _required_arguments(capability)
    properties = _schema_properties(capability)

    for argument in required:
        if not _missing_argument(arguments.get(argument)):
            continue
        argument_lower = argument.lower()
        if argument_lower in {"path", "directory", "folder"}:
            extracted = _extract_path(text)
            if extracted:
                arguments[argument] = extracted
        elif argument_lower in {"query", "search_query"}:
            arguments[argument] = text
        elif argument_lower == "priority":
            priority = _first_match(text_lower, ("urgent", "high", "medium", "low"))
            if priority:
                arguments[argument] = "high" if priority == "urgent" else priority
        elif argument_lower == "status":
            status = _first_match(text_lower, ("open", "closed", "resolved", "pending"))
            if status:
                arguments[argument] = status
        elif argument_lower in {"ticket_id", "ticket", "id"}:
            ticket_id = _extract_ticket_id(text)
            if ticket_id:
                arguments[argument] = ticket_id
        elif argument_lower in {"recipient", "to", "email"}:
            email = _extract_email(text)
            if email:
                arguments[argument] = email
        elif argument_lower in {"body", "message"}:
            body = _extract_message_body(text)
            if body:
                arguments[argument] = body
        elif argument_lower in {"name", "person"}:
            name = _extract_person_name(text)
            if name:
                arguments[argument] = name
        elif argument_lower in {"topic", "subject"}:
            arguments[argument] = text
        elif argument_lower in {"limit", "page_size"}:
            arguments[argument] = 10
        elif argument_lower == "uri" and capability.get("uri"):
            arguments[argument] = capability["uri"]

    for optional in ("priority", "status", "query"):
        if optional in properties and optional not in arguments:
            inferred = _infer_arguments(
                {"required_arguments": [optional], "default_arguments": arguments},
                state,
            ).get(optional)
            if inferred is not None:
                arguments[optional] = inferred

    return arguments


def _default_arguments(capability: dict[str, Any]) -> dict[str, Any]:
    for key in ("default_arguments", "defaults", "arguments"):
        value = capability.get(key)
        if isinstance(value, dict):
            return dict(value)
    return {}


def _required_arguments(capability: dict[str, Any]) -> list[str]:
    for key in ("required_arguments", "required_args"):
        value = capability.get(key)
        if isinstance(value, dict):
            return [str(item) for item in value.keys()]
        if isinstance(value, list):
            return [str(item) for item in value]

    schema = (
        capability.get("input_schema")
        or capability.get("schema")
        or capability.get("parameters")
        or {}
    )
    if isinstance(schema, dict):
        required = schema.get("required")
        if isinstance(required, list):
            return [str(item) for item in required]
    return []


def _schema_properties(capability: dict[str, Any]) -> dict[str, Any]:
    schema = (
        capability.get("input_schema")
        or capability.get("schema")
        or capability.get("parameters")
        or {}
    )
    if isinstance(schema, dict) and isinstance(schema.get("properties"), dict):
        return dict(schema["properties"])
    return {}


def _risk_flags(capability: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    if capability.get("requires_review") or capability.get("requires_approval"):
        flags.append("requires_review")
    if capability.get("requires_confirmation"):
        flags.append("requires_confirmation")

    capability_text = _capability_text(capability).lower()
    explicitly_read_only = capability.get("read_only") is True
    safe_by_name = str(capability.get("name") or "").lower().startswith(SAFE_TOOL_PREFIXES)
    high_impact = _contains_any(capability_text, HIGH_IMPACT_TERMS)
    write_capable = (
        capability.get("read_only") is False
        or capability.get("side_effects") is True
        or capability.get("write") is True
        or high_impact
    )
    if capability.get("type") == "tool" and write_capable and not explicitly_read_only:
        if high_impact or not safe_by_name:
            flags.append("high_impact_action")
    return flags


def _is_authorization_denied(capability: dict[str, Any]) -> bool:
    if capability.get("authorized") is False:
        return True
    access = str(capability.get("access") or capability.get("permission") or "").lower()
    return access in {"denied", "forbidden", "unauthorized"}


def _normalize_result(raw_result: Any) -> dict[str, Any]:
    if isinstance(raw_result, dict):
        result = dict(raw_result)
        if "success" not in result:
            status = str(result.get("status") or "").lower()
            result["success"] = status in {"ok", "success", "succeeded"} or not (
                result.get("error") or result.get("error_type")
            )
        if not result["success"] and "error_type" not in result:
            result["error_type"] = "execution"
        return result

    if raw_result is None:
        return {
            "success": False,
            "error": "MCP invocation returned no result.",
            "error_type": "execution",
            "recoverable": False,
        }

    return {"success": True, "content": raw_result, "content_type": "text/plain"}


def _result_content(result: dict[str, Any]) -> Any:
    for key in ("content", "data", "records", "items", "text", "template", "prompt"):
        if key in result:
            return result[key]
    return None


def _content_type(value: dict[str, Any]) -> str:
    for key in ("content_type", "mime_type", "output_content_type", "media_type"):
        content_type = value.get(key)
        if content_type:
            return str(content_type).split(";")[0].strip().lower()
    return ""


def _is_agent_readable_type(content_type: str) -> bool:
    normalized = str(content_type or "").split(";")[0].strip().lower()
    if normalized in OPAQUE_CONTENT_TYPES:
        return False
    return normalized in READABLE_CONTENT_TYPES or normalized.startswith("text/")


def _render_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    return json.dumps(content, ensure_ascii=True, sort_keys=True)


def _summarize_content(content: Any) -> str:
    if isinstance(content, str):
        return _truncate(content, 300)
    if isinstance(content, dict):
        if isinstance(content.get("items"), list):
            return "Items: " + ", ".join(str(item) for item in content["items"][:10])
        if isinstance(content.get("records"), list):
            return f"{len(content['records'])} records returned."
    if isinstance(content, list):
        return f"{len(content)} items returned."
    return _truncate(_render_content(content), 300)


def _item_count(content: Any) -> int | None:
    if isinstance(content, list):
        return len(content)
    if isinstance(content, dict):
        for key in ("items", "records", "results"):
            if isinstance(content.get(key), list):
                return len(content[key])
    return None


def _generate_response_text(state: MCPState, status: str, errors: list[str]) -> str:
    generator = state.get("response_generator")
    if callable(generator):
        try:
            return _normalize_text(str(generator(state)))
        except Exception as exc:
            errors.append(f"generate_final_response callable failed: {exc}")

    try:
        return _invoke_model(
            MCP_FINAL_SYSTEM_PROMPT,
            MCP_FINAL_USER_PROMPT.format(
                normalized_input=state.get("normalized_input", ""),
                status=status,
                intent=state.get("intent"),
                operation_type=state.get("operation_type"),
                selected_capability=_to_json_text(
                    _selected_capability_summary(state.get("selected_capability"))
                ),
                context_update=_to_json_text(state.get("context_update")),
                fallback_reason=state.get("fallback_reason"),
                errors=_to_json_text(errors),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider failures vary.
        errors.append(f"generate_final_response model invocation failed: {exc}")
        return _deterministic_response(state, status)


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


def _deterministic_response(state: MCPState, status: str) -> str:
    reason = state.get("fallback_reason")
    context_update = state.get("context_update") or {}
    selected = _selected_capability_summary(state.get("selected_capability"))

    if status == "needs_review":
        capability = (
            f"{selected['server']}:{selected['type']}:{selected['name']}"
            if selected
            else "the selected MCP capability"
        )
        return f"I found {capability}, but {reason or 'human review is required'}."

    if status == "fallback":
        return f"I could not safely use an MCP capability: {reason or 'no safe capability was available'}."

    if state.get("operation_type") == "none":
        return "This request does not require an external MCP capability."

    summary = context_update.get("summary")
    if summary:
        return str(summary)
    return "The MCP capability completed successfully."


def _final_status(state: MCPState) -> str:
    if state.get("status") == "failed":
        return "failed"
    if state.get("needs_human_review") or state.get("status") == "needs_review":
        return "needs_review"
    if state.get("status") == "fallback" or (
        state.get("fallback_reason") and state.get("operation_type") != "none"
    ):
        return "fallback"
    return "ok"


def _selected_capability_summary(capability: dict[str, Any] | None) -> dict[str, Any] | None:
    if not capability:
        return None
    return {
        "server": capability.get("server"),
        "type": capability.get("type"),
        "name": capability.get("name"),
    }


def _mcp_result_summary(result: dict[str, Any] | None) -> dict[str, Any] | None:
    if not result:
        return None
    content = _result_content(result) if result.get("success") else None
    summary = {
        "success": bool(result.get("success", False)),
        "content_type": _content_type(result) or None,
        "item_count": _item_count(content) if content is not None else None,
    }
    if not result.get("success", False):
        summary["error_type"] = result.get("error_type")
    return summary


def _capability_text(capability: dict[str, Any]) -> str:
    parts = [
        capability.get("server"),
        capability.get("type"),
        capability.get("name"),
        capability.get("description"),
        capability.get("uri"),
    ]
    aliases = capability.get("aliases")
    if isinstance(aliases, list):
        parts.extend(aliases)
    return " ".join(str(part) for part in parts if part)


def _capability_id(capability: dict[str, Any]) -> str:
    return ":".join(
        str(capability.get(key) or "")
        for key in ("server", "type", "name")
    )


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", str(text).lower().replace("_", " "))


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _contains_any(text: str, terms: set[str]) -> bool:
    normalized = text.lower()
    return any(term in normalized for term in terms)


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [_normalize_text(value)] if _normalize_text(value) else []
    if isinstance(value, list):
        return [_normalize_text(str(item)) for item in value if _normalize_text(str(item))]
    return []


def _coerce_non_negative_int(value: Any, default: int) -> int:
    try:
        integer = int(value)
    except (TypeError, ValueError):
        return default
    return max(0, integer)


def _missing_argument(value: Any) -> bool:
    return value is None or value == "" or value == []


def _first_match(text: str, options: tuple[str, ...]) -> str | None:
    for option in options:
        if re.search(rf"\b{re.escape(option)}\b", text):
            return option
    return None


def _extract_path(text: str) -> str | None:
    lowered = text.lower()
    if "managed folder" in lowered:
        return "managed"
    match = re.search(r"(?:folder|directory|path)\s+([A-Za-z0-9_./-]+)", text)
    if match:
        return match.group(1).rstrip(".")
    match = re.search(r"\b([A-Za-z0-9_./-]+\.(?:txt|md|json|csv))\b", text)
    if match:
        return match.group(1)
    return None


def _extract_ticket_id(text: str) -> str | None:
    match = re.search(r"\bticket\s*#?\s*([A-Za-z0-9_-]+)\b", text, re.IGNORECASE)
    if match and match.group(1).lower() not in {"ticket", "lookup", "tool"}:
        return match.group(1)
    return None


def _extract_email(text: str) -> str | None:
    match = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
    return match.group(0) if match else None


def _extract_message_body(text: str) -> str | None:
    match = re.search(r"(?:saying|message|body)\s+(.+)$", text, re.IGNORECASE)
    return _normalize_text(match.group(1)) if match else None


def _extract_person_name(text: str) -> str | None:
    match = re.search(r"(?:greet|hello|welcome)\s+([A-Z][A-Za-z-]+)", text)
    if match:
        return match.group(1)
    match = re.search(r"named\s+([A-Z][A-Za-z-]+)", text)
    return match.group(1) if match else None


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."


def _to_json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True, default=str)
