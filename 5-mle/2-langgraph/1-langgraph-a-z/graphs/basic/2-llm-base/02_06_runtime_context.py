"""
Example 02-06 — context_schema와 Runtime으로 실행별 설정 주입. (✅학습완료)

쉽게 이해하기
-------------
Runtime context는 실행할 때 함께 건네는 설정이다.
- Runtime.context — 비즈니스 실행 환경 정보를 담는 목적 
```
{
    "user_id": "user_123",
    "advertiser_id": "adv_456",
    "locale": "ko-KR",
    "permissions": ["campaign:read"],
    "environment": "production"
}
```
RunnableConfig — LangGraph 실행 설정은 좀 더 기술적인 내용을 담는다.  
```
{
    "configurable": {
        "thread_id": "thread_789"
    },
    "recursion_limit": 30,
    "max_concurrency": 5,
    "tags": ["advertiser-agent", "production"],
    "metadata": {
        "request_id": "req_123"
    },
    "run_name": "campaign_analysis"
}
```


새 개념
-------
- `StateGraph(..., context_schema=...)`
- node 인자의 `Runtime[Context]`로 실행 context 접근
- 같은 graph를 model, prompt, style이 다른 context로 재사용

`context`는 애플리케이션이 node에 주입하는 실행별 의존성입니다.
`configurable.thread_id` 같은 checkpoint 예약 설정과 역할이 다릅니다.

그래프 구조
-----------
실행별 context의 모델·지침·말투 설정을 적용해 대화 응답을 생성한다.

START ─▶ chat ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "messages": [
    {
      "role": "user",
      "content": "LangGraph가 뭐야?"
    }
  ]
}
```
관찰할 결과: messages의 마지막 응답에 실행별 지침과 style이 적용되는지 확인합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
Python invoke의 context={"model": "luna", "system_prompt": "You are a friendly Korean teacher.", "style": "playful"}를 별도로 전달합니다. context는 state 입력과 다릅니다.
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

    model = context.get("model", "luna")
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
            "model": "luna",
            "system_prompt": "You are a friendly Korean teacher.",
            "style": "playful",
        },
    )
    print(result["messages"][-1].content)
