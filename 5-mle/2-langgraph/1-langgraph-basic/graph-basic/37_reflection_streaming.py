"""
Example 37 — Reflection with custom progress streaming.

36 번 예제는 generate ⇄ critic 루프가 모두 끝난 뒤에야 결과가 나와서,
실제 사용자 입장에서는 "한참 멈춘 것 같은" 체감이 있다.
이 예제는 동일한 reflection 루프를 **MessagesState 위에서** 다시 구현하면서,
각 단계 진입 시점마다 `get_stream_writer()`로 custom event를
즉시 흘려보냅니다. `values`/`updates`는 노드 종료 후에 emit되지만,
`custom` event는 노드 내부의 writer 호출 시점에 전달됩니다.

선행 예제
---------
- 36: reflection loop
- 18: custom streaming

새 개념
-------
- 반복 작업의 노드 진입 진행률을 custom stream으로 분리

복습 개념
-------
- `MessagesState`, reflection 종료 조건, multiple stream modes

핵심 아이디어
-------------
- State 는 `MessagesState` 를 상속해서 LangGraph Studio / streaming 에서
  `messages` 만 구독하면 사용자용 출력이 전부 흘러나오게 한다.
- critic 의 **구체적인 평가 내용**은 user-facing message 에 절대 넣지 않는다.
  대신 `critique` state 필드에만 저장해서 다음 generate 호출의 컨텍스트로만 쓴다.
- 사용자는 다음 형태의 진행 메시지만 본다:
    * "✏️  1회차 초안 작성 중..."
    * "🔍  검토 중..."
    * "✨  피드백 반영해 수정 중... (2회차)"
    * 최종 draft (AIMessage)

그래프 구조
-----------
START ─▶ generate ─▶ critic ─┬─▶ finalize ─▶ END  (GOOD or max iter)
                              └─▶ generate (revise)

테스트 입력 예시
---------------
- {"messages": [{"role": "user", "content": "AWS Bedrock"}]}
- {"messages": [{"role": "user", "content": "친환경 텀블러"}]}
- {"messages": [{"role": "user", "content": "신입 개발자용 LangChain 강의"}]}

확인 포인트
- `stream_mode="custom"`으로 generate / critic 진입 event가 즉시 흘러나온다
- 최종 messages 마지막 AIMessage 가 다듬어진 카피
- critic 의 raw critique 는 messages 어디에도 노출되지 않는다 (state['critique'] 에만 존재)
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, MessagesState, StateGraph

from common.llm import create_llm

MAX_ITERATIONS = 3


class State(MessagesState):
    draft: str
    critique: str
    iterations: int


def _content(resp) -> str:
    c = resp.content
    if isinstance(c, list):
        return " ".join(b.get("text", "") for b in c if isinstance(b, dict))
    return str(c)


def _latest_user_task(state: State) -> str:
    """messages 에서 가장 최근 HumanMessage 의 텍스트를 task 로 사용."""
    for m in reversed(state["messages"]):
        if isinstance(m, HumanMessage):
            return _content(m) if not isinstance(m.content, str) else m.content
    return ""


def _narrate(step: str, iteration: int, extra: str = "") -> str:
    """추가 LLM 호출 없이 결정론적인 사용자용 progress 문구를 만든다."""
    suffix = f" · {extra}" if extra else ""
    return f"[{step}] 진행 중... ({iteration}회차){suffix}"


def generate(state: State) -> dict:
    iterations = state.get("iterations", 0)
    task = _latest_user_task(state)
    writer = get_stream_writer()
    writer(
        {
            "phase": "generate",
            "iteration": iterations + 1,
            "message": "draft generation started",
        }
    )

    # 진행 문구는 결정론적으로 생성하고 critique 원문을 포함하지 않는다.
    if iterations == 0:
        progress_text = _narrate("초안 작성", 1, extra=f"주제: {task}")
        prompt = f"Write a 2-sentence promotional blurb about: {task}"
    else:
        progress_text = _narrate("피드백 반영 후 수정", iterations + 1)
        prompt = (
            f"Improve the following draft based on the critique.\n"
            f"---DRAFT---\n{state.get('draft', '')}\n"
            f"---CRITIQUE---\n{state.get('critique', '')}\n"
            f"Return ONLY the improved 2-sentence blurb."
        )

    progress = AIMessage(content=progress_text, name="progress")

    llm = create_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    new_draft = _content(resp)

    return {
        "draft": new_draft,
        "iterations": iterations + 1,
        # progress 만 흘려보내고, draft 자체는 아직 최종이 아닐 수 있어서
        # 여기서는 messages 에 추가하지 않는다 (finalize 에서 한 번만 노출).
        "messages": [progress],
    }


def critic(state: State) -> dict:
    writer = get_stream_writer()
    writer(
        {
            "phase": "critic",
            "iteration": state.get("iterations", 0),
            "message": "draft review started",
        }
    )
    # 평가 시작을 알리는 진행 메시지만 노출. 평가 결과 텍스트는 노출하지 않는다.
    # 진행 문구에는 회차만 넣고 critique 본문은 포함하지 않는다.
    progress_text = _narrate("검토", state.get("iterations", 0))
    progress = AIMessage(content=progress_text, name="progress")

    llm = create_llm()
    resp = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are a strict editor. If the draft is concise (~2 sentences), "
                    "engaging, and free of fluff, reply EXACTLY 'GOOD'. "
                    "Otherwise list 1-2 specific improvements (no preamble)."
                )
            ),
            HumanMessage(content=state["draft"]),
        ]
    )
    return {
        "critique": _content(resp).strip(),
        "messages": [progress],
    }


def finalize(state: State) -> dict:
    """루프 종료 시점에만 최종 draft 를 사용자용 메시지로 노출한다."""
    get_stream_writer()(
        {
            "phase": "finalize",
            "iteration": state.get("iterations", 0),
            "message": "final draft ready",
        }
    )
    return {
        "messages": [
            AIMessage(
                content=state.get("draft", ""),
                name="final",
            )
        ]
    }


def should_continue(state: State) -> str:
    critique = state.get("critique", "")
    iters = state.get("iterations", 0)
    if critique.strip().upper() == "GOOD" or iters >= MAX_ITERATIONS:
        return "finalize"
    return "generate"


def build_graph():
    builder = StateGraph(State)

    builder.add_node("generate", generate)
    builder.add_node("critic", critic)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "generate")
    builder.add_edge("generate", "critic")
    builder.add_conditional_edges(
        "critic",
        should_continue,
        {"generate": "generate", "finalize": "finalize"},
    )
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    # streaming 으로 돌려서 progress 메시지가 단계별로 흘러나오는지 확인.
    initial = {"messages": [HumanMessage(content="AWS Bedrock")]}

    print("=== custom progress + values ===")
    final_state = None
    for mode, chunk in graph.stream(
        initial, stream_mode=["custom", "values"]
    ):
        if mode == "custom":
            print(f"[progress] {chunk}")
            continue
        final_state = chunk

    if final_state:
        print("\n=== summary ===")
        print(f"iterations: {final_state.get('iterations')}")
        print(f"final draft: {final_state.get('draft')}")
