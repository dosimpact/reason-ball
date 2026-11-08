"""
Example 03-02 — bind_tools와 AIMessage.tool_calls.

쉽게 이해하기
-------------
Tool call은 모델이 도구 이름과 인자를 적어 보내는 실행 요청이다.
예: 계산 도구에 어떤 식을 넣을지 모델이 고른다.
bind_tools()는 도구 설명을 알려주며, 실제 함수 실행은 뒤 단계에서 맡는다.

새 개념
-------
- `llm.bind_tools()`는 tool schema를 모델에 전달
- 모델은 tool을 실행하지 않고 `AIMessage.tool_calls`에 실행 요청을 작성
- 요청의 name, args, id를 직접 확인

그래프 구조
-----------
모델에 곱셈 도구를 연결해 도구 호출 요청과 인자를 생성하되, 도구 실행은 하지 않는다.

START ─▶ request_tool ─▶ END

이 예제는 의도적으로 tool을 실행하지 않습니다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "12와 7을 곱해줘."
    }
  ]
}
```
관찰할 결과: 마지막 AIMessage.tool_calls의 multiply 요청과 a/b 인자를 확인합니다. 이 그래프는 요청만 만들고 도구를 실행하지 않습니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


@tool
def multiply(a: int, b: int) -> int:
    """두 정수의 곱을 반환합니다."""
    return a * b


model_with_tools = create_llm().bind_tools([multiply])

def request_tool(state: MessagesState) -> dict:
    response = model_with_tools.invoke(
        [
            SystemMessage(
                content="Use the multiply tool whenever multiplication is requested."
            )
        ]
        + state["messages"]
    )
    return {"messages": [response]}


def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("request_tool", request_tool)
    builder.add_edge(START, "request_tool")
    builder.add_edge("request_tool", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke(
        {"messages": [HumanMessage(content="12와 7을 곱해줘.")]}
    )
    ai_message = output["messages"][-1]
    print("content:", ai_message.content)
    print("tool_calls:", ai_message.tool_calls)
