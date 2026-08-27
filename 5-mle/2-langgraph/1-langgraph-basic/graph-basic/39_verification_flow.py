"""
Example 39 — Deterministic rule validation and repair.

답변 생성 이후 별도 validator 노드가 문자열 길이, 금지 표현,
필수 citation token **형식** 같은 결정적 규칙을 검사하고,
실패하면 repair 노드로 보내는 패턴입니다.

이 예제는 citation token의 존재를 검사할 뿐, 실제 출처가 주장을
뒷받침하는지나 답변이 사실인지를 검증하지는 않습니다.

선행 예제
---------
- 38: evaluator loop와 재시도 상한

새 개념
-------
- LLM evaluator 대신 코드로 실행하는 deterministic rule validation
- validation error 목록을 repair prompt로 전달하는 패턴

복습 개념
-------
- conditional loop와 최대 repair 횟수

그래프 구조
-----------
START ─▶ draft ─▶ verify ─┬─▶ END (verified)
                           └─▶ repair ─▶ verify

테스트 입력 예시
---------------
- {"question": "LangGraph 는 무엇이고 언제 쓰나요?"}
- {"question": "checkpoint 는 왜 필요한가요?"}
"""

from __future__ import annotations

from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from common.llm import create_llm

MAX_REPAIRS = 2
REQUIRED_CITATION = "[source:langgraph]"


class State(TypedDict, total=False):
    question: str
    answer: str
    verified: bool
    verification_errors: list[str]
    repair_count: int


def _text(content) -> str:
    if isinstance(content, list):
        return " ".join(b.get("text", "") for b in content if isinstance(b, dict))
    return str(content)


def draft(state: State) -> dict:
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Answer in Korean. Keep it under 120 words. "
                    f"End with the citation token {REQUIRED_CITATION}."
                )
            ),
            HumanMessage(content=state["question"]),
        ]
    )
    return {"answer": _text(response.content)}


def verify(state: State) -> dict:
    answer = state.get("answer", "")
    errors: list[str] = []
    if REQUIRED_CITATION not in answer:
        errors.append(f"missing required citation {REQUIRED_CITATION}")
    if len(answer) < 80:
        errors.append("answer is too short to be useful")
    if any(word in answer.lower() for word in ["guaranteed", "100%"]):
        errors.append("overconfident guarantee is not allowed")
    return {"verified": not errors, "verification_errors": errors}


def repair(state: State) -> dict:
    llm = create_llm()
    errors = "\n".join(f"- {e}" for e in state.get("verification_errors", []))
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "Repair the answer so it satisfies every verification error. "
                    "Return only the repaired Korean answer."
                )
            ),
            HumanMessage(
                content=(
                    f"QUESTION:\n{state['question']}\n\n"
                    f"ANSWER:\n{state.get('answer', '')}\n\n"
                    f"ERRORS:\n{errors}\n\n"
                    f"Required citation token: {REQUIRED_CITATION}"
                )
            ),
        ]
    )
    return {
        "answer": _text(response.content),
        "repair_count": state.get("repair_count", 0) + 1,
    }


def route_after_verify(state: State) -> str:
    if state.get("verified") or state.get("repair_count", 0) >= MAX_REPAIRS:
        return "__end__"
    return "repair"


def build_graph():
    builder = StateGraph(State)
    builder.add_node("draft", draft)
    builder.add_node("verify", verify)
    builder.add_node("repair", repair)

    builder.add_edge(START, "draft")
    builder.add_edge("draft", "verify")
    builder.add_conditional_edges(
        "verify",
        route_after_verify,
        {"repair": "repair", "__end__": END},
    )
    builder.add_edge("repair", "verify")
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke({"question": "LangGraph 는 무엇이고 언제 쓰나요?"})
    print("verified:", out["verified"], out.get("verification_errors"))
    print(out["answer"])
