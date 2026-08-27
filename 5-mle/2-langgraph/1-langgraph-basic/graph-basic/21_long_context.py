"""
Example 21 — Long-context management (요약 + 슬라이딩 윈도우).

긴 대화에서 LLM 의 컨텍스트 한도를 넘기지 않도록 **오래된 메시지를 요약하고
최근 N 개만 유지** 하는 패턴.

핵심 아이디어
-------------
- 매 턴 LLM 호출 후 `messages` 길이가 임계값을 넘으면:
  1) 오래된 부분(최근 KEEP_RECENT 개 제외)을 LLM 으로 요약
  2) 요약본을 `summary` state 에 저장
  3) `RemoveMessage(id=...)` 를 반환해 LangGraph 가 messages 에서 실제로 제거
- 이후 LLM 호출 시 `[SystemMessage(요약 포함)] + 최근 메시지` 만 보냄
  → 토큰 사용량이 메시지 수에 무한히 비례하지 않고 상한선 안에서 유지됨

학습 포인트
-----------
- `MessagesState` 확장 — `summary: str` 추가
- `RemoveMessage(id=...)` — `add_messages` reducer 가 인식하는 특수 메시지
  · ID 가 일치하는 메시지를 messages 에서 삭제
- 조건부 엣지로 "요약 필요?" 분기
- system prompt 안에 누적 요약을 합성해 LLM 이 과거 컨텍스트를 잃지 않게 함

그래프 구조
-----------
START ─▶ chat ─▶ maybe_summarize ─┬─▶ summarize ─▶ END
                                    └─▶ END (요약 불필요)

테스트 메시지 예시 (멀티턴, 같은 thread_id)
------------------------------------------
turn 별로 invoke 를 반복해 messages 가 누적되는 시나리오.
SUMMARIZE_AFTER=8, KEEP_RECENT=4 기준으로 9턴째부터 요약 트리거.

▶ 시나리오 — 사용자 정보를 점진적으로 알려주고 마지막에 회상
   1) "내 이름은 도경이야."
   2) "나는 서울에 살아."
   3) "내 직업은 백엔드 엔지니어야."
   4) "취미는 등산과 사진이야."
   5) "좋아하는 음식은 김치찌개야."
   6) "최근에 제주도 여행 다녀왔어."
   7) "고양이를 한 마리 키우고 있어. 이름은 모카."
   8) "주말에는 주로 책을 읽어."
   9) "오늘 회사에서 칭찬받았어!"     ← 여기서부터 요약 발생 가능
  10) "내가 지금까지 알려준 정보를 모두 요약해줘"
      → summary 에 저장된 과거 + 최근 KEEP_RECENT 메시지로 답변

확인 포인트
- 매 턴 후 state["summary"] 가 채워지는지 (9턴 이후)
- state["messages"] 길이가 SUMMARIZE_AFTER 를 넘지 않는지 (요약 후 줄어듦)
- 마지막 요약 요청에 LLM 이 초반 정보(이름, 거주지 등)도 알고 있는지
"""

from __future__ import annotations

from langchain_core.messages import (
    AIMessage,
    AnyMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
)
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


def build_graph():
    builder = StateGraph(State)
    builder.add_node("chat", chat)
    builder.add_node("summarize", summarize)
    builder.add_edge(START, "chat")
    builder.add_conditional_edges(
        "chat", needs_summary, {"summarize": "summarize", "__end__": END}
    )
    builder.add_edge("summarize", END)
    # checkpointer 는:
    #  - `langgraph dev` / Platform: 자동 주입
    #  - 단독 실행: __main__ 에서 MemorySaver 직접 부착
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import MemorySaver

    builder = StateGraph(State)
    builder.add_node("chat", chat)
    builder.add_node("summarize", summarize)
    builder.add_edge(START, "chat")
    builder.add_conditional_edges(
        "chat", needs_summary, {"summarize": "summarize", "__end__": END}
    )
    builder.add_edge("summarize", END)
    standalone = builder.compile(checkpointer=MemorySaver())

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
