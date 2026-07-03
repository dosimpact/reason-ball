"""스트리밍과 도구 실행 상태를 표현하는 이벤트 모델입니다."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class EventType(str, Enum):
    TOKEN = "token"
    MESSAGE = "message"
    TOOL_START = "tool_start"
    TOOL_RESULT = "tool_result"
    CUSTOM = "custom"
    ERROR = "error"
    DONE = "done"


@dataclass(frozen=True)
class AppEvent:
    type: EventType
    content: str
    metadata: dict[str, Any] | None = None


def render_event(event: AppEvent) -> str:
    if event.type == EventType.TOKEN:
        return event.content
    if event.metadata:
        return f"[{event.type.value}] {event.content} {event.metadata}"
    return f"[{event.type.value}] {event.content}"
