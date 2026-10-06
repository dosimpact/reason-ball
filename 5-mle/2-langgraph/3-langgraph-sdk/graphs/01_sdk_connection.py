"""Example 01: minimal OpenAI-backed graph for SDK connection practice."""
# 예제 개요: SDK에서 서버 그래프를 호출하고 모델 응답을 받는 최소 연결 예제입니다.
# 핵심 흐름: 메시지 입력 → call_model → 응답 메시지 반환 순서로 실행합니다.

from __future__ import annotations

from langchain_core.messages import SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


SYSTEM_PROMPT = (
    "You are the LangGraph SDK connection example. Reply in one concise "
    "sentence and mention that the response came from an OpenAI-backed graph."
)


# 현재 단계의 입력으로 모델을 호출하고 응답을 다음 노드가 사용할 상태로 반환합니다.
def call_model(state: MessagesState) -> dict:
    """Call OpenAI and append the response to message state."""
    llm = create_llm()
    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT)] + state["messages"])
    if isinstance(response.content, str) and "openai-backed graph" not in response.content.lower():
        response.content = (
            f"{response.content.rstrip()} "
            "This response came from an OpenAI-backed graph."
        )
    return {"messages": [response]}


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
def build_graph():
    builder = StateGraph(MessagesState)
    builder.add_node("call_model", call_model)
    builder.add_edge(START, "call_model")
    builder.add_edge("call_model", END)
    return builder.compile()


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    result = graph.invoke({"messages": [HumanMessage(content="Say hello.")]})
    print(result["messages"][-1].content)
