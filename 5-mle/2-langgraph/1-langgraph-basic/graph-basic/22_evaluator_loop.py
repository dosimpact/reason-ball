"""
Example 22 — Evaluator loop.

생성 노드가 답변을 만들고, evaluator 노드가 명시적인 품질 기준으로
PASS / FAIL 을 판단한 뒤 실패하면 재작성하는 패턴.

Reflection(12) 이 자유형 critique 중심이라면, 이 예제는 실무에서 더 자주 쓰는
"점수/통과 여부/재시도 상한" 중심 evaluator loop 를 보여줍니다.

그래프 구조
-----------
START ─▶ generate ─▶ evaluate ─┬─▶ END (PASS 또는 max attempts)
                                └─▶ generate (revise)

테스트 입력 예시
---------------
- {"question": "LangGraph 를 실무 관점에서 설명해줘"}
- {"question": "HITL approval flow 가 왜 필요한지 설명해줘"}
"""

from __future__ import annotations

from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm

MAX_ATTEMPTS = 3


class EvalResult(BaseModel):
    verdict: Literal["PASS", "FAIL"] = Field(
        description="Whether the answer is acceptable."
    )
    score: int = Field(description="Quality score from 1 to 5.", ge=1, le=5)
    feedback: str = Field(description="One concise improvement note.")


class State(TypedDict, total=False):
    question: str
    answer: str
    verdict: str
    score: int
    feedback: str
    attempts: int
    drafts: list[str]


def _text(content) -> str:
    if isinstance(content, list):
        return " ".join(b.get("text", "") for b in content if isinstance(b, dict))
    return str(content)


def generate(state: State) -> dict:
    attempts = state.get("attempts", 0) + 1
    llm = create_llm()

    if state.get("feedback"):
        prompt = (
            "Revise the answer using the evaluator feedback.\n"
            "Keep it practical, concise, and include concrete LangGraph concepts.\n\n"
            f"QUESTION:\n{state['question']}\n\n"
            f"PREVIOUS ANSWER:\n{state.get('answer', '')}\n\n"
            f"FEEDBACK:\n{state['feedback']}"
        )
    else:
        prompt = (
            "Answer the question in 4-6 sentences. Be practical and concrete. "
            "Mention relevant LangGraph concepts when useful.\n\n"
            f"QUESTION:\n{state['question']}"
        )

    answer = _text(llm.invoke([HumanMessage(content=prompt)]).content)
    return {
        "answer": answer,
        "attempts": attempts,
        "drafts": state.get("drafts", []) + [answer],
    }


def evaluate(state: State) -> dict:
    llm = create_llm().with_structured_output(EvalResult)
    result = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are an evaluator for production agent answers. "
                    "PASS only if the answer is accurate, concrete, actionable, "
                    "and directly answers the question. FAIL vague answers."
                )
            ),
            HumanMessage(
                content=(
                    f"QUESTION:\n{state['question']}\n\n"
                    f"ANSWER:\n{state.get('answer', '')}"
                )
            ),
        ]
    )
    return {
        "verdict": result.verdict,
        "score": result.score,
        "feedback": result.feedback,
    }


def route_after_eval(state: State) -> str:
    if state.get("verdict") == "PASS" or state.get("attempts", 0) >= MAX_ATTEMPTS:
        return "__end__"
    return "generate"


def build_graph():
    builder = StateGraph(State)
    builder.add_node("generate", generate)
    builder.add_node("evaluate", evaluate)

    builder.add_edge(START, "generate")
    builder.add_edge("generate", "evaluate")
    builder.add_conditional_edges(
        "evaluate",
        route_after_eval,
        {"generate": "generate", "__end__": END},
    )
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke({"question": "LangGraph 를 실무 관점에서 설명해줘"})
    print(out["verdict"], out["score"], "attempts=", out["attempts"])
    print(out["answer"])
