"""
Example 09 — Structured output (Pydantic).

LLM 의 자유 텍스트 응답이 아니라 **Pydantic 스키마에 맞춰 강제 변환**된 객체로 받는 패턴.
LangChain 의 `llm.with_structured_output(Schema)` 를 사용합니다.

학습 포인트
-----------
- 자유 텍스트 → 파싱 코드 작성이 필요 없어짐
- Bedrock + Anthropic 의 tool-use 메커니즘으로 내부 동작 (보장된 JSON)
- 후속 노드에서 `state["sentiment"]["label"]` 처럼 dict 접근

그래프 구조
-----------
START ─▶ analyze ─▶ END

테스트 입력 예시 (state.text: str → Sentiment{label, score, rationale})
---------------------------------------------------------------------
▶ positive
   - {"text": "오늘 날씨가 너무 좋아서 기분이 최고야!"}
   - {"text": "I absolutely love this product, it changed my life."}

▶ negative
   - {"text": "서비스가 너무 느리고 불친절해서 화가 났어."}
   - {"text": "This is the worst experience I've ever had."}

▶ neutral
   - {"text": "오늘은 회의가 3개 잡혀 있다."}
   - {"text": "The meeting is scheduled for 3 PM."}

▶ 혼재 (모델 판단 보기)
   - {"text": "음식은 맛있었지만 너무 비쌌어."}
"""

from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


class Sentiment(BaseModel):
    """감정 분류 결과."""

    label: Literal["positive", "negative", "neutral"] = Field(description="감정 라벨")
    score: float = Field(description="확신도 0.0 ~ 1.0", ge=0.0, le=1.0)
    rationale: str = Field(description="판단 근거 한 문장")


class State(TypedDict, total=False):
    text: str
    sentiment: dict  # Pydantic 모델은 직렬화 위해 dict 로 보관


def build_graph():
    llm = create_llm()
    structured_llm = llm.with_structured_output(Sentiment)

    def analyze(state: State) -> dict:
        result: Sentiment = structured_llm.invoke(
            [
                SystemMessage(
                    content="You classify the sentiment of a Korean or English text."
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
    out = graph.invoke({"text": "오늘 날씨가 너무 좋아서 기분이 최고야!"})
    print(out["sentiment"])
