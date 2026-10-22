"""Conversational replies share the same post-answer hook as filing research."""
from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from domains.sec_chat.activity import tracked_node
from domains.sec_chat.conversation import ConversationRequest, resolve_conversation
from domains.sec_chat.follow_ups import suggest_follow_ups
from domains.sec_chat.presentation import compose_ui
from graph.primary_graphs.sec_intelligent_ui.workflow import chat_model


class ConversationState(TypedDict):
    request: ConversationRequest
    source: dict | None
    response: dict


def build_conversation_graph(model=None, client=None, activity=None, ui_validator=None):
    async def respond(state: ConversationState):
        return {"response": await resolve_conversation(state["request"], state["source"], model or chat_model(), client, activity)}

    async def present(state: ConversationState):
        program = await compose_ui(state["request"].message, state["response"], model or chat_model(), validator=ui_validator)
        return {"response": {**state["response"], "program": program}}

    async def after_answer(state: ConversationState):
        body = state["request"]
        suggestions = await suggest_follow_ups(body.message, state["response"], [item.model_dump() for item in body.history], state["source"], model or chat_model())
        return {"response": {**state["response"], **suggestions}}

    graph = StateGraph(ConversationState)
    graph.add_node("respond", tracked_node("메시지 해석 및 기업 확인·응답", respond, activity))
    graph.add_node("present", tracked_node("Intelligent UI 구성 및 검증", present, activity))
    graph.add_node("after_answer", tracked_node("다음 추천 질문 생성", after_answer, activity))
    graph.add_edge(START, "respond")
    # Research routing is internal, not a displayed answer. Its filing graph runs the hook once.
    graph.add_conditional_edges("respond", lambda state: "research" if state["response"]["action"] == "research" else "answered", {"research": END, "answered": "present"})
    graph.add_edge("present", "after_answer")
    graph.add_edge("after_answer", END)
    return graph.compile()
