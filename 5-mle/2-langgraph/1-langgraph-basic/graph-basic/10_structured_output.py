"""
Example 10 — Pydantic structured output.

선행 예제
---------
- 08_llm_graph

새 개념
-------
- Pydantic model을 LLM의 출력 schema로 전달
- `Literal`, `Field` 제약이 JSON schema로 변환됨
- 검증된 Pydantic 객체를 직렬화해 state에 저장

복습 개념
---------
- `llm.invoke()`, 일반 custom state

그래프 구조
-----------
START ─▶ analyze ─▶ END
"""

from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


class Sentiment(BaseModel):
    """감정 분류 결과 schema."""

    label: Literal["positive", "negative", "neutral"] = Field(
        description="감정 라벨"
    )
    score: float = Field(description="확신도 0.0~1.0", ge=0.0, le=1.0)
    rationale: str = Field(description="판단 근거 한 문장")


class State(TypedDict, total=False):
    text: str
    sentiment: dict


def build_graph():
    structured_llm = create_llm().with_structured_output(Sentiment)

    def analyze(state: State) -> dict:
        result: Sentiment = structured_llm.invoke(
            [
                SystemMessage(
                    content="Classify the sentiment of Korean or English text."
                ),
                HumanMessage(content=state["text"]),
            ]
        )
        return {"sentiment": result.model_dump()}

    builder = StateGraph(State)
    builder.add_node("analyze", analyze)
    builder.add_edge(START, "analyze")
    builder.add_edge("analyze", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"text": "오늘 날씨가 좋아서 기분이 최고야!"})["sentiment"])
