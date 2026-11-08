from __future__ import annotations

from typing import Any, Literal, TypedDict


CritiqueStatus = Literal["accepted", "needs_revision", "invalid"]
WorkflowStatus = Literal["ok", "needs_review", "failed"]


class RevisionHistoryEntry(TypedDict, total=False):
    step: str
    iteration: int
    draft: str | None
    critique: str | None
    critique_status: CritiqueStatus | None
    static_check_results: dict[str, Any] | None
    raw_critic_output: str | dict[str, Any] | None
    errors: list[str]


class ReflectionState(TypedDict, total=False):
    input: str
    requirements: list[str]
    current_draft: str | None
    critique: str | None
    critique_status: CritiqueStatus | None
    iteration: int
    max_iterations: int
    revision_history: list[RevisionHistoryEntry]
    errors: list[str]
    status: WorkflowStatus | None
    final_output: dict[str, Any] | None
    metadata: dict[str, Any]
    raw_critic_output: str | dict[str, Any] | None
    static_check_results: dict[str, Any] | None
