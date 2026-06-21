from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict


ParallelizationStatus = Literal["ok", "partial", "failed"]


class BranchError(TypedDict):
    branch: str
    message: str
    attempts: int


class BranchResult(TypedDict, total=False):
    run_id: str
    value: Any
    error: BranchError
    attempts: int


def merge_branch_outputs(
    left: dict[str, BranchResult] | None,
    right: dict[str, BranchResult] | None,
) -> dict[str, BranchResult]:
    merged = dict(left or {})
    merged.update(right or {})
    return merged


class ParallelizationState(TypedDict, total=False):
    input: str
    branch_outputs: Annotated[dict[str, BranchResult], merge_branch_outputs]
    summary: str | None
    questions: list[str]
    key_terms: list[str]
    branch_errors: list[BranchError]
    completed_branches: list[str]
    started_at: float | None
    final_answer: str | None
    metadata: dict[str, Any]
    status: ParallelizationStatus
    failure_reason: str | None
    allow_partial_synthesis: bool
    branch_retry_limit: int
