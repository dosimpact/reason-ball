from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_store

from agentic_design_patterns.patterns.chapter_08_memory_management.prompts import (
    MEMORY_ASSISTANT_SYSTEM_PROMPT,
    MEMORY_ASSISTANT_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_08_memory_management.state import (
    ApprovedMemoryUpdate,
    ConversationMessage,
    MemoryCandidate,
    MemoryManagementState,
    MemoryWriteResult,
    RetrievedMemory,
    SkippedMemoryUpdate,
)
from agentic_design_patterns.shared.models import get_chat_model


MEMORY_NAMESPACE_KIND = "travel"
PREFERENCES_KEY = "preferences"
MAX_RECENT_MESSAGES = 6
MAX_INPUT_CHARS = 4000

TRAVEL_TERMS = {
    "flight",
    "flights",
    "hotel",
    "hotels",
    "travel",
    "trip",
    "itinerary",
    "airport",
    "seat",
    "seats",
    "booking",
    "book",
    "denver",
}
SENSITIVE_PATTERNS = (
    r"\bpassport\b",
    r"\bsocial security\b",
    r"\bssn\b",
    r"\bcredit card\b",
    r"\bcard number\b",
    r"\bcvv\b",
    r"\bbank account\b",
    r"\brouting number\b",
    r"\bpassword\b",
    r"\bapi key\b",
    r"\baccess token\b",
    r"\bsecret\b",
)


def prepare_turn(state: MemoryManagementState) -> dict[str, Any]:
    raw_input = "" if state.get("input") is None else str(state.get("input", ""))
    user_input = _normalize_text(raw_input)
    user_id = _normalize_identifier(state.get("user_id", ""))
    thread_id = _normalize_identifier(state.get("thread_id", ""))
    errors = list(state.get("errors", []))
    metadata = dict(state.get("metadata", {}))

    updates: dict[str, Any] = {
        "input": user_input,
        "user_id": user_id,
        "thread_id": thread_id,
        "errors": errors,
        "metadata": metadata,
        "retrieved_memories": [],
        "memory_candidates": [],
        "approved_memory_updates": [],
        "skipped_memory_updates": [],
        "memory_write_results": [],
        "review_reasons": list(state.get("review_reasons", [])),
    }

    if not user_input:
        errors.append("Input is empty.")
    if not user_id:
        errors.append("user_id is required for user-scoped long-term memory.")
    if not thread_id:
        errors.append("thread_id is required for checkpointed short-term memory.")

    if errors:
        updates.update(
            {
                "status": "failed",
                "response": "",
                "messages": list(state.get("messages", [])),
                "errors": errors,
            }
        )
        return updates

    if len(user_input) > MAX_INPUT_CHARS:
        user_input = user_input[:MAX_INPUT_CHARS].rstrip()
        updates["input"] = user_input
        metadata["input_truncated"] = True

    messages = _coerce_messages(state.get("messages", []))
    messages.append({"role": "user", "content": user_input})

    updates.update(
        {
            "messages": messages,
            "status": "ok",
            "errors": errors,
            "metadata": metadata,
        }
    )
    return updates


def build_retrieval_query(state: MemoryManagementState) -> dict[str, Any]:
    current_input = state.get("input", "")
    recent_user_messages = [
        message["content"]
        for message in state.get("messages", [])[-3:]
        if message.get("role") == "user"
    ]
    query = _normalize_text(" ".join([current_input, *recent_user_messages]))
    return {"retrieval_query": query}


def retrieve_long_term_memory(state: MemoryManagementState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    metadata = dict(state.get("metadata", {}))

    try:
        forced_error = metadata.get("force_retrieval_error")
        if forced_error:
            raise RuntimeError(str(forced_error))

        store = get_store()
        items = store.search(
            _memory_namespace(state.get("user_id", "")),
            query=state.get("retrieval_query") or None,
            limit=10,
        )
        retrieved = [
            _search_item_to_memory(item)
            for item in items
            if _memory_matches_query(item.value, state.get("retrieval_query", ""))
        ]
        return {
            "retrieved_memories": retrieved,
            "errors": errors,
            "metadata": metadata,
        }
    except Exception as exc:  # pragma: no cover - store implementations vary.
        error = f"retrieve_long_term_memory failed: {exc}"
        errors.append(error)
        metadata["retrieval_error"] = error
        if metadata.get("review_on_retrieval_error"):
            return {
                "retrieved_memories": [],
                "errors": errors,
                "metadata": metadata,
                "status": "needs_review",
                "review_reasons": [
                    *state.get("review_reasons", []),
                    "Long-term memory retrieval failed and review was requested.",
                ],
            }
        return {
            "retrieved_memories": [],
            "errors": errors,
            "metadata": metadata,
        }


def compact_short_term_memory(state: MemoryManagementState) -> dict[str, Any]:
    messages = _coerce_messages(state.get("messages", []))
    if len(messages) <= MAX_RECENT_MESSAGES:
        return {"messages": messages}

    older = messages[:-MAX_RECENT_MESSAGES]
    recent = messages[-MAX_RECENT_MESSAGES:]
    previous_summary = _normalize_text(state.get("short_term_summary", ""))
    older_summary = _summarize_messages(older)
    short_term_summary = " ".join(
        text for text in [previous_summary, older_summary] if text
    ).strip()

    return {
        "messages": recent,
        "short_term_summary": short_term_summary,
    }


def build_prompt_context(state: MemoryManagementState) -> dict[str, Any]:
    prompt_context = {
        "current_input": state.get("input", ""),
        "short_term_summary": state.get("short_term_summary", ""),
        "recent_messages": state.get("messages", [])[-MAX_RECENT_MESSAGES:],
        "retrieved_memories": state.get("retrieved_memories", []),
        "memory_errors": state.get("errors", []),
    }
    return {"prompt_context": prompt_context}


def generate_response(state: MemoryManagementState) -> dict[str, Any]:
    try:
        content = _invoke_model(
            MEMORY_ASSISTANT_SYSTEM_PROMPT,
            MEMORY_ASSISTANT_USER_PROMPT.format(
                prompt_context=json.dumps(
                    state.get("prompt_context", {}),
                    ensure_ascii=True,
                    sort_keys=True,
                )
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        error = f"generate_response model invocation failed: {exc}"
        return {
            "status": "failed",
            "errors": [*state.get("errors", []), error],
            "response": "",
        }

    messages = _coerce_messages(state.get("messages", []))
    messages.append({"role": "assistant", "content": content})
    return {
        "response": content,
        "messages": messages,
    }


def extract_memory_candidates(state: MemoryManagementState) -> dict[str, Any]:
    text = state.get("input", "")
    candidates: list[MemoryCandidate] = []

    if _contains_sensitive_data(text):
        candidates.append(
            {
                "key": "blocked_sensitive",
                "memory_type": "sensitive",
                "source_text": text,
                "sensitive": True,
                "reason": "Sensitive or regulated information requires an explicit retention policy.",
            }
        )
        return {"memory_candidates": candidates}

    values, tags = _extract_preference_values(text)
    if values:
        candidates.append(
            {
                "key": PREFERENCES_KEY,
                "memory_type": "preference",
                "values": values,
                "source_text": text,
                "tags": tags,
            }
        )
        return {"memory_candidates": candidates}

    if _is_travel_request(text):
        candidates.append(
            {
                "key": "transient_request",
                "memory_type": "transient",
                "source_text": text,
                "reason": "transient request, not durable memory",
            }
        )

    return {"memory_candidates": candidates}


def validate_memory_updates(state: MemoryManagementState) -> dict[str, Any]:
    approved: list[ApprovedMemoryUpdate] = []
    skipped: list[SkippedMemoryUpdate] = []
    errors = list(state.get("errors", []))
    review_reasons = list(state.get("review_reasons", []))
    status = state.get("status", "ok")

    existing_value = _load_existing_preferences(
        state.get("user_id", ""),
        errors,
    )
    existing_preferences = dict(existing_value.get("values", {}))
    existing_tags = _coerce_string_list(existing_value.get("tags", []))
    existing_conflicts = _coerce_conflicts(existing_value.get("conflicts", []))

    for candidate in state.get("memory_candidates", []):
        if candidate.get("sensitive"):
            skipped.append(
                {
                    "candidate": dict(candidate),
                    "reason": "sensitive memory requires review and was not persisted",
                }
            )
            status = "needs_review"
            review_reasons.append(
                "Sensitive or regulated information was rejected for persistence."
            )
            continue

        if candidate.get("memory_type") == "transient":
            skipped.append(
                {
                    "candidate": candidate.get("source_text", ""),
                    "reason": candidate.get(
                        "reason", "transient request, not durable memory"
                    ),
                }
            )
            continue

        values = dict(candidate.get("values", {}))
        if not values:
            skipped.append(
                {
                    "candidate": dict(candidate),
                    "reason": "candidate contains no durable values",
                }
            )
            continue

        duplicates = {
            key: value
            for key, value in values.items()
            if existing_preferences.get(key) == value
        }
        new_or_changed = {
            key: value
            for key, value in values.items()
            if existing_preferences.get(key) != value
        }
        for key, value in duplicates.items():
            skipped.append(
                {
                    "candidate": {key: value},
                    "reason": "duplicate memory already stored",
                }
            )

        if not new_or_changed:
            continue

        conflicts = [
            {
                "field": key,
                "previous": existing_preferences[key],
                "new": value,
            }
            for key, value in new_or_changed.items()
            if key in existing_preferences
        ]
        merged_preferences = {**existing_preferences, **new_or_changed}
        merged_tags = sorted(set(existing_tags) | set(candidate.get("tags", [])))
        update_value = {
            "memory_type": "preference",
            "values": merged_preferences,
            "tags": merged_tags,
            "source_text": candidate.get("source_text", ""),
            "updated_by_thread_id": state.get("thread_id", ""),
        }
        if existing_conflicts or conflicts:
            update_value["conflicts"] = [*existing_conflicts, *conflicts]

        approved.append(
            {
                "namespace": list(_memory_namespace(state.get("user_id", ""))),
                "key": PREFERENCES_KEY,
                "value": update_value,
                "source_text": candidate.get("source_text", ""),
                "conflicts": conflicts,
            }
        )
        existing_preferences = merged_preferences
        existing_tags = merged_tags
        existing_conflicts = _coerce_conflicts(update_value.get("conflicts", []))

    return {
        "approved_memory_updates": approved,
        "skipped_memory_updates": skipped,
        "errors": errors,
        "status": status,
        "review_reasons": review_reasons,
    }


def store_memory_updates(state: MemoryManagementState) -> dict[str, Any]:
    errors = list(state.get("errors", []))
    results: list[MemoryWriteResult] = []
    status = state.get("status", "ok")

    try:
        store = get_store()
    except Exception as exc:  # pragma: no cover - graph is normally compiled with store.
        store = None
        errors.append(f"store_memory_updates failed: {exc}")
        status = "needs_review"

    for update in state.get("approved_memory_updates", []):
        namespace = tuple(update.get("namespace", []))
        key = update.get("key", PREFERENCES_KEY)
        value = dict(update.get("value", {}))
        if store is None:
            results.append(
                {
                    "namespace": list(namespace),
                    "key": key,
                    "success": False,
                    "error": "No memory store is available.",
                }
            )
            continue

        try:
            store.put(namespace, key, value)
            results.append(
                {
                    "namespace": list(namespace),
                    "key": key,
                    "success": True,
                    "value": value,
                }
            )
        except Exception as exc:  # pragma: no cover - store implementations vary.
            error = f"store_memory_updates failed for {list(namespace)}/{key}: {exc}"
            errors.append(error)
            status = "needs_review"
            results.append(
                {
                    "namespace": list(namespace),
                    "key": key,
                    "success": False,
                    "error": error,
                }
            )

    return {
        "memory_write_results": results,
        "errors": errors,
        "status": status,
    }


def finalize(state: MemoryManagementState) -> dict[str, Any]:
    status = state.get("status", "ok")
    final_output = _final_output(state, status)
    return {
        "final_output": final_output,
        "status": status,
    }


def mark_needs_review(state: MemoryManagementState) -> dict[str, Any]:
    final_output = _final_output(state, "needs_review")
    return {
        "status": "needs_review",
        "final_output": final_output,
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


def _final_output(state: MemoryManagementState, status: str) -> dict[str, Any]:
    successful_writes = [
        result for result in state.get("memory_write_results", []) if result.get("success")
    ]
    return {
        "status": status,
        "response": state.get("response", ""),
        "retrieved_memories": state.get("retrieved_memories", []),
        "stored_updates": successful_writes,
        "skipped_updates": state.get("skipped_memory_updates", []),
        "errors": state.get("errors", []),
        "review_reasons": state.get("review_reasons", []),
    }


def _normalize_text(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text)).strip()


def _normalize_identifier(value: Any) -> str:
    return _normalize_text(value)


def _memory_namespace(user_id: str) -> tuple[str, str]:
    return (_normalize_identifier(user_id), MEMORY_NAMESPACE_KIND)


def _coerce_messages(messages: Any) -> list[ConversationMessage]:
    coerced: list[ConversationMessage] = []
    if not isinstance(messages, list):
        return coerced

    for message in messages:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        content = _normalize_text(message.get("content", ""))
        if role in {"user", "assistant"} and content:
            coerced.append({"role": role, "content": content})
    return coerced


def _summarize_messages(messages: list[ConversationMessage]) -> str:
    if not messages:
        return ""
    snippets = []
    for message in messages[-4:]:
        content = message["content"]
        snippets.append(f"{message['role']}: {content[:90]}")
    return (
        f"Earlier thread context compressed from {len(messages)} messages: "
        + " | ".join(snippets)
    )


def _search_item_to_memory(item: Any) -> RetrievedMemory:
    return {
        "namespace": list(getattr(item, "namespace", [])),
        "key": str(getattr(item, "key", "")),
        "value": dict(getattr(item, "value", {}) or {}),
        "score": getattr(item, "score", None),
    }


def _memory_matches_query(value: dict[str, Any], query: str) -> bool:
    if _is_travel_request(query):
        return True

    query_terms = _tokenize(query)
    if not query_terms:
        return True

    memory_text = " ".join(
        [
            json.dumps(value.get("values", {}), ensure_ascii=True),
            " ".join(_coerce_string_list(value.get("tags", []))),
            str(value.get("source_text", "")),
        ]
    )
    memory_terms = _tokenize(memory_text)
    return bool(query_terms & memory_terms)


def _contains_sensitive_data(text: str) -> bool:
    lowered = text.lower()
    return any(re.search(pattern, lowered) for pattern in SENSITIVE_PATTERNS)


def _extract_preference_values(text: str) -> tuple[dict[str, Any], list[str]]:
    lowered = text.lower()
    values: dict[str, Any] = {}
    tags: list[str] = []

    if not _has_memory_intent(lowered):
        return values, tags

    flight_time = _extract_flight_time(lowered)
    if flight_time:
        values["flight_time"] = flight_time
        tags.append("flight_time")

    seat = _extract_seat_preference(lowered)
    if seat:
        values["seat"] = seat
        tags.append("seat")

    hotel_constraints = _extract_hotel_constraints(lowered)
    if hotel_constraints:
        values["hotel_constraints"] = hotel_constraints
        tags.append("hotel")

    dietary_needs = _extract_dietary_needs(lowered)
    if dietary_needs:
        values["dietary_needs"] = dietary_needs
        tags.append("dietary")

    home_airport = _extract_home_airport(text)
    if home_airport:
        values["home_airport"] = home_airport
        tags.append("airport")

    return values, sorted(set(tags))


def _has_memory_intent(lowered_text: str) -> bool:
    return any(
        phrase in lowered_text
        for phrase in (
            "remember",
            "keep in mind",
            "note that",
            "i prefer",
            "i usually prefer",
            "my preference",
            "i need",
            "i require",
            "i like",
        )
    )


def _extract_flight_time(lowered_text: str) -> str | None:
    if "red eye" in lowered_text or "red-eye" in lowered_text:
        return "red-eye"
    for value in ("morning", "afternoon", "evening", "night"):
        if re.search(rf"\b{value}\b", lowered_text):
            return value
    if "early flight" in lowered_text or "early flights" in lowered_text:
        return "early"
    if "late flight" in lowered_text or "late flights" in lowered_text:
        return "late"
    return None


def _extract_seat_preference(lowered_text: str) -> str | None:
    for value in ("aisle", "window", "middle"):
        if re.search(rf"\b{value}\s+seats?\b|\b{value}\b", lowered_text):
            return value
    return None


def _extract_hotel_constraints(lowered_text: str) -> list[str]:
    constraints: list[str] = []
    if "quiet hotel" in lowered_text or "quiet hotels" in lowered_text:
        constraints.append("quiet")
    if "gym" in lowered_text or "fitness center" in lowered_text:
        constraints.append("gym")
    if "non-smoking" in lowered_text or "nonsmoking" in lowered_text:
        constraints.append("non-smoking")
    if "near the conference" in lowered_text or "near conference" in lowered_text:
        constraints.append("near conference venue")
    return sorted(set(constraints))


def _extract_dietary_needs(lowered_text: str) -> list[str]:
    needs: list[str] = []
    for value in ("vegetarian", "vegan", "gluten-free", "kosher", "halal"):
        if value in lowered_text:
            needs.append(value)
    if "nut allergy" in lowered_text or "peanut allergy" in lowered_text:
        needs.append("nut allergy")
    if "shellfish allergy" in lowered_text:
        needs.append("shellfish allergy")
    return sorted(set(needs))


def _extract_home_airport(text: str) -> str | None:
    match = re.search(
        r"\b(?:home|preferred)\s+airport\s+(?:is|=)\s+([A-Z]{3})\b",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1).upper()
    return None


def _is_travel_request(text: str) -> bool:
    return bool(_tokenize(text) & TRAVEL_TERMS)


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _load_existing_preferences(user_id: str, errors: list[str]) -> dict[str, Any]:
    try:
        item = get_store().get(_memory_namespace(user_id), PREFERENCES_KEY)
    except Exception as exc:  # pragma: no cover - store implementations vary.
        errors.append(f"validate_memory_updates failed to load existing memory: {exc}")
        return {}
    if item is None:
        return {}
    value = getattr(item, "value", {})
    return dict(value or {}) if isinstance(value, dict) else {}


def _coerce_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def _coerce_conflicts(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [dict(item) for item in value if isinstance(item, dict)]
