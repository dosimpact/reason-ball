from __future__ import annotations

import json
import re
import uuid
from collections.abc import Iterable
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agentic_design_patterns.patterns.chapter_15_inter_agent_communication_a2a.prompts import (
    AGGREGATION_SYSTEM_PROMPT,
    AGGREGATION_USER_PROMPT,
)
from agentic_design_patterns.patterns.chapter_15_inter_agent_communication_a2a.state import (
    A2AAuditEvent,
    A2ATaskEnvelope,
    DelegationPlanItem,
    InterAgentCommunicationA2AState,
)
from agentic_design_patterns.shared.models import get_chat_model


DEFAULT_MAX_POLL_ATTEMPTS = 3
MAX_INPUT_CHARS = 4000
MAX_ARTIFACT_CHARS = 5000
TEXT_INPUT_MODE = "text"
JSON_OUTPUT_MODE = "json"
TEXT_OUTPUT_MODE = "text"
STOP_WORDS = {
    "and",
    "are",
    "can",
    "for",
    "from",
    "give",
    "into",
    "the",
    "this",
    "tomorrow",
    "whether",
    "with",
}


def preprocess_request(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    raw_input = "" if state.get("input") is None else str(state.get("input", ""))
    normalized_input = _normalize_text(raw_input)
    if len(normalized_input) > MAX_INPUT_CHARS:
        normalized_input = normalized_input[:MAX_INPUT_CHARS].rstrip()

    session_id = _normalize_text(state.get("session_id", ""))
    if not session_id:
        session_id = f"session-{uuid.uuid4().hex[:12]}"

    metadata = dict(state.get("metadata", {}))
    metadata.update(
        {
            "pattern": "inter_agent_communication_a2a",
            "protocol": "a2a_mock_json_rpc",
            "input_length": len(normalized_input),
        }
    )

    updates: dict[str, Any] = {
        "normalized_input": normalized_input,
        "session_id": session_id,
        "context_id": state.get("context_id"),
        "discovery_mode": state.get("discovery_mode", "direct_config"),
        "validated_agent_cards": {},
        "candidate_skills": [],
        "delegation_plan": [],
        "auth_requirements": {},
        "credential_status": {},
        "a2a_tasks": {},
        "task_statuses": {},
        "task_messages": {},
        "remote_artifacts": {},
        "interaction_modes": {},
        "poll_attempts": {},
        "max_poll_attempts": _coerce_positive_int(
            state.get("max_poll_attempts", DEFAULT_MAX_POLL_ATTEMPTS),
            DEFAULT_MAX_POLL_ATTEMPTS,
        ),
        "stream_events": {},
        "pending_user_questions": [],
        "aggregation_result": None,
        "audit_log": [],
        "errors": [],
        "final_output": None,
        "status": "ok",
        "metadata": metadata,
    }

    if not normalized_input:
        updates.update(
            {
                "status": "failed",
                "errors": ["Input is empty."],
                "audit_log": [
                    _audit("preprocess_request", "failed", detail="Input is empty.")
                ],
            }
        )

    return updates


def discover_agent_cards(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    discovery_mode = state.get("discovery_mode", "direct_config")
    cards: dict[str, dict[str, Any]] = {}

    configured_cards = state.get("agent_cards")
    if isinstance(configured_cards, dict) and configured_cards:
        cards = {
            str(agent_id): dict(card)
            for agent_id, card in configured_cards.items()
            if isinstance(card, dict)
        }
    elif discovery_mode in {"none", "empty", "disabled"}:
        cards = {}
    else:
        remote_agents = state.get("remote_agents", {})
        if isinstance(remote_agents, dict):
            for agent_id, remote_agent in remote_agents.items():
                if isinstance(remote_agent, dict) and isinstance(
                    remote_agent.get("agent_card"), dict
                ):
                    cards[str(agent_id)] = dict(remote_agent["agent_card"])
        if not cards:
            cards = _default_agent_cards()

    audit_event = _audit(
        "discover_agent_cards",
        "discovered",
        detail=f"Discovered {len(cards)} Agent Card(s).",
        metadata={"discovery_mode": discovery_mode, "agent_ids": sorted(cards)},
    )
    return {
        "agent_cards": cards,
        "audit_log": [*state.get("audit_log", []), audit_event],
    }


def validate_agent_cards(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    validated: dict[str, dict[str, Any]] = {}
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))

    for agent_id, card in state.get("agent_cards", {}).items():
        normalized, validation_errors = _validate_agent_card(agent_id, card)
        if validation_errors:
            errors.extend(
                f"Agent Card {agent_id!r} rejected: {message}"
                for message in validation_errors
            )
            audit_log.append(
                _audit(
                    "validate_agent_cards",
                    "rejected",
                    agent_id=agent_id,
                    detail="; ".join(validation_errors),
                )
            )
            continue
        validated[agent_id] = normalized
        audit_log.append(
            _audit(
                "validate_agent_cards",
                "validated",
                agent_id=agent_id,
                detail=f"Validated {len(normalized.get('skills', []))} skill(s).",
            )
        )

    status = state.get("status", "ok")
    if not validated:
        status = "no_agents_available"
        errors.append("No valid Agent Cards are available for delegation.")

    return {
        "validated_agent_cards": validated,
        "errors": errors,
        "audit_log": audit_log,
        "status": status,
    }


def plan_remote_delegation(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    normalized_input = state.get("normalized_input", "")
    candidate_skills = _candidate_skills(state.get("validated_agent_cards", {}))
    selected: list[DelegationPlanItem] = []
    audit_log = list(state.get("audit_log", []))
    errors = list(state.get("errors", []))

    for candidate in candidate_skills:
        if _skill_matches_request(candidate, normalized_input):
            selected.append(
                {
                    "agent_id": candidate["agent_id"],
                    "agent_name": candidate["agent_name"],
                    "endpoint": candidate["endpoint"],
                    "skill_id": candidate["skill_id"],
                    "skill_name": candidate["skill_name"],
                    "reason": _selection_reason(candidate, normalized_input),
                    "input_modes": list(candidate.get("input_modes", [])),
                    "accepted_output_modes": list(candidate.get("output_modes", [])),
                }
            )

    selected = _deduplicate_plan(selected)
    if not selected:
        errors.append("No advertised remote skill matches the request.")
        audit_log.append(
            _audit(
                "plan_remote_delegation",
                "no_match",
                detail="No advertised skill matched the normalized request.",
                metadata={"candidate_count": len(candidate_skills)},
            )
        )
        return {
            "candidate_skills": candidate_skills,
            "delegation_plan": [],
            "errors": errors,
            "status": "no_matching_skill",
            "audit_log": audit_log,
        }

    audit_log.append(
        _audit(
            "plan_remote_delegation",
            "planned",
            detail=f"Selected {len(selected)} remote skill(s).",
            metadata={
                "selected": [
                    {
                        "agent_id": item["agent_id"],
                        "skill_id": item["skill_id"],
                    }
                    for item in selected
                ]
            },
        )
    )
    return {
        "candidate_skills": candidate_skills,
        "delegation_plan": selected,
        "status": "ok",
        "audit_log": audit_log,
    }


def check_credentials(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    credentials = state.get("credentials", {})
    if not isinstance(credentials, dict):
        credentials = {}

    auth_requirements: dict[str, dict[str, Any]] = {}
    credential_status: dict[str, str] = {}
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))
    status = state.get("status", "ok")
    cards = state.get("validated_agent_cards", {})

    for item in state.get("delegation_plan", []):
        agent_id = item["agent_id"]
        auth = dict(cards.get(agent_id, {}).get("authentication", {}) or {})
        sanitized_auth = {
            key: value
            for key, value in auth.items()
            if key not in {"token", "secret", "api_key", "password"}
        }
        auth_requirements[agent_id] = sanitized_auth

        if not auth.get("required", False):
            credential_status[agent_id] = "not_required"
            continue

        alias = _normalize_text(auth.get("credential_alias") or agent_id)
        value = credentials.get(alias)
        if not value:
            credential_status[agent_id] = "missing"
            status = "auth_failed"
            errors.append(
                f"Missing credentials for {agent_id} using alias {alias!r}."
            )
            audit_log.append(
                _audit(
                    "check_credentials",
                    "missing",
                    agent_id=agent_id,
                    detail=f"Credential alias {alias!r} is missing.",
                )
            )
            continue
        if _normalize_text(value).lower() == "invalid":
            credential_status[agent_id] = "invalid"
            status = "auth_failed"
            errors.append(
                f"Invalid credentials for {agent_id} using alias {alias!r}."
            )
            audit_log.append(
                _audit(
                    "check_credentials",
                    "invalid",
                    agent_id=agent_id,
                    detail=f"Credential alias {alias!r} is invalid.",
                )
            )
            continue

        credential_status[agent_id] = "available"
        audit_log.append(
            _audit(
                "check_credentials",
                "available",
                agent_id=agent_id,
                detail=f"Credential alias {alias!r} is available.",
            )
        )

    return {
        "auth_requirements": auth_requirements,
        "credential_status": credential_status,
        "errors": errors,
        "status": status,
        "audit_log": audit_log,
    }


def choose_interaction_mode(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    preferred_modes = state.get("preferred_interaction_modes", {})
    if not isinstance(preferred_modes, dict):
        preferred_modes = {}

    cards = state.get("validated_agent_cards", {})
    delegation_plan: list[DelegationPlanItem] = []
    interaction_modes: dict[str, str] = {}
    task_statuses = dict(state.get("task_statuses", {}))
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))
    status = state.get("status", "ok")

    for item in state.get("delegation_plan", []):
        card = cards.get(item["agent_id"], {})
        skill = _skill_by_id(card, item["skill_id"])
        preferred = (
            preferred_modes.get(item["agent_id"])
            or preferred_modes.get(item["skill_id"])
            or skill.get("preferred_interaction_mode")
            or item.get("interaction_mode")
        )
        mode = _select_interaction_mode(card, skill, str(preferred or ""))
        local_task_id = _local_task_id(item["agent_id"], item["skill_id"])
        item = dict(item)
        item["interaction_mode"] = mode
        item["local_task_id"] = local_task_id
        delegation_plan.append(item)
        interaction_modes[local_task_id] = mode

        mode_error = _mode_error(card, item, mode)
        if mode_error:
            errors.append(mode_error)
            task_statuses[local_task_id] = "unsupported"
            status = "unsupported"
            audit_log.append(
                _audit(
                    "choose_interaction_mode",
                    "unsupported",
                    agent_id=item["agent_id"],
                    task_id=local_task_id,
                    detail=mode_error,
                )
            )
            continue

        audit_log.append(
            _audit(
                "choose_interaction_mode",
                "selected",
                agent_id=item["agent_id"],
                task_id=local_task_id,
                detail=f"Selected {mode} interaction mode.",
            )
        )

    return {
        "delegation_plan": delegation_plan,
        "interaction_modes": interaction_modes,
        "task_statuses": task_statuses,
        "errors": errors,
        "status": status,
        "audit_log": audit_log,
    }


def build_a2a_tasks(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    a2a_tasks: dict[str, A2ATaskEnvelope] = {}
    task_statuses = dict(state.get("task_statuses", {}))
    task_messages = dict(state.get("task_messages", {}))
    audit_log = list(state.get("audit_log", []))

    for item in state.get("delegation_plan", []):
        task_id = item["local_task_id"]
        if task_statuses.get(task_id) == "unsupported":
            continue
        mode = item["interaction_mode"]
        method = "tasks/sendSubscribe" if mode == "streaming" else "tasks/send"
        user_message = {
            "role": "user",
            "parts": [
                {
                    "kind": "text",
                    "text": state.get("normalized_input", ""),
                }
            ],
            "metadata": {
                "session_id": state.get("session_id", ""),
                "context_id": state.get("context_id"),
                "target_agent": item["agent_id"],
                "target_skill": item["skill_id"],
            },
        }
        payload: A2ATaskEnvelope = {
            "jsonrpc": "2.0",
            "id": task_id,
            "method": method,
            "params": {
                "id": task_id,
                "sessionId": state.get("session_id", ""),
                "contextId": state.get("context_id"),
                "agent": item["agent_id"],
                "skill": item["skill_id"],
                "message": user_message,
                "acceptedOutputModes": item.get("accepted_output_modes", []),
                "metadata": {
                    "interaction_mode": mode,
                    "reason": item.get("reason", ""),
                },
            },
        }
        a2a_tasks[task_id] = payload
        task_statuses[task_id] = "submitted"
        task_messages[task_id] = [user_message]
        audit_log.append(
            _audit(
                "build_a2a_tasks",
                "built",
                agent_id=item["agent_id"],
                task_id=task_id,
                detail=f"Built {method} envelope.",
            )
        )

    return {
        "a2a_tasks": a2a_tasks,
        "task_statuses": task_statuses,
        "task_messages": task_messages,
        "audit_log": audit_log,
    }


def dispatch_sync_task(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    transport = _transport_for(state)
    task_statuses = dict(state.get("task_statuses", {}))
    task_messages = dict(state.get("task_messages", {}))
    remote_artifacts = dict(state.get("remote_artifacts", {}))
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))
    metadata = dict(state.get("metadata", {}))

    for item in state.get("delegation_plan", []):
        if item.get("interaction_mode") != "sync":
            continue
        task_id = item["local_task_id"]
        if task_statuses.get(task_id) == "unsupported":
            continue
        try:
            response = transport.send_task(
                item["endpoint"],
                state.get("a2a_tasks", {})[task_id],
                credential_status=state.get("credential_status", {}).get(
                    item["agent_id"], "not_required"
                ),
            )
        except Exception as exc:
            task_statuses[task_id] = "failed"
            message = f"Sync dispatch failed for {task_id}: {exc}"
            errors.append(message)
            audit_log.append(
                _audit(
                    "dispatch_sync_task",
                    "failed",
                    agent_id=item["agent_id"],
                    task_id=task_id,
                    detail=message,
                )
            )
            continue

        _merge_remote_response(
            response,
            task_id,
            task_statuses,
            task_messages,
            remote_artifacts,
            errors,
            metadata,
        )
        audit_log.append(
            _audit(
                "dispatch_sync_task",
                "received",
                agent_id=item["agent_id"],
                task_id=task_id,
                status=task_statuses.get(task_id, ""),
                detail="Received synchronous A2A response.",
            )
        )

    return {
        "task_statuses": task_statuses,
        "task_messages": task_messages,
        "remote_artifacts": remote_artifacts,
        "errors": errors,
        "audit_log": audit_log,
        "metadata": metadata,
        "context_id": metadata.get("latest_context_id", state.get("context_id")),
    }


def start_async_task(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    transport = _transport_for(state)
    task_statuses = dict(state.get("task_statuses", {}))
    task_messages = dict(state.get("task_messages", {}))
    remote_artifacts = dict(state.get("remote_artifacts", {}))
    a2a_tasks = dict(state.get("a2a_tasks", {}))
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))
    metadata = dict(state.get("metadata", {}))

    for item in state.get("delegation_plan", []):
        if item.get("interaction_mode") not in {"polling", "streaming", "webhook_mock"}:
            continue
        task_id = item["local_task_id"]
        if task_statuses.get(task_id) in {"unsupported", "completed", "failed"}:
            continue
        try:
            response = transport.start_task(
                item["endpoint"],
                state.get("a2a_tasks", {})[task_id],
                credential_status=state.get("credential_status", {}).get(
                    item["agent_id"], "not_required"
                ),
            )
        except Exception as exc:
            task_statuses[task_id] = "failed"
            message = f"Async submission failed for {task_id}: {exc}"
            errors.append(message)
            audit_log.append(
                _audit(
                    "start_async_task",
                    "failed",
                    agent_id=item["agent_id"],
                    task_id=task_id,
                    detail=message,
                )
            )
            continue

        remote_task_id = _remote_task_id(response, task_id)
        task_payload = dict(a2a_tasks.get(task_id, {}))
        task_payload["remote_task_id"] = remote_task_id
        a2a_tasks[task_id] = task_payload
        metadata.setdefault("remote_task_ids", {})[task_id] = remote_task_id
        _merge_remote_response(
            response,
            task_id,
            task_statuses,
            task_messages,
            remote_artifacts,
            errors,
            metadata,
        )
        if task_statuses.get(task_id) == "submitted":
            task_statuses[task_id] = "working"
        audit_log.append(
            _audit(
                "start_async_task",
                "submitted",
                agent_id=item["agent_id"],
                task_id=task_id,
                status=task_statuses.get(task_id, ""),
                detail=f"Submitted remote task {remote_task_id}.",
            )
        )

    return {
        "a2a_tasks": a2a_tasks,
        "task_statuses": task_statuses,
        "task_messages": task_messages,
        "remote_artifacts": remote_artifacts,
        "errors": errors,
        "audit_log": audit_log,
        "metadata": metadata,
        "context_id": metadata.get("latest_context_id", state.get("context_id")),
    }


def poll_async_task(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    transport = _transport_for(state)
    task_statuses = dict(state.get("task_statuses", {}))
    task_messages = dict(state.get("task_messages", {}))
    remote_artifacts = dict(state.get("remote_artifacts", {}))
    poll_attempts = dict(state.get("poll_attempts", {}))
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))
    metadata = dict(state.get("metadata", {}))
    max_attempts = state.get("max_poll_attempts", DEFAULT_MAX_POLL_ATTEMPTS)

    for item in state.get("delegation_plan", []):
        if item.get("interaction_mode") not in {"polling", "webhook_mock"}:
            continue
        task_id = item["local_task_id"]
        if task_statuses.get(task_id) in {
            "completed",
            "failed",
            "input-required",
            "unsupported",
        }:
            continue
        remote_task_id = _task_remote_id(state, task_id)
        for _ in range(max_attempts):
            poll_attempts[task_id] = poll_attempts.get(task_id, 0) + 1
            try:
                response = transport.poll_task(item["endpoint"], remote_task_id)
            except Exception as exc:
                task_statuses[task_id] = "failed"
                errors.append(f"Polling failed for {task_id}: {exc}")
                break
            _merge_remote_response(
                response,
                task_id,
                task_statuses,
                task_messages,
                remote_artifacts,
                errors,
                metadata,
            )
            audit_log.append(
                _audit(
                    "poll_async_task",
                    "polled",
                    agent_id=item["agent_id"],
                    task_id=task_id,
                    status=task_statuses.get(task_id, ""),
                    metadata={"attempt": poll_attempts[task_id]},
                )
            )
            if task_statuses.get(task_id) != "working":
                break
        if task_statuses.get(task_id) == "working":
            task_statuses[task_id] = "timeout"
            errors.append(
                f"Polling timed out for {task_id} after {poll_attempts.get(task_id, 0)} attempt(s)."
            )
            audit_log.append(
                _audit(
                    "poll_async_task",
                    "timeout",
                    agent_id=item["agent_id"],
                    task_id=task_id,
                    detail="Polling exceeded the configured maximum attempts.",
                )
            )

    return {
        "task_statuses": task_statuses,
        "task_messages": task_messages,
        "remote_artifacts": remote_artifacts,
        "poll_attempts": poll_attempts,
        "errors": errors,
        "audit_log": audit_log,
        "metadata": metadata,
        "context_id": metadata.get("latest_context_id", state.get("context_id")),
    }


def consume_stream_updates(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    transport = _transport_for(state)
    task_statuses = dict(state.get("task_statuses", {}))
    task_messages = dict(state.get("task_messages", {}))
    remote_artifacts = dict(state.get("remote_artifacts", {}))
    stream_events = dict(state.get("stream_events", {}))
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))
    metadata = dict(state.get("metadata", {}))

    for item in state.get("delegation_plan", []):
        if item.get("interaction_mode") != "streaming":
            continue
        task_id = item["local_task_id"]
        if task_statuses.get(task_id) in {
            "completed",
            "failed",
            "input-required",
            "unsupported",
        }:
            continue
        remote_task_id = _task_remote_id(state, task_id)
        events = stream_events.setdefault(task_id, [])
        saw_terminal_event = False
        try:
            iterable = transport.stream_task(item["endpoint"], remote_task_id)
            for event in iterable:
                if not isinstance(event, dict):
                    errors.append(f"Malformed stream event for {task_id}.")
                    task_statuses[task_id] = "failed"
                    break
                events.append(event)
                _merge_remote_response(
                    event,
                    task_id,
                    task_statuses,
                    task_messages,
                    remote_artifacts,
                    errors,
                    metadata,
                )
                audit_log.append(
                    _audit(
                        "consume_stream_updates",
                        "event",
                        agent_id=item["agent_id"],
                        task_id=task_id,
                        status=task_statuses.get(task_id, ""),
                    )
                )
                if task_statuses.get(task_id) in {
                    "completed",
                    "failed",
                    "input-required",
                }:
                    saw_terminal_event = True
                    break
        except Exception as exc:
            task_statuses[task_id] = "failed"
            errors.append(f"Streaming failed for {task_id}: {exc}")
            continue

        if not saw_terminal_event and task_statuses.get(task_id) == "working":
            task_statuses[task_id] = "timeout"
            errors.append(f"Streaming ended without a terminal event for {task_id}.")

    return {
        "task_statuses": task_statuses,
        "task_messages": task_messages,
        "remote_artifacts": remote_artifacts,
        "stream_events": stream_events,
        "errors": errors,
        "audit_log": audit_log,
        "metadata": metadata,
        "context_id": metadata.get("latest_context_id", state.get("context_id")),
    }


def process_remote_artifacts(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    normalized_artifacts: dict[str, list[dict[str, Any]]] = {}
    task_statuses = dict(state.get("task_statuses", {}))
    errors = list(state.get("errors", []))
    audit_log = list(state.get("audit_log", []))

    for task_id, artifacts in state.get("remote_artifacts", {}).items():
        if task_statuses.get(task_id) != "completed":
            normalized_artifacts[task_id] = list(artifacts)
            continue
        task_artifacts: list[dict[str, Any]] = []
        for artifact in artifacts:
            normalized, artifact_errors = _normalize_artifact(artifact)
            if artifact_errors:
                errors.extend(
                    f"Malformed artifact for {task_id}: {message}"
                    for message in artifact_errors
                )
                task_statuses[task_id] = "malformed"
                audit_log.append(
                    _audit(
                        "process_remote_artifacts",
                        "rejected",
                        task_id=task_id,
                        detail="; ".join(artifact_errors),
                    )
                )
                break
            task_artifacts.append(normalized)
        normalized_artifacts[task_id] = task_artifacts
        if task_statuses.get(task_id) == "completed":
            audit_log.append(
                _audit(
                    "process_remote_artifacts",
                    "normalized",
                    task_id=task_id,
                    detail=f"Normalized {len(task_artifacts)} artifact(s).",
                )
            )

    return {
        "remote_artifacts": normalized_artifacts,
        "task_statuses": task_statuses,
        "errors": errors,
        "audit_log": audit_log,
    }


def aggregate_remote_results(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    completed_task_ids = _completed_task_ids(state)
    artifact_summary = _artifact_summary(state)
    has_failures = _has_task_failures(state)
    status = "partial" if has_failures else "ok"
    answer = _synthesize_answer(state, artifact_summary)
    agents_used = _agents_used(state)
    aggregation_result = {
        "status": status,
        "answer": answer,
        "artifact_summary": artifact_summary,
        "completed_task_ids": completed_task_ids,
        "agents_used": agents_used,
        "errors": list(state.get("errors", [])),
    }

    return {
        "aggregation_result": aggregation_result,
        "status": status,
        "audit_log": [
            *state.get("audit_log", []),
            _audit(
                "aggregate_remote_results",
                "aggregated",
                detail=f"Aggregated {len(completed_task_ids)} completed task(s).",
                metadata={"status": status},
            ),
        ],
    }


def handle_input_required(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    questions = _pending_questions(state)
    if not questions:
        questions = ["A remote agent needs additional information before continuing."]
    return {
        "pending_user_questions": questions,
        "status": "input_required",
        "audit_log": [
            *state.get("audit_log", []),
            _audit(
                "handle_input_required",
                "input_required",
                detail="Remote task requested additional user input.",
                metadata={"question_count": len(questions)},
            ),
        ],
    }


def handle_task_failure(
    state: InterAgentCommunicationA2AState,
) -> dict[str, Any]:
    status = state.get("status", "failed")
    if status == "ok":
        status = "failed"
    return {
        "status": status,
        "audit_log": [
            *state.get("audit_log", []),
            _audit(
                "handle_task_failure",
                "handled",
                detail="A2A workflow ended through the failure path.",
                metadata={"errors": len(state.get("errors", []))},
            ),
        ],
    }


def finalize_response(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    final_output = state.get("final_output")
    if not final_output:
        final_output = _final_output(state)
    return {
        "final_output": final_output,
        "status": final_output["status"],
    }


class LocalA2ATransport:
    """Deterministic in-process A2A transport used when tests do not inject one."""

    def __init__(self) -> None:
        self.poll_counts: dict[str, int] = {}

    def send_task(
        self,
        endpoint: str,
        payload: dict[str, Any],
        credential_status: str = "not_required",
    ) -> dict[str, Any]:
        del endpoint, credential_status
        task_id = payload["id"]
        agent_id = payload["params"]["agent"]
        if agent_id == "calendar_agent":
            return _completed_response(
                task_id,
                "ctx-default",
                "calendar",
                {"availability": "free from 13:00 to 17:00"},
                "Calendar shows you are free tomorrow afternoon.",
            )
        return _failed_response(task_id, f"No sync fixture for {agent_id}.")

    def start_task(
        self,
        endpoint: str,
        payload: dict[str, Any],
        credential_status: str = "not_required",
    ) -> dict[str, Any]:
        del endpoint, credential_status
        task_id = payload["id"]
        return {
            "taskId": f"remote-{task_id}",
            "contextId": "ctx-default",
            "status": {"state": "working"},
            "messages": [
                {
                    "role": "agent",
                    "parts": [{"kind": "text", "text": "Task accepted."}],
                }
            ],
            "artifacts": [],
        }

    def poll_task(self, endpoint: str, task_id: str) -> dict[str, Any]:
        del endpoint
        self.poll_counts[task_id] = self.poll_counts.get(task_id, 0) + 1
        local_task_id = task_id.removeprefix("remote-")
        if self.poll_counts[task_id] == 1:
            return {
                "taskId": task_id,
                "status": {"state": "working"},
                "messages": [],
                "artifacts": [],
            }
        return _completed_response(
            local_task_id,
            "ctx-default",
            "weather",
            {"forecast": "clear, 22 C, low rain risk"},
            "Forecast is clear with low rain risk.",
            remote_task_id=task_id,
        )

    def stream_task(self, endpoint: str, task_id: str) -> Iterable[dict[str, Any]]:
        del endpoint
        local_task_id = task_id.removeprefix("remote-")
        yield {
            "taskId": task_id,
            "status": {"state": "working"},
            "messages": [
                {
                    "role": "agent",
                    "parts": [{"kind": "text", "text": "Checking forecast."}],
                }
            ],
            "artifacts": [],
        }
        yield _completed_response(
            local_task_id,
            "ctx-default",
            "weather",
            {"forecast": "clear, 22 C, low rain risk"},
            "Forecast stream completed.",
            remote_task_id=task_id,
        )


def get_default_transport() -> LocalA2ATransport:
    return LocalA2ATransport()


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


def _synthesize_answer(
    state: InterAgentCommunicationA2AState,
    artifact_summary: dict[str, Any],
) -> str:
    try:
        return _invoke_model(
            AGGREGATION_SYSTEM_PROMPT,
            AGGREGATION_USER_PROMPT.format(
                user_request=state.get("normalized_input", ""),
                artifact_summary=json.dumps(
                    artifact_summary,
                    ensure_ascii=True,
                    sort_keys=True,
                ),
                task_statuses=json.dumps(
                    state.get("task_statuses", {}),
                    ensure_ascii=True,
                    sort_keys=True,
                ),
                errors=json.dumps(
                    state.get("errors", []),
                    ensure_ascii=True,
                    sort_keys=True,
                ),
            ),
        )
    except Exception as exc:  # pragma: no cover - provider error types vary.
        fallback = _fallback_answer(artifact_summary, state.get("errors", []))
        return f"{fallback} Aggregation model unavailable: {exc}"


def _final_output(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    status = state.get("status", "failed")
    aggregation = state.get("aggregation_result") or {}
    if aggregation:
        status = str(aggregation.get("status", status))
        answer = str(aggregation.get("answer", ""))
        artifact_summary = dict(aggregation.get("artifact_summary", {}))
    elif status == "input_required":
        answer = _input_required_answer(state)
        artifact_summary = _artifact_summary(state)
    elif status == "no_agents_available":
        answer = "No valid remote Agent Cards are available for this A2A request."
        artifact_summary = {}
    elif status == "no_matching_skill":
        answer = "No advertised remote agent skill matches the request."
        artifact_summary = {}
    elif status == "auth_failed":
        answer = "A selected remote agent requires credentials that are missing or invalid."
        artifact_summary = _artifact_summary(state)
    elif status == "unsupported":
        answer = "A selected remote agent does not support the required A2A interaction mode or output mode."
        artifact_summary = _artifact_summary(state)
    else:
        answer = "The A2A workflow could not complete."
        artifact_summary = _artifact_summary(state)

    return {
        "status": status,
        "answer": answer,
        "agents_used": _agents_used(state),
        "task_statuses": state.get("task_statuses", {}),
        "interaction_modes": state.get("interaction_modes", {}),
        "artifact_summary": artifact_summary,
        "pending_user_questions": state.get("pending_user_questions", []),
        "errors": state.get("errors", []),
        "audit_summary": [
            {
                "step": event.get("step", ""),
                "event": event.get("event", ""),
                "agent_id": event.get("agent_id", ""),
                "task_id": event.get("task_id", ""),
                "status": event.get("status", ""),
            }
            for event in state.get("audit_log", [])
        ],
    }


def _default_agent_cards() -> dict[str, dict[str, Any]]:
    return {
        "calendar_agent": {
            "name": "Calendar Agent",
            "url": "https://calendar.example.test/a2a",
            "version": "1.0.0",
            "defaultInputModes": [TEXT_INPUT_MODE],
            "defaultOutputModes": [JSON_OUTPUT_MODE, TEXT_OUTPUT_MODE],
            "capabilities": {"streaming": False, "polling": False},
            "authentication": {"required": False, "scheme": "none"},
            "skills": [
                {
                    "id": "check_availability",
                    "name": "Check Availability",
                    "description": "Checks calendar availability for a meeting window.",
                    "keywords": [
                        "availability",
                        "available",
                        "calendar",
                        "free",
                        "meeting",
                        "schedule",
                    ],
                    "preferred_interaction_mode": "sync",
                }
            ],
        },
        "weather_bot": {
            "name": "WeatherBot",
            "url": "https://weather.example.test/a2a",
            "version": "1.0.0",
            "defaultInputModes": [TEXT_INPUT_MODE],
            "defaultOutputModes": [JSON_OUTPUT_MODE, TEXT_OUTPUT_MODE],
            "capabilities": {"streaming": True, "polling": True},
            "authentication": {"required": False, "scheme": "none"},
            "skills": [
                {
                    "id": "get_forecast",
                    "name": "Get Forecast",
                    "description": "Returns forecast details for outdoor planning.",
                    "keywords": [
                        "forecast",
                        "outdoor",
                        "rain",
                        "weather",
                        "temperature",
                    ],
                    "preferred_interaction_mode": "polling",
                }
            ],
        },
    }


def _validate_agent_card(
    agent_id: str,
    card: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    name = _normalize_text(card.get("name", ""))
    endpoint = _normalize_text(card.get("url") or card.get("endpoint") or "")
    version = _normalize_text(card.get("version", ""))
    input_modes = _string_list(
        card.get("defaultInputModes")
        or card.get("input_modes")
        or card.get("inputModes")
    )
    output_modes = _string_list(
        card.get("defaultOutputModes")
        or card.get("output_modes")
        or card.get("outputModes")
    )
    skills_input = card.get("skills")

    if not name:
        errors.append("missing required field 'name'")
    if not endpoint or not endpoint.startswith(("http://", "https://")):
        errors.append("missing or invalid endpoint URL")
    if not version:
        errors.append("missing required field 'version'")
    if TEXT_INPUT_MODE not in input_modes:
        errors.append("Agent Card must support text input mode")
    if not ({JSON_OUTPUT_MODE, TEXT_OUTPUT_MODE} & set(output_modes)):
        errors.append("Agent Card must support json or text output mode")
    if not isinstance(skills_input, list) or not skills_input:
        errors.append("missing non-empty 'skills' list")

    skills: list[dict[str, Any]] = []
    if isinstance(skills_input, list):
        for index, skill in enumerate(skills_input):
            if not isinstance(skill, dict):
                errors.append(f"skill {index} must be an object")
                continue
            skill_id = _normalize_text(skill.get("id", ""))
            skill_name = _normalize_text(skill.get("name") or skill_id)
            if not skill_id:
                errors.append(f"skill {index} missing required field 'id'")
                continue
            skill_input_modes = _string_list(
                skill.get("input_modes")
                or skill.get("inputModes")
                or skill.get("defaultInputModes")
                or input_modes
            )
            skill_output_modes = _string_list(
                skill.get("output_modes")
                or skill.get("outputModes")
                or skill.get("defaultOutputModes")
                or output_modes
            )
            skills.append(
                {
                    "id": skill_id,
                    "name": skill_name,
                    "description": _normalize_text(skill.get("description", "")),
                    "keywords": _string_list(
                        skill.get("keywords") or skill.get("tags")
                    ),
                    "input_modes": skill_input_modes,
                    "output_modes": skill_output_modes,
                    "preferred_interaction_mode": _normalize_text(
                        skill.get("preferred_interaction_mode", "")
                    ),
                }
            )

    if errors:
        return {}, errors

    capabilities = card.get("capabilities", {})
    if not isinstance(capabilities, dict):
        capabilities = {}
    authentication = card.get("authentication") or card.get("auth") or {}
    if not isinstance(authentication, dict):
        authentication = {"required": True, "scheme": str(authentication)}

    return (
        {
            "id": agent_id,
            "name": name,
            "url": endpoint,
            "version": version,
            "input_modes": input_modes,
            "output_modes": output_modes,
            "capabilities": capabilities,
            "authentication": authentication,
            "skills": skills,
        },
        [],
    )


def _candidate_skills(
    cards: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for agent_id, card in cards.items():
        for skill in card.get("skills", []):
            candidates.append(
                {
                    "agent_id": agent_id,
                    "agent_name": card.get("name", agent_id),
                    "endpoint": card.get("url", ""),
                    "skill_id": skill.get("id", ""),
                    "skill_name": skill.get("name", skill.get("id", "")),
                    "description": skill.get("description", ""),
                    "keywords": skill.get("keywords", []),
                    "input_modes": skill.get("input_modes", card.get("input_modes", [])),
                    "output_modes": skill.get(
                        "output_modes",
                        card.get("output_modes", []),
                    ),
                }
            )
    return candidates


def _skill_matches_request(candidate: dict[str, Any], request: str) -> bool:
    terms = _tokens(request)
    haystack = " ".join(
        [
            candidate.get("skill_id", ""),
            candidate.get("skill_name", ""),
            candidate.get("description", ""),
            " ".join(candidate.get("keywords", [])),
        ]
    ).lower()
    skill_terms = _tokens(haystack)
    return bool(terms & skill_terms)


def _selection_reason(candidate: dict[str, Any], request: str) -> str:
    matches = sorted(_tokens(request) & _tokens(" ".join(candidate.get("keywords", []))))
    if matches:
        return "Matched request term(s): " + ", ".join(matches[:4])
    return "Matched skill description or name."


def _deduplicate_plan(items: list[DelegationPlanItem]) -> list[DelegationPlanItem]:
    seen: set[tuple[str, str]] = set()
    unique: list[DelegationPlanItem] = []
    for item in items:
        key = (item["agent_id"], item["skill_id"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _select_interaction_mode(
    card: dict[str, Any],
    skill: dict[str, Any],
    preferred: str,
) -> str:
    normalized_preferred = preferred.strip().lower()
    if normalized_preferred in {"sync", "polling", "streaming", "webhook_mock"}:
        return normalized_preferred
    capabilities = card.get("capabilities", {})
    skill_preferred = _normalize_text(skill.get("preferred_interaction_mode", "")).lower()
    if skill_preferred in {"sync", "polling", "streaming", "webhook_mock"}:
        return skill_preferred
    if capabilities.get("streaming"):
        return "streaming"
    if capabilities.get("polling"):
        return "polling"
    return "sync"


def _mode_error(
    card: dict[str, Any],
    plan_item: dict[str, Any],
    mode: str,
) -> str | None:
    if TEXT_INPUT_MODE not in plan_item.get("input_modes", []):
        return (
            f"{plan_item['agent_id']} skill {plan_item['skill_id']} does not support "
            "text input."
        )
    if not ({JSON_OUTPUT_MODE, TEXT_OUTPUT_MODE} & set(plan_item.get("accepted_output_modes", []))):
        return (
            f"{plan_item['agent_id']} skill {plan_item['skill_id']} does not support "
            "json or text output."
        )
    capabilities = card.get("capabilities", {})
    if mode == "streaming" and not capabilities.get("streaming", False):
        return f"{plan_item['agent_id']} does not advertise streaming support."
    if mode == "polling" and not capabilities.get("polling", False):
        return f"{plan_item['agent_id']} does not advertise polling support."
    if mode == "webhook_mock" and not capabilities.get("pushNotifications", False):
        return f"{plan_item['agent_id']} does not advertise push notification support."
    return None


def _skill_by_id(card: dict[str, Any], skill_id: str) -> dict[str, Any]:
    for skill in card.get("skills", []):
        if skill.get("id") == skill_id:
            return skill
    return {}


def _transport_for(state: InterAgentCommunicationA2AState) -> Any:
    return state.get("transport") or get_default_transport()


def _merge_remote_response(
    response: Any,
    task_id: str,
    task_statuses: dict[str, str],
    task_messages: dict[str, list[dict[str, Any]]],
    remote_artifacts: dict[str, list[dict[str, Any]]],
    errors: list[str],
    metadata: dict[str, Any],
) -> None:
    if not isinstance(response, dict):
        task_statuses[task_id] = "failed"
        errors.append(f"Malformed response for {task_id}: response must be an object.")
        return

    context_id = response.get("contextId") or response.get("context_id")
    if context_id:
        metadata["latest_context_id"] = str(context_id)

    status = _response_status(response)
    if status:
        task_statuses[task_id] = status
    elif task_statuses.get(task_id) not in {"completed", "failed"}:
        task_statuses[task_id] = "working"

    messages = _response_messages(response)
    if messages:
        task_messages.setdefault(task_id, []).extend(messages)

    artifacts = _response_artifacts(response)
    if artifacts:
        remote_artifacts.setdefault(task_id, []).extend(artifacts)

    remote_error = _remote_error_message(response)
    if remote_error:
        errors.append(f"Remote task {task_id} failed: {remote_error}")


def _response_status(response: dict[str, Any]) -> str | None:
    status = response.get("status", {})
    if isinstance(status, str):
        state = status
    elif isinstance(status, dict):
        state = status.get("state") or status.get("status")
    else:
        state = None
    normalized = _normalize_text(state).lower()
    if normalized in {
        "submitted",
        "working",
        "input-required",
        "input_required",
        "completed",
        "failed",
        "timeout",
    }:
        return normalized.replace("_", "-")
    return None


def _response_messages(response: dict[str, Any]) -> list[dict[str, Any]]:
    messages = response.get("messages")
    if isinstance(messages, list):
        return [message for message in messages if isinstance(message, dict)]
    status = response.get("status")
    if isinstance(status, dict) and isinstance(status.get("message"), dict):
        return [status["message"]]
    message = response.get("message")
    if isinstance(message, dict):
        return [message]
    return []


def _response_artifacts(response: dict[str, Any]) -> list[dict[str, Any]]:
    artifacts = response.get("artifacts")
    if isinstance(artifacts, list):
        return [artifact for artifact in artifacts if isinstance(artifact, dict)]
    artifact = response.get("artifact")
    if isinstance(artifact, dict):
        return [artifact]
    return []


def _remote_error_message(response: dict[str, Any]) -> str:
    error = response.get("error")
    status = response.get("status")
    if not error and isinstance(status, dict):
        error = status.get("error")
    if isinstance(error, dict):
        return _normalize_text(error.get("message") or json.dumps(error, sort_keys=True))
    return _normalize_text(error or "")


def _remote_task_id(response: Any, fallback: str) -> str:
    if not isinstance(response, dict):
        return fallback
    return _normalize_text(
        response.get("taskId")
        or response.get("task_id")
        or response.get("id")
        or fallback
    )


def _task_remote_id(state: InterAgentCommunicationA2AState, task_id: str) -> str:
    metadata = state.get("metadata", {})
    remote_task_ids = metadata.get("remote_task_ids", {})
    if isinstance(remote_task_ids, dict):
        return str(remote_task_ids.get(task_id, task_id))
    task_payload = state.get("a2a_tasks", {}).get(task_id, {})
    return str(task_payload.get("remote_task_id", task_id))


def _normalize_artifact(artifact: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    name = _normalize_text(artifact.get("name") or artifact.get("type") or "artifact")
    parts_input = artifact.get("parts")
    if not isinstance(parts_input, list) or not parts_input:
        errors.append("artifact must include a non-empty parts list")
        return {}, errors

    parts: list[dict[str, Any]] = []
    for index, part in enumerate(parts_input):
        if not isinstance(part, dict):
            errors.append(f"part {index} must be an object")
            continue
        kind = _normalize_text(part.get("kind") or part.get("type")).lower()
        if kind in {"text", "text/plain"}:
            text = _normalize_text(part.get("text") or part.get("content"))
            if not text:
                errors.append(f"text part {index} is empty")
                continue
            if len(text) > MAX_ARTIFACT_CHARS:
                errors.append(f"text part {index} exceeds maximum size")
                continue
            parts.append({"kind": "text", "text": text})
            continue
        if kind in {"json", "application/json", "data"}:
            data = part.get("json", part.get("data"))
            if data is None:
                errors.append(f"json part {index} is empty")
                continue
            encoded = json.dumps(data, ensure_ascii=True, sort_keys=True)
            if len(encoded) > MAX_ARTIFACT_CHARS:
                errors.append(f"json part {index} exceeds maximum size")
                continue
            parts.append({"kind": "json", "json": data})
            continue
        errors.append(f"unsupported part kind {kind!r}")

    if not parts:
        errors.append("artifact does not contain any supported parts")
    return {"name": name, "parts": parts}, errors


def _artifact_summary(state: InterAgentCommunicationA2AState) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    task_to_agent = {
        item.get("local_task_id"): item
        for item in state.get("delegation_plan", [])
        if item.get("local_task_id")
    }
    for task_id in _completed_task_ids(state):
        item = task_to_agent.get(task_id, {})
        label = _summary_label(item)
        for artifact in state.get("remote_artifacts", {}).get(task_id, []):
            for part in artifact.get("parts", []):
                if part.get("kind") == "json" and isinstance(part.get("json"), dict):
                    summary[label] = _compact_json_summary(part["json"])
                elif part.get("kind") == "text":
                    summary[label] = part.get("text", "")
    return summary


def _compact_json_summary(data: dict[str, Any]) -> Any:
    if len(data) == 1:
        return next(iter(data.values()))
    return data


def _summary_label(plan_item: dict[str, Any]) -> str:
    skill_id = plan_item.get("skill_id", "")
    if "calendar" in plan_item.get("agent_id", "") or "availability" in skill_id:
        return "calendar"
    if "weather" in plan_item.get("agent_id", "") or "forecast" in skill_id:
        return "weather"
    return plan_item.get("skill_id") or plan_item.get("agent_id") or "remote"


def _agents_used(state: InterAgentCommunicationA2AState) -> list[dict[str, Any]]:
    task_statuses = state.get("task_statuses", {})
    interaction_modes = state.get("interaction_modes", {})
    agents = []
    for item in state.get("delegation_plan", []):
        task_id = item.get("local_task_id", "")
        agents.append(
            {
                "name": item.get("agent_name", item.get("agent_id", "")),
                "agent_id": item.get("agent_id", ""),
                "skill": item.get("skill_id", ""),
                "task_id": task_id,
                "mode": interaction_modes.get(task_id, item.get("interaction_mode", "")),
                "status": task_statuses.get(task_id, ""),
            }
        )
    return agents


def _pending_questions(state: InterAgentCommunicationA2AState) -> list[str]:
    questions: list[str] = []
    for task_id, status in state.get("task_statuses", {}).items():
        if status != "input-required":
            continue
        for message in state.get("task_messages", {}).get(task_id, []):
            if message.get("role") == "user":
                continue
            for part in message.get("parts", []):
                text = _normalize_text(
                    part.get("text")
                    or part.get("question")
                    or part.get("content")
                    or ""
                )
                if text and text not in questions:
                    questions.append(text)
    return questions


def _input_required_answer(state: InterAgentCommunicationA2AState) -> str:
    questions = state.get("pending_user_questions", []) or _pending_questions(state)
    if not questions:
        return "A remote agent needs additional user input before it can continue."
    return questions[0]


def _completed_task_ids(state: InterAgentCommunicationA2AState) -> list[str]:
    return [
        task_id
        for task_id, status in state.get("task_statuses", {}).items()
        if status == "completed"
    ]


def _has_task_failures(state: InterAgentCommunicationA2AState) -> bool:
    return any(
        status in {"failed", "timeout", "unsupported", "auth_failed", "malformed"}
        for status in state.get("task_statuses", {}).values()
    )


def _has_input_required(state: InterAgentCommunicationA2AState) -> bool:
    return any(
        status == "input-required"
        for status in state.get("task_statuses", {}).values()
    )


def _fallback_answer(artifact_summary: dict[str, Any], errors: list[str]) -> str:
    if not artifact_summary:
        return "No remote artifacts were available to summarize."
    chunks = [
        f"{key}: {value}"
        for key, value in artifact_summary.items()
        if _normalize_text(value)
    ]
    answer = "; ".join(chunks)
    if errors:
        answer += " Partial result; unresolved errors remain."
    return answer


def _completed_response(
    local_task_id: str,
    context_id: str,
    artifact_name: str,
    data: dict[str, Any],
    message: str,
    remote_task_id: str | None = None,
) -> dict[str, Any]:
    return {
        "taskId": remote_task_id or local_task_id,
        "contextId": context_id,
        "status": {"state": "completed"},
        "messages": [
            {
                "role": "agent",
                "parts": [{"kind": "text", "text": message}],
            }
        ],
        "artifacts": [
            {
                "name": artifact_name,
                "parts": [{"kind": "json", "json": data}],
            }
        ],
    }


def _failed_response(task_id: str, message: str) -> dict[str, Any]:
    return {
        "taskId": task_id,
        "status": {"state": "failed", "error": {"message": message}},
        "messages": [],
        "artifacts": [],
    }


def _local_task_id(agent_id: str, skill_id: str) -> str:
    safe_agent = re.sub(r"[^a-zA-Z0-9]+", "-", agent_id).strip("-").lower()
    safe_skill = re.sub(r"[^a-zA-Z0-9]+", "-", skill_id).strip("-").lower()
    return f"task-{safe_agent}-{safe_skill}"


def _audit(
    step: str,
    event: str,
    agent_id: str = "",
    task_id: str = "",
    status: str = "",
    detail: str = "",
    metadata: dict[str, Any] | None = None,
) -> A2AAuditEvent:
    audit_event: A2AAuditEvent = {
        "step": step,
        "event": event,
    }
    if agent_id:
        audit_event["agent_id"] = agent_id
    if task_id:
        audit_event["task_id"] = task_id
    if status:
        audit_event["status"] = status
    if detail:
        audit_event["detail"] = detail
    if metadata:
        audit_event["metadata"] = metadata
    return audit_event


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def _string_list(value: Any) -> list[str]:
    if isinstance(value, str):
        return [_normalize_text(value)] if _normalize_text(value) else []
    if not isinstance(value, list):
        return []
    normalized = []
    for item in value:
        text = _normalize_text(item)
        if text:
            normalized.append(text)
    return normalized


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9_-]*", text.lower())
        if len(token) > 2 and token not in STOP_WORDS
    }


def _coerce_positive_int(value: Any, default: int) -> int:
    try:
        integer = int(value)
    except (TypeError, ValueError):
        return default
    return max(1, integer)
