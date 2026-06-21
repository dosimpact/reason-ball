"""08_eval_harness 데모용 도구."""
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
    """수학 식을 안전하게 계산합니다."""
    allowed = set("0123456789+-*/.() ")
    if not all(c in allowed for c in expression):
        return "Error: Only numeric expressions with +, -, *, /, (, ) are allowed."
    try:
        return str(eval(expression))  # noqa: S307
    except Exception as e:  # pragma: no cover
        return f"Error: {e}"


@tool
def lookup_info(topic: str) -> str:
    """주어진 토픽에 대한 간단한 정보 (데모 스텁).

    Args:
        topic: 조회할 주제.
    """
    knowledge = {
        "langgraph": "LangGraph is a library for building stateful, multi-actor applications with LLMs.",
        "bedrock": "Amazon Bedrock is a managed service offering foundation models via single API.",
        "fastapi": "FastAPI is a modern Python web framework based on type hints with async support.",
    }
    key = topic.lower().strip()
    for k, v in knowledge.items():
        if k in key:
            return v
    return f"No specific information found for '{topic}'."


TOOLS = [get_current_time, calculate, lookup_info]

__all__ = ["TOOLS", "get_current_time", "calculate", "lookup_info"]
