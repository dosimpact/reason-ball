"""
Example 16 — Modern interrupt() + Command(resume).

05 의 `interrupt_before` 는 "특정 노드 진입 전에 그래프를 정지" 시킬 뿐,
"무엇을 사용자에게 보여줄지" 와 "사용자 입력을 어떻게 다시 그래프에 흘릴지" 는
직접 처리해야 했습니다.

새로운 `interrupt()` 함수는 그것을 한 번에 처리합니다:
- 노드 함수 내부에서 `value = interrupt({"question": ..., "draft": ...})` 호출
- 그래프가 즉시 일시 정지되고, dict 가 클라이언트에 전달됨
- 클라이언트가 `graph.invoke(Command(resume="..."), config=cfg)` 로 재개하면
  멈춰있던 `interrupt()` 호출이 그 값을 반환

학습 포인트
-----------
- `from langgraph.types import interrupt, Command`
- 한 노드 안에 여러 interrupt 가능 (각 호출마다 한 번씩 멈춤)
- HITL 승인/수정 흐름을 클린하게 표현

시나리오
--------
draft 생성 → human_review (interrupt 로 사용자에게 승인 요청) → publish

그래프 구조
-----------
START ─▶ generate ─▶ human_review (⛔ interrupt) ─▶ publish ─▶ END

테스트 입력 예시 (state.topic: str, **반드시 thread_id 필요**)
-----------------------------------------------------------
1단계 — 첫 invoke 로 draft 생성 후 interrupt 발생:
   - {"topic": "LangGraph"}
   - {"topic": "Bedrock"}
   - {"topic": "FastAPI"}
   - {"topic": "친환경 텀블러"}

2단계 — 같은 thread_id 로 Command(resume=...) 재개:
   ▶ 승인     → final = "PUBLISHED: [Draft] An article about ..."
      Command(resume="approve")
   ▶ 거부     → final = "(rejected)"
      Command(resume="reject")
   ▶ 수정 후 승인
      Command(resume={"action": "edit", "text": "[Edited] My custom blurb."})
      → final = "PUBLISHED: [Edited] My custom blurb."

Studio 사용법
   1) topic 입력 → Run → human_review 에서 멈추고 interrupt 페이로드 표시
   2) 우측 패널의 "Resume" 입력란에 "approve" / "reject" 또는
      JSON {"action": "edit", "text": "..."} 입력 후 Resume
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt


class State(TypedDict, total=False):
    topic: str
    draft: str
    approved: bool
    final: str


def generate(state: State) -> dict:
    """간단한 draft 생성 (LLM 없이 결정론적으로)."""
    return {"draft": f"[Draft] An article about {state['topic']}."}


def human_review(state: State) -> dict:
    """사용자에게 draft 를 보여주고 승인 / 거부 / 수정안을 받는다."""
    user_decision = interrupt(
        {
            "question": "Approve this draft?",
            "draft": state.get("draft", ""),
            "options": ["approve", "reject", "edit"],
        }
    )
    # user_decision 은 클라이언트가 Command(resume=...) 로 보낸 값 (문자열 또는 dict)
    if isinstance(user_decision, dict):
        if user_decision.get("action") == "edit":
            return {"draft": user_decision.get("text", state.get("draft", "")),
                    "approved": True}
        return {"approved": user_decision.get("action") == "approve"}

    return {"approved": user_decision == "approve"}


def publish(state: State) -> dict:
    if not state.get("approved"):
        return {"final": "(rejected)"}
    return {"final": f"PUBLISHED: {state.get('draft','')}"}


def build_graph():
    builder = StateGraph(State)

    builder.add_node("generate", generate)
    builder.add_node("human_review", human_review)
    builder.add_node("publish", publish)

    builder.add_edge(START, "generate")
    builder.add_edge("generate", "human_review")
    builder.add_edge("human_review", "publish")
    builder.add_edge("publish", END)
    # langgraph dev 는 checkpointer 자동 주입.
    # 단독 실행 시 __main__ 에서 MemorySaver 부착.
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import Command

    builder = StateGraph(State)
    builder.add_node("generate", generate)
    builder.add_node("human_review", human_review)
    builder.add_node("publish", publish)

    builder.add_edge(START, "generate")
    builder.add_edge("generate", "human_review")
    builder.add_edge("human_review", "publish")
    builder.add_edge("publish", END)
    standalone = builder.compile(checkpointer=MemorySaver())

    cfg = {"configurable": {"thread_id": "demo-cmd-1"}}

    # 1) 첫 invoke — interrupt() 가 호출되며 멈춤
    state = standalone.invoke({"topic": "LangGraph"}, config=cfg)
    print("interrupted, last state:", state)
    # 2) 사용자가 'approve' 를 보내며 재개
    final = standalone.invoke(Command(resume="approve"), config=cfg)
    print("after resume:", final)

    # 3) 새 thread 로 'edit' 시나리오 시연
    cfg2 = {"configurable": {"thread_id": "demo-cmd-2"}}
    standalone.invoke({"topic": "Bedrock"}, config=cfg2)
    final2 = standalone.invoke(
        Command(resume={"action": "edit", "text": "[Edited] Custom blurb about Bedrock."}),
        config=cfg2,
    )
    print("after edit:", final2)
