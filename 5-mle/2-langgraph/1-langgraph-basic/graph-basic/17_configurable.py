"""
Example 17 — Configurable graph (runtime config schema).

같은 그래프를 호출 시점마다 **다른 모델 / 다른 system prompt / 다른 temperature** 로
실행할 수 있도록 configurable schema 를 선언하는 패턴.

학습 포인트
-----------
- `StateGraph(..., config_schema=ConfigSchema)` 로 Studio UI 가 자동으로 설정 폼을 생성
- 노드 함수 두 번째 인자로 `config: RunnableConfig` 를 받아 `config["configurable"]` 에 접근
- 호출 시: `graph.invoke(..., config={"configurable": {"model": "fast", ...}})`

그래프 구조
-----------
START ─▶ chat ─▶ END  (단일 LLM 노드. config 에 따라 LLM 동작이 바뀜)

설정값  LangGraph 에서 특히 자주 쓰는 것
-----------
1. configurable 안에 들어가는 LangGraph 예약 키들
- configurable 은 사용자 정의 외에도 LangGraph 가 내부적으로 쓰는 예약 키가 있습니다:
config = {
    "configurable": {
        "thread_id": "abc-123",        # checkpointer 가 사용하는 대화 스레드 ID
        "checkpoint_id": "...",         # 특정 체크포인트로 rewind
        "checkpoint_ns": "",            # 체크포인트 namespace
        "user_id": "user_42",           # 사용자 정의 (예시)
        "model": "fast",               # 사용자 정의
    }
}
2. recursion_limit — LangGraph 에서 ReAct 류 그래프 돌릴 때 자주 만지는 값
- graph.invoke(payload, config={"recursion_limit": 50})


테스트 입력 예시 (state = MessagesState, config 로 동작 제어)
-----------------------------------------------------------
같은 메시지를 다른 config 로 호출해서 응답 차이를 비교하는 게 핵심.

▶ 공통 메시지 후보
   - "LangGraph 한 줄로 요약해줘"
   - "What are the benefits of using AWS Bedrock?"
   - "재귀 함수가 뭐야?"

▶ config 조합 예시 (Studio: "Manage Assistants" 에서 폼 입력)
   1) 기본
      config = {}                             → default + concise

   2) style 만 변경
      config = {"configurable": {"style": "playful"}}
      config = {"configurable": {"style": "detailed"}}

   3) 다른 모델로 교체
      config = {"configurable": {"model": "fast", "style": "concise"}}
      config = {"configurable": {"model": "smart",  "style": "detailed"}}

   4) 페르소나 변경
      config = {"configurable": {
          "system_prompt": "You are a witty Korean tech commentator.",
          "style": "playful"
      }}
      config = {"configurable": {
          "system_prompt": "You are a strict senior engineer reviewing code.",
          "style": "detailed"
      }}
"""

from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm


class ConfigSchema(TypedDict, total=False):
    model: str  # "default" | "smart" | "fast"
    system_prompt: str  # 자유 텍스트
    style: str  # "concise" | "detailed" | "playful"


STYLE_HINTS = {
    "concise": "Reply in one short sentence.",
    "detailed": "Reply with detailed explanation including examples.",
    "playful": "Reply in a playful, witty tone with at most 2 sentences.",
}


def chat(state: MessagesState, config: RunnableConfig) -> dict:
    cfg = (config or {}).get("configurable", {}) or {}

    model_alias = cfg.get("model", "default")
    style = cfg.get("style", "concise")

    base_prompt = cfg.get(
        "system_prompt",
        "You are a helpful assistant.",
    )

    system = SystemMessage(content=f"{base_prompt}\n{STYLE_HINTS.get(style, '')}")

    llm = create_llm(model_alias)
    response = llm.invoke([system] + state["messages"])

    return {"messages": [response]}


def build_graph():
    # config_schema 를 선언하면 Studio UI 의 "Manage Assistants" 에서 폼이 노출됨
    builder = StateGraph(MessagesState, config_schema=ConfigSchema)

    builder.add_node("chat", chat)

    builder.add_edge(START, "chat")
    builder.add_edge("chat", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langchain_core.messages import HumanMessage

    payload = {"messages": [HumanMessage(content="LangGraph 한 줄로 요약해줘")]}

    # 1) 기본 (default, concise)
    out1 = graph.invoke(payload)
    print("default:", out1["messages"][-1].content)

    # 2) 다른 style + 다른 system prompt
    out2 = graph.invoke(
        payload,
        config={
            "configurable": {
                "model": "default",
                "style": "playful",
                "system_prompt": "You are a witty Korean tech commentator.",
            }
        },
    )
    print("playful:", out2["messages"][-1].content)
