"""
조건부 엣지(conditional edges)에서 사용하는 라우팅 함수들.
"""

from __future__ import annotations

from typing import Literal

from langchain_core.messages import AIMessage
from langgraph.graph import MessagesState


def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
    """ReAct 패턴 라우터.

    마지막 메시지가 AI가 생성했으며 tool_calls 가 포함되어 있으면 "tools" 로,
    그렇지 않으면 종료(`__end__`) 로 분기합니다.
    """
    last_message = state["messages"][-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "tools"
    return "__end__"


__all__ = ["should_continue"]
