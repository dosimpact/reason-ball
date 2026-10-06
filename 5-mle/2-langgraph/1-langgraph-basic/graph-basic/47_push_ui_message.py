"""Example 47 — push_ui_message로 UI 이벤트와 state 함께 갱신하기.

선행: 09 MessagesState, 18 custom streaming, 03 reducer.
실행: uv run python graph-basic/47_push_ui_message.py (API 키 불필요)

START -> create_card -> complete_card -> END

- name은 프런트엔드에 등록할 컴포넌트 이름, props는 전달할 데이터다.
- ui_message_reducer는 같은 ID를 갱신하고 merge=True일 때 props를 얕게 병합한다.
- message=AIMessage는 metadata.message_id로 채팅 응답과 UI를 연결한다.
- push_ui_message가 ui state에 직접 쓰므로 노드 반환값에 ui를 중복 추가하지 않는다.
- state_key=None이면 custom 이벤트만 보내고 state에는 저장하지 않는다.

CLI는 이벤트와 최종 state를 출력한다. 실제 카드를 렌더링하려면 별도
프런트엔드에서 task_card 컴포넌트를 등록하고 custom UI 이벤트를 처리해야 한다.
Studio 그래프 ID: b_47_push_ui_message.
공식 API: https://reference.langchain.com/python/langgraph/graph/ui/push_ui_message
"""

from __future__ import annotations

from typing import Annotated
from uuid import uuid4

from langchain_core.messages import AIMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.graph.ui import AnyUIMessage, push_ui_message, ui_message_reducer


class State(MessagesState):
    ui: Annotated[list[AnyUIMessage], ui_message_reducer]
    card_id: str


def create_card(state: State) -> dict:
    card_id = str(uuid4())
    push_ui_message(
        "task_card",
        {"title": "LangGraph UI 메시지 학습", "status": "running", "progress": 0},
        id=card_id,
        metadata={"example": "47_push_ui_message"},
    )
    return {"card_id": card_id}


def complete_card(state: State) -> dict:
    message = AIMessage(content="학습 카드 처리가 완료되었습니다.", id=str(uuid4()))
    push_ui_message(
        "task_card",
        {"status": "completed", "progress": 100},
        id=state["card_id"],
        merge=True,  # 기존 title을 유지하며 status/progress만 갱신
        message=message,
    )
    return {"messages": [message]}


def build_graph():
    builder = StateGraph(State)
    
    builder.add_node("create_card", create_card)
    builder.add_node("complete_card", complete_card)
    builder.add_edge(START, "create_card")
    builder.add_edge("create_card", "complete_card")
    builder.add_edge("complete_card", END)

    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    for mode, event in graph.stream(
        {"messages": [], "ui": []}, stream_mode=["custom", "values"]
    ):
        if mode == "custom":
            print("UI event:", event)
        else:
            print("UI state:", event.get("ui", []))
