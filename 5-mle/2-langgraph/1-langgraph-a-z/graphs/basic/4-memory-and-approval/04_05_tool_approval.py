"""Example 04-05 — Tool call 승인 Human-in-the-loop.

선행 개념
---------
- Tool binding, ``ToolNode``, ReAct 순환
- Checkpointer와 Example 22의 dynamic ``interrupt()``

새 개념
-------
- LLM이 만든 tool call 목록을 실행 전에 사용자에게 표시
- 승인 시 ``ToolNode``로, 거절 시 대응하는 ``ToolMessage``로 분기
- 모든 tool call id에 결과 메시지를 돌려줘 대화 프로토콜을 완결하는 방법

이 예제는 도구 자체의 위험도를 판단하지 않고 매 tool batch마다 같은 승인을 묻는다.
정책에 따라 자동 승인과 수동 승인을 나누는 방법은 Example 25에서 다룬다.

그래프 구조
-----------
모델의 도구 호출 요청을 실행 전에 사람이 검토하고, 승인한 도구 결과 또는 거절 메시지로 응답을 이어간다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "2 + 2를 계산해줘."
    }
  ]
}
```
관찰할 결과: 모델이 tool call을 만들면 실행 전에 __interrupt__의 tool_calls가 표시됩니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
Studio/API에서는 같은 thread를 사용합니다. Python 단독 실행은 main처럼 InMemorySaver를 주입하고 config={"configurable": {"thread_id": "input-demo"}}를 전달합니다.
재개: Command(resume="approve") 또는 Command(resume="reject"). 도구 호출 여부와 응답 문구는 모델에 따라 다릅니다.
"""

from __future__ import annotations

from functools import partial
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


def call_agent(state: State, *, model: BaseChatModel) -> dict:
    system = SystemMessage(
        content=(
            "Answer concisely in the user's language. If a tool result says its "
            "execution was rejected, explain the cancellation without requesting "
            "the same tool again."
        )
    )
    return {"messages": [model.invoke([system, *state["messages"]])]}


def build_graph(
    *,
    checkpointer: BaseCheckpointSaver | None = None,
    llm: BaseChatModel | None = None,
):
    model = (llm or create_llm()).bind_tools(TOOLS)

    builder = StateGraph(State)
    builder.add_node("agent", partial(call_agent, model=model))
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
