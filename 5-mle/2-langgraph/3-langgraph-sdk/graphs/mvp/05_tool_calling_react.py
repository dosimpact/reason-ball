"""Example 05: ReAct-style tool calling graph for UI inspection."""
# 예제 개요: 모델이 도구를 선택하고 결과를 읽은 뒤 답변하는 ReAct 형태의 예제입니다.
# 핵심 흐름: agent → tools → agent를 반복하며, 도구 호출이 없는 응답에서 종료합니다.

from __future__ import annotations

from typing import Literal

from langchain_core.messages import SystemMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm


@tool("calculator")
def calculator(expression: str) -> str:
    """Evaluate a numeric expression using only digits and basic operators."""
    allowed = set("0123456789+-*/.() ")
    if not all(character in allowed for character in expression):
        return "Error: only digits and + - * / . ( ) are allowed."
    try:
        return str(eval(expression, {"__builtins__": {}}, {}))  # noqa: S307
    except Exception as error:  # pragma: no cover - defensive for malformed model args
        return f"Error: {error}"


@tool("lookup_langgraph_term")
def lookup_langgraph_term(topic: str) -> str:
    """Return a short deterministic description for a LangGraph-related topic."""
    terms = {
        "thread": "A LangGraph thread stores state and checkpoint history across runs.",
        "toolnode": "ToolNode executes tool calls requested by an AI message.",
        "react": "ReAct alternates model reasoning actions with tool observations.",
        "langgraph": "LangGraph builds stateful graph workflows around LLM calls and tools.",
    }
    key = topic.lower().strip()
    for term, description in terms.items():
        if term in key:
            return description
    return f"No local entry for {topic}."


TOOLS = [calculator, lookup_langgraph_term]

SYSTEM_PROMPT = (
    "You are the Tool Calling / ReAct UI example. Use the calculator tool for "
    "arithmetic and lookup_langgraph_term for LangGraph terms. After every tool "
    "result, give a concise final answer that explicitly mentions the result. "
    "For 12 * 7, the final answer must include 84."
)


# 현재 단계의 입력으로 모델을 호출하고 응답을 다음 노드가 사용할 상태로 반환합니다.
def call_model(state: MessagesState) -> dict:
    llm = create_llm().bind_tools(TOOLS)
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    return {"messages": [response]}


# 마지막 응답에 도구 호출이 있으면 tools로 보내고, 없으면 실행을 종료합니다.
def route_after_agent(state: MessagesState) -> Literal["tools", "__end__"]:
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return "__end__"


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("agent", call_model)
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges("agent", route_after_agent, {"tools": "tools", "__end__": END})
    builder.add_edge("tools", "agent")
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke(
        {"messages": [HumanMessage(content="Use the calculator tool to multiply 12 by 7.")]}
    )
    print(out["messages"][-1].content)
