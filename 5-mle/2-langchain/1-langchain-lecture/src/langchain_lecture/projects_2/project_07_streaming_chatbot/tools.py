"""토큰과 이벤트를 스트리밍하는 챗봇 예제입니다. 에이전트가 호출할 수 있는 도구 함수를 모아 둡니다."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


class ToolExecutionError(RuntimeError):
    """Raised when a lecture tool fails in a predictable way."""


@dataclass(frozen=True)
class ToolResult:
    name: str
    content: str
    metadata: dict[str, str]


def fixed_current_time() -> ToolResult:
    """Return a stable time value so tests and demos do not depend on the clock."""

    value = datetime(2026, 7, 2, 9, 0, tzinfo=timezone.utc)
    return ToolResult(
        name="current_time",
        content="2026-07-02 09:00 UTC",
        metadata={"iso": value.isoformat(), "source": "deterministic"},
    )


def plan_today(reference_time: str) -> ToolResult:
    """Create a deterministic short plan from a time lookup."""

    if "fail" in reference_time.lower():
        raise ToolExecutionError("planner tool received an invalid reference time")
    return ToolResult(
        name="daily_planner",
        content=f"{reference_time} 기준: 우선순위 확인, 집중 작업, 회고를 순서대로 진행하세요.",
        metadata={"items": "3"},
    )


def run_tool(name: str, argument: str = "") -> ToolResult:
    if name == "current_time":
        return fixed_current_time()
    if name == "daily_planner":
        return plan_today(argument)
    if name == "unstable_tool":
        raise ToolExecutionError("unstable_tool failed by request")
    raise ToolExecutionError(f"unknown tool: {name}")
