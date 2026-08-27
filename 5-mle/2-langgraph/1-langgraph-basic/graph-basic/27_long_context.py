"""Example 27 — Long-context 관리: 요약과 최근 메시지 유지.

선행 개념
---------
- ``MessagesState``, checkpointer, 조건부 edge

새 개념
-------
- 오래된 메시지를 누적 ``summary``로 압축
- ``RemoveMessage(id=...)``를 반환해 메시지 reducer에서 실제 삭제
- 요약과 최근 ``KEEP_RECENT``개 메시지를 다음 LLM 입력에 함께 사용

복습 개념
---------
- 같은 ``thread_id``의 멀티턴 메시지 누적과 조건 라우팅

``SUMMARIZE_AFTER``는 사용자 turn 수나 token 수가 아니라 **state의 message 개수**다.
이 그래프는 ``chat`` 노드가 AI 응답을 추가한 다음 ``len(messages) > 8``인지 검사한다.
매 invoke가 HumanMessage 1개와 AIMessage 1개를 추가한다면 첫 요약은 5번째 turn의
응답 뒤(message 10개)에 발생한다. 요약 후 최근 4개를 남기므로 이후 트리거 간격도
고정된 "9번째 turn"이 아니다.

메시지 개수는 token 양과 같지 않다. 운영 환경에서는 모델별 token counter와 실제
context window를 기준으로 트리거하는 것이 안전하다.
"""

from __future__ import annotations

from langchain_core.messages import (
    AIMessage,
    AnyMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
)
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm

# ---------------------------------------------------------------------------
# 임계값 — 실제 운영에선 토큰 카운트 기반으로 바꾸는 것을 권장
# ---------------------------------------------------------------------------
SUMMARIZE_AFTER = 8  # messages 가 이 개수를 넘으면 요약 트리거
KEEP_RECENT = 4  # 요약 후 최근 N 개는 그대로 유지


class State(MessagesState):
    """MessagesState + 누적 요약."""

    summary: str


def _content(resp) -> str:
    """응답이 list[block] 일 수도 있어 안전하게 문자열화."""
    c = resp.content
    if isinstance(c, list):
        return " ".join(b.get("text", "") for b in c if isinstance(b, dict))
    return str(c)


def chat(state: State) -> dict:
    """LLM 호출. 누적 요약이 있으면 system prompt 에 합성."""
    llm = create_llm()
    summary = state.get("summary", "")

    system_text = (
        "You are a friendly assistant. Reply concisely in the user's language."
    )
    if summary:
        # 요약을 system prompt 에 끼워넣어 모델이 과거 컨텍스트를 인식하게 함
        system_text += (
            "\n\nSummary of earlier conversation (for your context, do not repeat verbatim):\n"
            f"{summary}"
        )

    response = llm.invoke([SystemMessage(content=system_text), *state["messages"]])
    return {"messages": [response]}


def needs_summary(state: State) -> str:
    """messages 가 임계값을 넘으면 summarize 노드로, 아니면 종료."""
    if len(state["messages"]) > SUMMARIZE_AFTER:
        return "summarize"
    return "__end__"


def summarize(state: State) -> dict:
    """오래된 메시지를 요약하고, 요약 대상이었던 메시지들은 RemoveMessage 로 삭제."""
    messages: list[AnyMessage] = state["messages"]
    # 최근 KEEP_RECENT 개는 보존, 그 앞쪽이 요약 대상
    to_summarize = messages[:-KEEP_RECENT] if KEEP_RECENT > 0 else messages
    if not to_summarize:
        return {}

    # 이전 요약이 있다면 누적 (요약의 요약)
    prev_summary = state.get("summary", "")
    instruction = (
        "Summarize the following conversation into 3-6 short bullet points "
        "preserving key facts (names, preferences, decisions). "
        "Korean conversation → Korean summary, otherwise English."
    )
    if prev_summary:
        instruction += f"\n\nPrevious summary to extend:\n{prev_summary}"

    transcript_lines = []
    for m in to_summarize:
        role = (
            "User"
            if isinstance(m, HumanMessage)
            else ("Assistant" if isinstance(m, AIMessage) else type(m).__name__)
        )
        transcript_lines.append(f"{role}: {_content(m)}")
    transcript = "\n".join(transcript_lines)

    llm = create_llm()
    resp = llm.invoke(
        [
            SystemMessage(content=instruction),
            HumanMessage(content=transcript),
        ]
    )
    new_summary = _content(resp).strip()

    # add_messages reducer 는 RemoveMessage(id=...) 를 보면
    # 해당 ID 의 메시지를 messages 에서 제거한다.
    removals = [RemoveMessage(id=m.id) for m in to_summarize if getattr(m, "id", None)]

    return {"summary": new_summary, "messages": removals}


def build_graph(*, checkpointer: BaseCheckpointSaver | None = None):
    builder = StateGraph(State)
    builder.add_node("chat", chat)
    builder.add_node("summarize", summarize)
    builder.add_edge(START, "chat")
    builder.add_conditional_edges(
        "chat", needs_summary, {"summarize": "summarize", "__end__": END}
    )
    builder.add_edge("summarize", END)
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import InMemorySaver

    standalone = build_graph(checkpointer=InMemorySaver())

    cfg = {"configurable": {"thread_id": "long-ctx-demo"}}

    turns = [
        "내 이름은 도경이야.",
        "나는 서울에 살아.",
        "내 직업은 백엔드 엔지니어야.",
        "취미는 등산과 사진이야.",
        "좋아하는 음식은 김치찌개야.",
        "최근에 제주도 여행 다녀왔어.",
        "고양이를 한 마리 키우고 있어. 이름은 모카.",
        "주말에는 주로 책을 읽어.",
        "오늘 회사에서 칭찬받았어!",
        "내가 지금까지 알려준 정보를 모두 요약해줘",
    ]

    for i, t in enumerate(turns, 1):
        out = standalone.invoke({"messages": [HumanMessage(content=t)]}, config=cfg)
        msgs = out.get("messages", [])
        summary = out.get("summary", "")
        print(f"\n--- turn {i} ---")
        print(f"user: {t}")
        print(f"assistant: {_content(msgs[-1]) if msgs else ''}")
        print(f"  messages_in_state={len(msgs)}  summary_len={len(summary)}")
        if summary:
            print(f"  summary: {summary[:200]}...")
