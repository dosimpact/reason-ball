from __future__ import annotations

from typing import Any, Literal, TypedDict


LearningStatus = Literal["ok", "needs_review", "failed"]
TaskCategory = Literal["connectivity", "account", "software", "hardware", "unknown"]
StrategyLabel = Literal[
    "reuse_known_solution",
    "diagnostic_steps",
    "clarify_first",
    "escalate",
]


class LearningAdaptationState(TypedDict, total=False):
    input: str
    user_id: str | None
    normalized_input: str
    task_category: TaskCategory | None
    experience_matches: list[dict[str, Any]]
    strategy_profile: dict[str, Any]
    selected_strategy: StrategyLabel | None
    strategy_reason: str | None
    draft_output: str | None
    feedback: Any
    feedback_summary: dict[str, Any]
    evaluation: dict[str, Any]
    adaptation_record: dict[str, Any]
    adaptation_proposal: dict[str, Any]
    archive_update: dict[str, Any] | None
    applied_adaptation: dict[str, Any]
    rollback_record: dict[str, Any] | None
    retry_count: int
    max_retries: int
    needs_human_review: bool
    errors: list[str]
    final_output: dict[str, Any] | None
    status: LearningStatus
    metadata: dict[str, Any]
    experience_archive: list[dict[str, Any]]
    memory_retriever: Any
    memory_persister: Any
    response_generator: Any
    evaluator: Any
