from __future__ import annotations

from typing import Any, Literal, TypedDict


MemoryWorkflowStatus = Literal["ok", "needs_review", "failed"]
MessageRole = Literal["user", "assistant"]


class ConversationMessage(TypedDict):
    role: MessageRole
    content: str


class RetrievedMemory(TypedDict, total=False):
    namespace: list[str]
    key: str
    value: dict[str, Any]
    score: float | None


class MemoryCandidate(TypedDict, total=False):
    key: str
    memory_type: str
    values: dict[str, Any]
    source_text: str
    tags: list[str]
    sensitive: bool
    reason: str


class ApprovedMemoryUpdate(TypedDict, total=False):
    namespace: list[str]
    key: str
    value: dict[str, Any]
    source_text: str
    conflicts: list[dict[str, Any]]


class SkippedMemoryUpdate(TypedDict, total=False):
    candidate: dict[str, Any] | str
    reason: str


class MemoryWriteResult(TypedDict, total=False):
    namespace: list[str]
    key: str
    success: bool
    value: dict[str, Any]
    error: str


class MemoryManagementState(TypedDict, total=False):
    input: str
    user_id: str
    thread_id: str
    messages: list[ConversationMessage]
    short_term_summary: str
    retrieval_query: str
    retrieved_memories: list[RetrievedMemory]
    prompt_context: dict[str, Any]
    response: str
    memory_candidates: list[MemoryCandidate]
    approved_memory_updates: list[ApprovedMemoryUpdate]
    skipped_memory_updates: list[SkippedMemoryUpdate]
    memory_write_results: list[MemoryWriteResult]
    errors: list[str]
    status: MemoryWorkflowStatus
    final_output: dict[str, Any]
    metadata: dict[str, Any]
    review_reasons: list[str]
