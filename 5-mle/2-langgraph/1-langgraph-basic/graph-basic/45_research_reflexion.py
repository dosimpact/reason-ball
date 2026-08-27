"""
Example 45 — Research Reflexion capstone.

초안을 만든 뒤 자기비평에서 검색 쿼리를 만들고, 근거를 수집해 인용이 있는
답변으로 수정하는 반복 패턴입니다. 단순 Reflection과 달리 비평이 외부 정보
수집 행동을 유도합니다.

선행 예제
---------
- 10_structured_output: Pydantic 구조화 출력
- 15_react_tool_loop: 판단과 도구 실행의 반복
- 36_reflection: 생성 → 비평 → 수정 loop
- 38_evaluator_loop: 품질 신호와 반복 상한

새 개념
-------
- 답변, 자기비평, 검색 쿼리를 하나의 구조화 결과로 생성
- 비평이 만든 쿼리로 근거를 수집한 뒤 인용을 포함해 수정
- `ready` 신호와 최대 반복 횟수를 함께 사용하는 Reflexion loop

그래프 구조
-----------
START ─▶ draft ─▶ research ─▶ revise ─┬─▶ END
                       ▲               └─▶ research
                       └─────────────────────┘
"""

from __future__ import annotations

import re
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm

MAX_ATTEMPTS = 3


class ReflectionNotes(BaseModel):
    missing: str = Field(description="Important information missing from the answer.")
    superfluous: str = Field(description="Content that should be removed or shortened.")


class DraftResult(BaseModel):
    answer: str = Field(description="A concise initial answer.")
    reflection: ReflectionNotes
    search_queries: list[str] = Field(
        description="One to three queries that can resolve weaknesses in the answer."
    )


class RevisionResult(DraftResult):
    citations: list[str] = Field(
        description="Evidence ids used by the revised answer, such as ref-1."
    )
    ready: bool = Field(description="True only when another research pass is unnecessary.")


class Evidence(TypedDict):
    id: str
    text: str


class State(TypedDict, total=False):
    question: str
    answer: str
    reflection: str
    search_queries: list[str]
    evidence: list[Evidence]
    citations: list[str]
    ready: bool
    attempts: int


CORPUS: list[Evidence] = [
    {
        "id": "ref-1",
        "text": "LangGraph checkpoints persist graph state per thread and enable resume, replay, and human review.",
    },
    {
        "id": "ref-2",
        "text": "A ReAct agent alternates model reasoning, tool calls, tool results, and another model decision.",
    },
    {
        "id": "ref-3",
        "text": "Retrieval-augmented generation grounds an answer in retrieved evidence and should expose citations.",
    },
    {
        "id": "ref-4",
        "text": "Reflexion uses explicit feedback from a prior attempt to guide research and the next revision.",
    },
]

STOPWORDS = {"a", "an", "and", "for", "in", "is", "of", "the", "to", "what"}


def _reflection_text(notes: ReflectionNotes) -> str:
    return f"Missing: {notes.missing}\nSuperfluous: {notes.superfluous}"


def _search(query: str) -> list[Evidence]:
    terms = {
        token
        for token in re.findall(r"[0-9a-zA-Z가-힣]+", query.lower())
        if len(token) >= 3 and token not in STOPWORDS
    }
    ranked = sorted(
        CORPUS,
        key=lambda item: sum(term in item["text"].lower() for term in terms),
        reverse=True,
    )
    return [
        item
        for item in ranked
        if any(term in item["text"].lower() for term in terms)
    ][:2]


def draft(state: State) -> dict:
    model = create_llm().with_structured_output(DraftResult)
    result = model.invoke(
        [
            SystemMessage(
                content=(
                    "Write a concise answer, criticize it severely, and propose 1-3 "
                    "research queries that would improve it."
                )
            ),
            HumanMessage(content=state["question"]),
        ]
    )
    return {
        "answer": result.answer,
        "reflection": _reflection_text(result.reflection),
        "search_queries": result.search_queries,
        "evidence": [],
        "citations": [],
        "ready": False,
        "attempts": 1,
    }


def research(state: State) -> dict:
    by_id = {item["id"]: item for item in state.get("evidence", [])}
    for query in state.get("search_queries", []):
        for item in _search(query):
            by_id[item["id"]] = item
    return {"evidence": list(by_id.values())}


def revise(state: State) -> dict:
    model = create_llm().with_structured_output(RevisionResult)
    evidence = "\n".join(
        f"[{item['id']}] {item['text']}" for item in state.get("evidence", [])
    ) or "(no matching evidence)"
    result = model.invoke(
        [
            SystemMessage(
                content=(
                    "Revise the answer using the critique and evidence. Cite evidence "
                    "ids in square brackets. Return ready=false and new search queries "
                    "when important gaps remain."
                )
            ),
            HumanMessage(
                content=(
                    f"QUESTION:\n{state['question']}\n\n"
                    f"CURRENT ANSWER:\n{state.get('answer', '')}\n\n"
                    f"SELF-CRITIQUE:\n{state.get('reflection', '')}\n\n"
                    f"EVIDENCE:\n{evidence}"
                )
            ),
        ]
    )
    return {
        "answer": result.answer,
        "reflection": _reflection_text(result.reflection),
        "search_queries": result.search_queries,
        "citations": result.citations,
        "ready": result.ready,
        "attempts": state.get("attempts", 1) + 1,
    }


def route_after_revision(state: State) -> str:
    if state.get("ready") or state.get("attempts", 0) >= MAX_ATTEMPTS:
        return "__end__"
    return "research"


def build_graph():
    builder = StateGraph(State)
    builder.add_node("draft", draft)
    builder.add_node("research", research)
    builder.add_node("revise", revise)

    builder.add_edge(START, "draft")
    builder.add_edge("draft", "research")
    builder.add_edge("research", "revise")
    builder.add_conditional_edges(
        "revise",
        route_after_revision,
        {"research": "research", "__end__": END},
    )
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    output = graph.invoke({"question": "LangGraph checkpoint는 왜 필요한가요?"})
    print(output["answer"])
    print("citations=", output.get("citations"), "attempts=", output["attempts"])
