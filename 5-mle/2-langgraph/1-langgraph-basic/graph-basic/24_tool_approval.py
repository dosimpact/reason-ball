"""Example 24 — Tool call 승인 Human-in-the-loop.

선행 개념
---------
- Tool binding, ``ToolNode``, ReAct 순환
- Checkpointer와 Example 22의 dynamic ``interrupt()``

새 개념
-------
- LLM이 만든 tool call 목록을 실행 전에 사용자에게 표시
- 승인 시 ``ToolNode``로, 거절 시 대응하는 ``ToolMessage``로 분기
- 모든 tool call id에 결과 메시지를 돌려줘 대화 프로토콜을 완결하는 방법

복습 개념
---------
- 조건부 edge, ``AIMessage.tool_calls``, ``Command(resume=...)``

이 예제는 도구 자체의 위험도를 판단하지 않고 매 tool batch마다 같은 승인을 묻는다.
정책에 따라 자동 승인과 수동 승인을 나누는 방법은 Example 25에서 다룬다.
"""

from __future__ import annotations

from typing import Any, Literal

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.types import interrupt

from common.llm import create_llm
from common.tools import TOOLS
from node.tool_node import make_tool_node


class State(MessagesState, total=False):
    tools_approved: bool


def _tool_call_summaries(state: State) -> list[dict[str, Any]]:
    last_message = state["messages"][-1]
    if not isinstance(last_message, AIMessage):
        return []
    return [
        {
            "id": tool_call.get("id"),
            "name": tool_call.get("name"),
            "args": tool_call.get("args", {}),
        }
        for tool_call in last_message.tool_calls
    ]


def review_tool_calls(state: State) -> dict:
    """예정된 tool call batch를 승인할지 한 번 묻는다."""
    decision = interrupt(
        {
            "kind": "tool_approval",
            "question": "Run these tools?",
            "tool_calls": _tool_call_summaries(state),
            "options": ["approve", "reject"],
        }
    )
    if isinstance(decision, dict):
        decision = decision.get("action")
    approved = decision is True or str(decision).strip().lower() in {
        "approve",
        "approved",
        "y",
        "yes",
    }
    return {"tools_approved": approved}


def reject_tools(state: State) -> dict:
    """거절된 각 call id에 ToolMessage를 하나씩 대응시킨다."""
    last_message = state["messages"][-1]
    if not isinstance(last_message, AIMessage):
        return {"messages": []}
    return {
        "messages": [
            ToolMessage(
                content="Tool execution was rejected by the user.",
                name=tool_call["name"],
                tool_call_id=tool_call["id"],
            )
            for tool_call in last_message.tool_calls
        ]
    }


def route_after_agent(state: State) -> Literal["review_tool_calls", "__end__"]:
    last_message = state["messages"][-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "review_tool_calls"
    return "__end__"


def route_after_review(state: State) -> Literal["tools", "reject_tools"]:
    return "tools" if state.get("tools_approved") else "reject_tools"


def build_graph(
    *,
    checkpointer: BaseCheckpointSaver | None = None,
    llm: BaseChatModel | None = None,
):
    model = (llm or create_llm()).bind_tools(TOOLS)

    def call_agent(state: State) -> dict:
        system = SystemMessage(
            content=(
                "Answer concisely in the user's language. If a tool result says its "
                "execution was rejected, explain the cancellation without requesting "
                "the same tool again."
            )
        )
        return {"messages": [model.invoke([system, *state["messages"]])]}

    builder = StateGraph(State)
    builder.add_node("agent", call_agent)
    builder.add_node("review_tool_calls", review_tool_calls)
    builder.add_node("tools", make_tool_node(TOOLS))
    builder.add_node("reject_tools", reject_tools)
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent",
        route_after_agent,
        {"review_tool_calls": "review_tool_calls", "__end__": END},
    )
    builder.add_conditional_edges(
        "review_tool_calls",
        route_after_review,
        {"tools": "tools", "reject_tools": "reject_tools"},
    )
    builder.add_edge("tools", "agent")
    builder.add_edge("reject_tools", "agent")
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.types import Command

    standalone = build_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "tool-approval-demo"}}
    interrupted = standalone.invoke(
        {"messages": [HumanMessage(content="2 + 2를 계산해줘.")]},
        config=config,
    )
    print(interrupted["__interrupt__"][0].value)
    completed = standalone.invoke(Command(resume="approve"), config=config)
    print(completed["messages"][-1].content)
