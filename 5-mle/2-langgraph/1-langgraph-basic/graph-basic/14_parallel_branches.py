"""
Example 14 — Static parallel branches.

08 의 `Send` 는 **런타임에 결정되는** 동적 fan-out 이지만, 여기서는
**컴파일 타임에 정해진** N 개의 가지를 동시에 실행하는 패턴입니다.

같은 입력을 3개의 노드(요약/태그/감정) 에 동시에 보내고, join 노드에서 결합합니다.

학습 포인트
-----------
- `add_edge(START, "node_a")`, `add_edge(START, "node_b")` 처럼 같은 source 에서 여러 노드로
  엣지를 만들면 **병렬 실행** (LangGraph 가 자동으로 스케줄링)
- 병렬 노드들이 같은 state 키를 동시에 쓸 때는 reducer 필요 (`Annotated[list, operator.add]`)

그래프 구조
-----------
            ┌─▶ summarize ─┐
START ──────┼─▶ tagger ────┼─▶ join ─▶ END
            └─▶ sentiment ─┘

테스트 입력 예시 (state.text: str — 3개 노드가 동시에 분석)
--------------------------------------------------------
sentiment 노드는 키워드 매칭이라 "good/great/love/amazing/best/happy/좋"
또는 "bad/hate/worst/sad/angry/싫" 가 있으면 라벨이 갈립니다.

▶ positive
   - {"text": "LangGraph is amazing for building stateful LLM apps. I love it!"}
   - {"text": "오늘 하루 정말 좋았어. 친구들이랑 맛있는 거 먹고 행복했다."}

▶ negative
   - {"text": "This service is the worst. I hate the slow response times."}
   - {"text": "회의가 너무 길고 지루해서 싫었다."}

▶ neutral (감정 단어 없음)
   - {"text": "FastAPI is a Python web framework based on type hints."}
   - {"text": "오늘은 회의가 세 개 있었다."}

▶ summarize 동작 확인 (60자 초과)
   - {"text": "LangGraph extends LangChain with cyclic graph support, "
              "enabling stateful multi-actor applications using LLMs and tools."}
"""

import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

# 일부러 LLM 을 쓰지 않고 결정론적 함수로 구현 — 병렬 흐름 자체에 집중
# (실무에서는 각 노드가 LLM 호출이어도 동일한 패턴)


class State(TypedDict, total=False):
    text: str
    # 3개의 병렬 노드가 동시에 append 하므로 reducer 필요
    artifacts: Annotated[list[dict], operator.add]
    report: str


def summarize(state: State) -> dict:
    text = state["text"]
    summary = text if len(text) <= 60 else text[:57] + "..."
    return {"artifacts": [{"kind": "summary", "value": summary}]}


def tagger(state: State) -> dict:
    words = [w.strip(",.!?").lower() for w in state["text"].split()]
    tags = sorted({w for w in words if len(w) >= 4})[:5]
    return {"artifacts": [{"kind": "tags", "value": tags}]}


def sentiment(state: State) -> dict:
    text = state["text"].lower()
    positive_words = {"good", "great", "love", "amazing", "best", "happy", "좋"}
    negative_words = {"bad", "hate", "worst", "sad", "angry", "싫"}
    score = sum(w in text for w in positive_words) - sum(
        w in text for w in negative_words
    )
    label = "positive" if score > 0 else "negative" if score < 0 else "neutral"
    return {"artifacts": [{"kind": "sentiment", "value": label}]}


def join(state: State) -> dict:
    parts = []
    for a in state.get("artifacts", []):
        parts.append(f"- {a['kind']}: {a['value']}")
    return {"report": "\n".join(parts)}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("summarize", summarize)
    builder.add_node("tagger", tagger)
    builder.add_node("sentiment", sentiment)
    builder.add_node("join", join)

    # START 에서 3개 가지로 동시 출발
    builder.add_edge(START, "summarize")
    builder.add_edge(START, "tagger")
    builder.add_edge(START, "sentiment")
    # 모두 join 에서 합류 (LangGraph 가 3 가지가 모두 끝날 때까지 대기)
    builder.add_edge("summarize", "join")
    builder.add_edge("tagger", "join")
    builder.add_edge("sentiment", "join")
    builder.add_edge("join", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {"text": "LangGraph is amazing for building stateful LLM apps. I love it!"}
    )
    print(out["report"])
