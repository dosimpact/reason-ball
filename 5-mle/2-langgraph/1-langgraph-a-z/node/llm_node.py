"""
LLM 호출 노드 팩토리.

`MessagesState` 위에서 동작하는 "agent" 노드를 만들어주는 헬퍼.
- system prompt 를 매번 앞에 끼워 넣고
- 필요하면 tools 를 bind 해서 LLM 을 호출한 뒤
- 결과 AI 메시지를 state["messages"] 에 누적합니다.
"""

from __future__ import annotations

from typing import Callable

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage
from langchain_core.tools import BaseTool
from langgraph.graph import MessagesState

DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful AI assistant powered by OpenAI and LangGraph. "
    "Use the available tools when appropriate to provide accurate answers."
)


def make_call_model(
    llm: BaseChatModel,
    *,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    tools: list[BaseTool] | None = None,
) -> Callable[[MessagesState], dict]:
    """`MessagesState` 를 입력 받아 LLM 응답을 추가하는 노드 함수를 반환."""
    bound = llm.bind_tools(tools) if tools else llm

    def call_model(state: MessagesState) -> dict:
        system = SystemMessage(content=system_prompt)
        response = bound.invoke([system] + state["messages"])
        #   실제 LLM 입력은 다음 형태입니다.
        #   SystemMessage
        #   HumanMessage 1
        #   AIMessage 1
        #   HumanMessage 2
        #   AIMessage 2
        #   ...
        #   최근 HumanMessage
        return {"messages": [response]}

    return call_model


__all__ = ["make_call_model", "DEFAULT_SYSTEM_PROMPT"]
