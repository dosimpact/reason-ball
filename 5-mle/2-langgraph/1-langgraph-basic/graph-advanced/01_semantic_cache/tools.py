"""01_semantic_cache 데모용 도구 (자급자족)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from langchain_core.tools import tool


@tool
def get_current_time() -> str:
    """현재 시간(KST)을 반환합니다."""
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).strftime("%Y-%m-%d %H:%M:%S KST")


@tool
def calculate(expression: str) -> str:
    """수학 식을 안전하게 계산합니다.

    Args:
        expression: 숫자와 +-*/(). 만 허용되는 산술식.
    """
    allowed = set("0123456789+-*/.() ")
    if not all(c in allowed for c in expression):
        return "Error: Only numeric expressions with +, -, *, /, (, ) are allowed."
    try:
        return str(eval(expression))  # noqa: S307 - sanitised
    except Exception as e:  # pragma: no cover
        return f"Error: {e}"


TOOLS = [get_current_time, calculate]

__all__ = ["TOOLS", "get_current_time", "calculate"]
