"""Server-owned action identity and revision checks for OpenUI clients."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Mode = Literal["dynamic", "fixed", "sec"]


class ActionError(ValueError):
    """An unavailable, stale or malformed business action."""


class UIAction(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str = Field(min_length=1, max_length=80)
    revision: int = Field(ge=1)
    context: dict[str, Any] = Field(default_factory=dict)


class UIRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    thread_id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    message: str = Field(default="", max_length=4000)
    action: UIAction | None = None


def validate_action(action: UIAction, revision: int, allowed: set[str]) -> dict:
    if action.revision != revision:
        raise ActionError("이전 화면의 요청입니다. 최신 화면을 사용해 주세요.")
    if action.name not in allowed:
        raise ActionError("현재 화면에서 사용할 수 없는 action입니다.")
    return action.context


def require_fields(context: dict, fields: set[str]) -> None:
    if set(context) != fields:
        raise ActionError("Action 입력 필드가 일치하지 않습니다.")


def text_field(context: dict, key: str, limit: int = 120) -> str:
    value = context.get(key)
    if not isinstance(value, str) or len(value) > limit:
        raise ActionError(f"잘못된 입력: {key}")
    return value


def page_field(context: dict) -> int:
    value = context.get("page")
    if type(value) is not int or value < 1:
        raise ActionError("페이지는 1 이상의 정수여야 합니다.")
    return value
