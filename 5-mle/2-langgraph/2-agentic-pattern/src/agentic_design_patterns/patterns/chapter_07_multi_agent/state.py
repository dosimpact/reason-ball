from __future__ import annotations

from operator import add
from typing import Annotated, Any, Literal, TypedDict


WorkflowStatus = Literal["ok", "needs_revision", "needs_human_review", "failed"]


class TeamAssignment(TypedDict, total=False):
    agent: str
    role: str
    task: str
    expected_output: str
    dependencies: list[str]


class AgentMessage(TypedDict, total=False):
    agent: str
    event: str
    summary: str
    data: dict[str, Any]


class AgentError(TypedDict, total=False):
    agent: str
    message: str


def merge_agent_outputs(
    left: dict[str, Any] | None,
    right: dict[str, Any] | None,
) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    if isinstance(left, dict):
        merged.update(left)
    if isinstance(right, dict):
        merged.update(right)
    return merged


class MultiAgentState(TypedDict, total=False):
    input: str
    objective: str
    source_material: str | None
    team_plan: list[TeamAssignment]
    communication_contract: dict[str, Any]
    agent_messages: Annotated[list[AgentMessage], add]
    agent_outputs: Annotated[dict[str, Any], merge_agent_outputs]
    research_findings: list[dict[str, str]]
    analysis_findings: list[dict[str, str]]
    context_bundle: dict[str, Any]
    draft_report: str | None
    review_result: dict[str, Any] | None
    revision_notes: list[str]
    retry_count: int
    max_retries: int
    errors: Annotated[list[AgentError], add]
    requires_human_review: bool
    status: WorkflowStatus
    final_output: dict[str, Any] | None
    metadata: dict[str, Any]
