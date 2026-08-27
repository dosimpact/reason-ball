"""
Example 36 — Reflection (self-critique loop).

LLM 이 만든 초안을 같은(또는 다른) LLM 이 비평하고, 만족할 때까지 다시 작성하는 패턴.
LangGraph 의 cyclic graph 강점을 가장 잘 보여주는 예.

선행 예제
---------
- 06: cycle과 종료 조건
- 08: LLM node

새 개념
-------
- generate → critic → revise로 이어지는 self-reflection loop
- 품질 신호와 최대 횟수를 함께 사용하는 종료 안전장치

복습 개념
-------
- conditional edge, cycle, partial state update

학습 포인트
-----------
- `generate ⇄ critic` 사이클을 조건부 엣지로 만든다
- 종료 조건: critic 이 GOOD 신호를 주거나, 최대 iterations 에 도달
- 매 iteration 의 critique 가 다음 generate 의 system prompt 에 누적

그래프 구조
-----------
START ─▶ generate ─▶ critic ─┬─▶ END (GOOD)
                              └─▶ generate (revise)

테스트 입력 예시 (state.task: str — 광고 카피 작성용 주제)
-------------------------------------------------------
2-sentence promotional blurb 작성이 task 라서 짧은 주제어가 잘 맞음.

- {"task": "AWS Bedrock"}
- {"task": "LangGraph"}
- {"task": "Korean BBQ restaurant in Seoul"}
- {"task": "AI-powered note-taking app"}
- {"task": "친환경 텀블러"}
- {"task": "신입 개발자용 LangChain 강의"}

확인 포인트
- out["iterations"]: 1~3 사이 (1이면 첫 시도부터 GOOD, 3이면 max 도달)
- out["history"]: 매 iteration 의 draft 가 어떻게 개선되었는지 비교
"""

from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm

MAX_ITERATIONS = 3


class State(TypedDict, total=False):
    task: str
    draft: str
    critique: str
    iterations: int
    history: list[str]  # 각 iteration 의 draft 기록


def _content(resp) -> str:
    c = resp.content
    if isinstance(c, list):
        return " ".join(b.get("text", "") for b in c if isinstance(b, dict))
    return str(c)


def generate(state: State) -> dict:
    llm = create_llm()
    iterations = state.get("iterations", 0)
    if iterations == 0:
        prompt = f"Write a 2-sentence promotional blurb about: {state['task']}"
    else:
        prompt = (
            f"Improve the following draft based on the critique.\n"
            f"---DRAFT---\n{state.get('draft', '')}\n"
            f"---CRITIQUE---\n{state.get('critique', '')}\n"
            f"Return ONLY the improved 2-sentence blurb."
        )
    resp = llm.invoke([HumanMessage(content=prompt)])
    new_draft = _content(resp)
    history = state.get("history", []) + [new_draft]
    return {"draft": new_draft, "iterations": iterations + 1, "history": history}


def critic(state: State) -> dict:
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
    return {"critique": _content(resp).strip()}


def should_continue(state: State) -> str:
    critique = state.get("critique", "").strip().upper()
    iters = state.get("iterations", 0)
    # substring 판정은 "NOT GOOD"도 성공으로 오판할 수 있으므로 정확히 비교한다.
    if critique == "GOOD" or iters >= MAX_ITERATIONS:
        return "__end__"
    return "generate"


def build_graph():
    builder = StateGraph(State)

    builder.add_node("generate", generate)
    builder.add_node("critic", critic)

    builder.add_edge(START, "generate")
    builder.add_edge("generate", "critic")
    builder.add_conditional_edges(
        "critic", should_continue, {"generate": "generate", "__end__": END}
    )
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke({"task": "AWS Bedrock"})
    print(f"final ({out['iterations']} iters): {out['draft']}")
    print("\nhistory:")
    for i, h in enumerate(out["history"], 1):
        print(f"  [{i}] {h[:120]}")
