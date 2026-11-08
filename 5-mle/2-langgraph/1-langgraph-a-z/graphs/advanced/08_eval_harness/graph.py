"""
Eval Harness — golden dataset 기반 ReAct 그래프 평가용 그래프.

쉽게 이해하기
-------------
평가 harness는 같은 연습 문제를 반복 실행하고 결과를 채점하는 틀이다.
예: 답에 필요한 키워드가 있는지, 기대한 도구를 호출했는지 확인한다.
이 파일은 평가할 agent를 만들고 run.py가 문제 모음으로 검사한다.

심화주제 §8 직접 구현. 기본 ReAct 그래프이며, `run.py` 에서 batch 평가에 사용됩니다.

그래프 구조
-----------
평가용 질문에 모델과 도구로 답변하며, 별도 run.py가 이 그래프의 답변과 도구 호출을 데이터셋 기준으로 평가한다.

START ─▶ agent ⇄ tools ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "12 * (7 + 5)를 계산해줘."
    }
  ]
}
```
관찰할 결과: 도구 실행 결과와 마지막 응답을 확인합니다. 평가 dataset 실행은 같은 디렉터리의 run.py를 사용합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Literal


from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from common.llm import create_llm
from .tools import TOOLS

SYSTEM_PROMPT = (
    "You are a helpful assistant. Use the available tools when appropriate. "
    "Be concise and accurate."
)


def make_agent_node():
    llm = create_llm().bind_tools(TOOLS)

    def call_model(state: MessagesState) -> dict:
        response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
        return {"messages": [response]}

    return call_model


def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    return "__end__"


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("agent", make_agent_node())
    builder.add_node("tools", ToolNode(TOOLS))
    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "__end__": END}
    )
    builder.add_edge("tools", "agent")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    out = graph.invoke({"messages": [HumanMessage(content="지금 몇 시야?")]})
    print(out["messages"][-1].content)
