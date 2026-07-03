"""대화 기록을 저장하고 다시 사용하는 메모리 챗봇 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from typing import Any, NotRequired, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects_2.project_08_memory_chatbot.memory_chatbot import (
    DEFAULT_THREAD_ID,
    MemoryChatbot,
)


class MemoryChatbotState(TypedDict):
    input: NotRequired[str]
    thread_id: NotRequired[str]
    answer: NotRequired[str]
    store_checkpoint_id: NotRequired[int]
    message_count: NotRequired[int]
    summary: NotRequired[str]
    facts: NotRequired[dict[str, str]]
    error: NotRequired[str]


DEFAULT_INPUT = "LangChain memory를 설명해줘"
chatbot = MemoryChatbot()


def chat_node(
    state: MemoryChatbotState,
    config: RunnableConfig | None = None,
) -> dict[str, Any]:
    try:
        configurable = (config or {}).get("configurable", {})
        thread_id = state.get("thread_id") or configurable.get("thread_id") or DEFAULT_THREAD_ID
        turn = chatbot.ask(state.get("input") or DEFAULT_INPUT, thread_id=str(thread_id))
        return {
            "thread_id": turn.thread_id,
            "answer": turn.answer,
            "store_checkpoint_id": turn.checkpoint_id,
            "message_count": turn.message_count,
            "summary": turn.summary,
            "facts": turn.facts,
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(MemoryChatbotState)
builder.add_node("chat", chat_node)
builder.add_edge(START, "chat")
builder.add_edge("chat", END)

graph = builder.compile()
