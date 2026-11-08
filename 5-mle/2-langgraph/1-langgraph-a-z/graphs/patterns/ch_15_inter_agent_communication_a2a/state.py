from __future__ import annotations

from typing import Any, Literal, TypedDict


A2AWorkflowStatus = Literal[
    "ok",
    "partial",
    "input_required",
    "no_agents_available",
    "no_matching_skill",
    "auth_failed",
    "unsupported",
    "failed",
]
InteractionMode = Literal["sync", "polling", "streaming", "webhook_mock"]
RemoteTaskStatus = Literal[
    "submitted",
    "working",
    "input-required",
    "completed",
    "failed",
    "timeout",
    "unsupported",
    "auth_failed",
    "malformed",
]


class CandidateSkill(TypedDict, total=False):
    agent_id: str
    agent_name: str
    skill_id: str
    skill_name: str
    description: str
    keywords: list[str]
    input_modes: list[str]
    output_modes: list[str]


class DelegationPlanItem(TypedDict, total=False):
    agent_id: str
    agent_name: str
    endpoint: str
    skill_id: str
    skill_name: str
    reason: str
    input_modes: list[str]
    accepted_output_modes: list[str]
    interaction_mode: InteractionMode
    local_task_id: str


class A2ATaskEnvelope(TypedDict, total=False):
    jsonrpc: str
    id: str
    method: str
    params: dict[str, Any]


class A2AAuditEvent(TypedDict, total=False):
    step: str
    event: str
    agent_id: str
    task_id: str
    status: str
    detail: str
    metadata: dict[str, Any]


class InterAgentCommunicationA2AState(TypedDict, total=False):
    input: str
    normalized_input: str
    session_id: str
    context_id: str | None
    discovery_mode: str
    agent_cards: dict[str, dict[str, Any]]
    validated_agent_cards: dict[str, dict[str, Any]]
    remote_agents: dict[str, Any]
    candidate_skills: list[CandidateSkill]
    delegation_plan: list[DelegationPlanItem]
    auth_requirements: dict[str, dict[str, Any]]
    credential_status: dict[str, str]
    credentials: dict[str, Any]
    a2a_tasks: dict[str, A2ATaskEnvelope]
    task_statuses: dict[str, RemoteTaskStatus]
    task_messages: dict[str, list[dict[str, Any]]]
    remote_artifacts: dict[str, list[dict[str, Any]]]
    interaction_modes: dict[str, InteractionMode]
    preferred_interaction_modes: dict[str, InteractionMode]
    poll_attempts: dict[str, int]
    max_poll_attempts: int
    stream_events: dict[str, list[dict[str, Any]]]
    pending_user_questions: list[str]
    aggregation_result: dict[str, Any] | None
    audit_log: list[A2AAuditEvent]
    errors: list[str]
    final_output: dict[str, Any] | None
    status: A2AWorkflowStatus
    transport: Any
    metadata: dict[str, Any]
