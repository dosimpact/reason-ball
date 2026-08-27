"""
Example 05.2 — 노드 내부 interrupt() 로 이름 입력 + 도구 승인 받기.

`compile(interrupt_before=["tools"])` 없이 필요한 지점의 노드가 직접
`interrupt()` 를 호출하여 사용자 입력을 받습니다.

학습 포인트
-----------
- `start` 다음 `ask_name` 노드에서 이름 입력을 위한 interrupt 발생
- LLM 이 tool call 을 만들면 `approve_tools` 노드에서 실행 승인 interrupt 발생
- 승인은 `Y`/`y`, 거절은 `N`/`n` 입력; 다른 값은 다시 질문
- 거절 시 tool call 별 `ToolMessage` 를 반환해 agent 대화를 정상 종료

그래프 구조
-----------
START ─▶ start ─▶ ask_name (⛔ 이름) ─▶ agent
                                           │
                              tool call ─▼
                              approve_tools (⛔ Y/N)
                                  ┌── Y ──┤└── N ──┐
                                  ▼              ▼
                                tools       reject_tools
                                  └──────┬──────┘
                                         ▼
                                       agent ─▶ END

단독 실행
---------
`python graph-basic/05_2_custom_interrupt.py` 로 실행하면 터미널에서
이름과 도구 승인 여부를 직접 입력할 수 있습니다.
"""

from __future__ import annotations

from typing import Any, Literal

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.types import interrupt

from common.llm import create_llm
from common.tools import TOOLS
from node.tool_node import make_tool_node


class State(MessagesState, total=False):
    started: bool
    name: str
    tools_approved: bool


def start(_: State) -> dict:
    """START 뒤에 실행되는 명시적 시작 노드."""
    return {"started": True}


def ask_name(_: State) -> dict:
    """이름이 입력될 때까지 interrupt 로 사용자에게 질문한다."""
    prompt = {
        "kind": "name",
        "question": "이름을 입력해 주세요.",
    }

    while True:
        answer = interrupt(prompt)
        name = str(answer).strip() if answer is not None else ""
        if name:
            return {"name": name}

        prompt = {
            **prompt,
            "error": "이름은 빈 값일 수 없습니다.",
        }


def _tool_call_summaries(state: State) -> list[dict[str, Any]]:
    """마지막 AI 메시지의 tool call 을 승인 화면용 dict 로 변환."""
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


def approve_tools(state: State) -> dict:
    """Y/y 또는 N/n 입력으로 예정된 tool call 을 승인한다."""
    prompt = {
        "kind": "tool_approval",
        "question": "위 도구를 실행할까요? [Y/N]",
        "tool_calls": _tool_call_summaries(state),
        "options": ["Y", "N"],
    }

    while True:
        answer = interrupt(prompt)
        normalized = str(answer).strip().lower()
        if normalized == "y":
            return {"tools_approved": True}
        if normalized == "n":
            return {"tools_approved": False}

        prompt = {
            **prompt,
            "error": "Y 또는 N만 입력해 주세요. 소문자 y/n도 가능합니다.",
        }


def reject_tools(state: State) -> dict:
    """거절된 tool call 에 대응하는 ToolMessage 를 생성한다."""
    last_message = state["messages"][-1]
    if not isinstance(last_message, AIMessage):
        return {"messages": []}

    name = state.get("name", "사용자")
    return {
        "messages": [
            ToolMessage(
                content=f"{name}님이 도구 실행을 거절했습니다.",
                name=tool_call["name"],
                tool_call_id=tool_call["id"],
            )
            for tool_call in last_message.tool_calls
        ]
    }


def route_after_agent(state: State) -> Literal["approve_tools", "__end__"]:
    """tool call 이 있으면 승인 노드로, 없으면 종료로 라우팅."""
    last_message = state["messages"][-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "approve_tools"
    return "__end__"


def route_after_approval(state: State) -> Literal["tools", "reject_tools"]:
    """사용자의 승인 결과에 따라 실행 또는 거절 노드로 라우팅."""
    return "tools" if state.get("tools_approved") else "reject_tools"


def build_graph(*, checkpointer=None, llm: BaseChatModel | None = None):
    model = (llm or create_llm()).bind_tools(TOOLS)

    def call_agent(state: State) -> dict:
        system = SystemMessage(
            content=(
                f"사용자 이름은 {state['name']}입니다. 사용자의 언어로 간결히 답하세요. "
                "도구 실행이 거절된 경우 같은 도구를 반복 요청하지 말고 "
                "취소되었음을 안내하세요."
            )
        )
        response = model.invoke([system, *state["messages"]])
        return {"messages": [response]}

    builder = StateGraph(State)
    builder.add_node("start", start)
    builder.add_node("ask_name", ask_name)
    builder.add_node("agent", call_agent)
    builder.add_node("approve_tools", approve_tools)
    builder.add_node("tools", make_tool_node(TOOLS))
    builder.add_node("reject_tools", reject_tools)

    builder.add_edge(START, "start")
    builder.add_edge("start", "ask_name")
    builder.add_edge("ask_name", "agent")
    builder.add_conditional_edges(
        "agent",
        route_after_agent,
        {"approve_tools": "approve_tools", "__end__": END},
    )
    builder.add_conditional_edges(
        "approve_tools",
        route_after_approval,
        {"tools": "tools", "reject_tools": "reject_tools"},
    )
    builder.add_edge("tools", "agent")
    builder.add_edge("reject_tools", "agent")

    # interrupt_before 를 사용하지 않고, 노드 내부 interrupt() 로만 멈춘다.
    return builder.compile(checkpointer=checkpointer)


# LangGraph API / Studio 는 실행 환경에서 checkpointer 를 관리한다.
graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import Command

    standalone = build_graph(checkpointer=MemorySaver())
    config = {"configurable": {"thread_id": "demo-custom-interrupt-1"}}

    result = standalone.invoke(
        {"messages": [HumanMessage(content="내 이름을 포함해서 2 + 2를 계산해줘.")]},
        config=config,
    )

    while result.get("__interrupt__"):
        payload = result["__interrupt__"][0].value
        print("\n[interrupt]", payload)

        if isinstance(payload, dict) and payload.get("kind") == "name":
            user_input = input("이름: ")
        else:
            user_input = input("도구 실행 승인? [Y/N]: ")

        result = standalone.invoke(Command(resume=user_input), config=config)

    print("\n[final]", result["messages"][-1].content)
