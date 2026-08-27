"""
Example 11 — context_schema와 Runtime으로 실행별 설정 주입.

선행 예제
---------
- 09_messages_state

새 개념
-------
- `StateGraph(..., context_schema=...)`
- node 인자의 `Runtime[Context]`로 실행 context 접근
- 같은 graph를 model, prompt, style이 다른 context로 재사용

복습 개념
---------
- `MessagesState`, LLM message 입력

`context`는 애플리케이션이 node에 주입하는 실행별 의존성입니다.
`configurable.thread_id` 같은 checkpoint 예약 설정과 역할이 다릅니다.

그래프 구조
-----------
START ─▶ chat ─▶ END
"""

from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.runtime import Runtime

from common.llm import create_llm


class Context(TypedDict, total=False):
    model: str
    system_prompt: str
    style: str


STYLE_HINTS = {
    "concise": "Reply in one short sentence.",
    "detailed": "Explain in detail and include one example.",
    "playful": "Reply playfully in at most two sentences.",
}


def chat(state: MessagesState, runtime: Runtime[Context]) -> dict:
    context = runtime.context or {}
    model = context.get("model", "default")
    system_prompt = context.get("system_prompt", "You are a helpful assistant.")
    style = context.get("style", "concise")
    prompt = f"{system_prompt}\n{STYLE_HINTS.get(style, '')}"
    response = create_llm(model).invoke(
        [SystemMessage(content=prompt)] + state["messages"]
    )
    return {"messages": [response]}


def build_graph():
    builder = StateGraph(MessagesState, context_schema=Context)
    builder.add_node("chat", chat)
    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    payload = {"messages": [HumanMessage(content="LangGraph가 뭐야?")]}
    result = graph.invoke(
        payload,
        context={
            "model": "default",
            "system_prompt": "You are a friendly Korean teacher.",
            "style": "playful",
        },
    )
    print(result["messages"][-1].content)
