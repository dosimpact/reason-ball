"""
Example 02-05 — Pydantic structured output.

쉽게 이해하기
-------------
Structured output은 모델의 답을 정해 둔 항목으로 받는 방법이다.
예: 자유로운 문장 대신 코드의 Pydantic 모델에 맞는 결과를 받는다.
Pydantic은 항목과 타입을 검사하는 도구이며 with_structured_output()에 그 설계도를 준다.

새 개념
-------
- Pydantic model을 LLM의 출력 schema로 전달
- `Literal`, `Field` 제약이 JSON schema로 변환됨
- 검증된 Pydantic 객체를 직렬화해 state에 저장

그래프 구조
-----------
입력 문장의 감정을 모델로 분석하고, label·score·rationale을 갖춘 구조화 결과로 저장한다.

START ─▶ analyze ─▶ END

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "text": "오늘 날씨가 좋아서 기분이 최고야!"
}
```
관찰할 결과: sentiment의 label/score/rationale 필드를 확인합니다. 정확한 분류와 수치는 모델 결과에 따릅니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
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


def build_graph():
    builder = StateGraph(State)
    builder.add_node("analyze", analyze)
    builder.add_edge(START, "analyze")
    builder.add_edge("analyze", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    print(graph.invoke({"text": "오늘 날씨가 좋아서 기분이 최고야!"})["sentiment"])
