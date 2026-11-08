from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict


WorkflowStatus = Literal["ok", "needs_review", "failed"]


# 각 노드가 남긴 입력, 출력, 검증 결정을 순서대로 보관한다.
class Artifact(TypedDict):
    step: str
    data: dict[str, Any]


# LangGraph Studio에는 input이 사용자 입력으로 노출되고, 나머지는 실행 중 채워지는 상태다.
class PromptChainingState(TypedDict):
    input: str
    clean_text: NotRequired[str]
    raw_extraction: NotRequired[str]
    raw_transformation: NotRequired[str]
    specifications: NotRequired[dict[str, Any]]
    missing_fields: NotRequired[list[str]]
    validation_errors: NotRequired[list[str]]
    retry_count: NotRequired[int]
    max_retries: NotRequired[int]
    intermediate_artifacts: NotRequired[list[Artifact]]
    status: NotRequired[WorkflowStatus]
    final_output: NotRequired[dict[str, Any]]
