"""비정형 입력을 정해진 스키마로 추출하는 구조화 출력 예제입니다. LLM 출력과 내부 데이터의 구조를 Pydantic 모델로 정의합니다."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


def _clean_optional_text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    cleaned = " ".join(value.strip().split())
    return cleaned or None


class EvidenceSpan(BaseModel):
    text: str = Field(description="Short source quote that supports the extracted item.")

    @field_validator("text")
    @classmethod
    def text_must_not_be_empty(cls, value: str) -> str:
        cleaned = _clean_optional_text(value)
        if cleaned is None:
            raise ValueError("evidence text must not be empty")
        return cleaned


class ActionItem(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    owner: str | None = Field(
        default=None,
        description="Person responsible for the task. Null when ambiguous or missing.",
    )
    task: str = Field(description="Concrete task to complete.")
    due_date: str | None = Field(
        default=None,
        description="Due date if mentioned, preserving the input wording.",
    )
    priority: Priority | None = Field(
        default=None,
        description="Task priority: low, medium, high, or null when not mentioned.",
    )
    evidence: EvidenceSpan | None = Field(
        default=None,
        description="Source text that supports this action item.",
    )
    confidence: float = Field(
        default=0.6,
        ge=0,
        le=1,
        description="Extractor confidence from 0 to 1.",
    )

    @field_validator("owner", "due_date", mode="before")
    @classmethod
    def clean_optional_fields(cls, value: object) -> str | None:
        return _clean_optional_text(value)

    @field_validator("task")
    @classmethod
    def task_must_not_be_empty(cls, value: str) -> str:
        cleaned = _clean_optional_text(value)
        if cleaned is None:
            raise ValueError("task must not be empty")
        return cleaned


class MeetingExtraction(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    summary: str = Field(description="Brief summary of the meeting or source text.")
    action_items: list[ActionItem] = Field(default_factory=list)
    missing_fields: list[str] = Field(
        default_factory=list,
        description="Field paths that could not be found in the input.",
    )
    ambiguous_fields: list[str] = Field(
        default_factory=list,
        description="Field paths that were intentionally left null because the text was ambiguous.",
    )

    @field_validator("summary")
    @classmethod
    def summary_must_not_be_empty(cls, value: str) -> str:
        cleaned = _clean_optional_text(value)
        if cleaned is None:
            raise ValueError("summary must not be empty")
        return cleaned


def coerce_meeting_extraction(value: Any) -> MeetingExtraction:
    if isinstance(value, MeetingExtraction):
        return value
    if isinstance(value, str):
        return MeetingExtraction.model_validate_json(value)
    return MeetingExtraction.model_validate(value)


def validation_error_messages(exc: ValidationError) -> list[str]:
    return [
        f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
        for error in exc.errors()
    ]
