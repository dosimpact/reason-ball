"""
샘플 도구(tools) 모음.

LangGraph 예제들이 공통으로 사용하는 데모용 툴들입니다.
실제 프로덕션 환경에서는 각자의 비즈니스 로직 / 외부 API 호출로 대체합니다.
"""

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
        expression: 계산할 수식. 숫자와 +-*/(). 만 허용.
    """
    allowed = set("0123456789+-*/.() ")
    if not all(c in allowed for c in expression):
        return "Error: Only numeric expressions with +, -, *, /, (, ) are allowed."
    try:
        return str(eval(expression))  # noqa: S307 - input is sanitised above
    except Exception as e:  # pragma: no cover
        return f"Error: {e}"


@tool
def lookup_info(topic: str) -> str:
    """주어진 토픽에 대한 간단한 정보를 반환합니다 (데모 스텁).

    Args:
        topic: 조회할 주제 (예: "langgraph", "bedrock", "fastapi")
    """
    knowledge: dict[str, str] = {
        "langgraph": (
            "LangGraph is a library for building stateful, multi-actor applications "
            "with LLMs. It extends LangChain with cyclic graph support."
        ),
        "bedrock": (
            "Amazon Bedrock is a fully managed service that offers foundation models "
            "from leading AI companies through a single API."
        ),
        "fastapi": (
            "FastAPI is a modern, fast web framework for building APIs with Python "
            "based on standard Python type hints."
        ),
    }
    key = topic.lower().strip()
    for k, v in knowledge.items():
        if k in key:
            return v
    return f"No specific information found for '{topic}'."


# 모든 예제가 공통으로 import 하는 기본 툴 셋
TOOLS = [get_current_time, calculate, lookup_info]


__all__ = ["get_current_time", "calculate", "lookup_info", "TOOLS"]
