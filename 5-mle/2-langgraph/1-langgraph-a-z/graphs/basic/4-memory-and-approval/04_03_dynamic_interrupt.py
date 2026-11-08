"""Example 04-03 — Dynamic interrupt와 ``Command(resume=...)``.

선행 개념
---------
- Checkpointer, ``thread_id``, state snapshot
- Example 07의 routing용 ``Command(update=..., goto=...)``

새 개념
-------
- 노드 내부의 ``interrupt(payload)``
- 같은 thread에서 ``Command(resume=value)``로 실행 재개
- resume 값이 멈췄던 ``interrupt()`` 호출의 반환값이 된다는 점

interrupt가 재개되면 해당 노드는 처음부터 다시 실행된다. 따라서 interrupt 앞에는
결제나 외부 쓰기 같은 비멱등 side effect를 두지 않는 것이 중요하다.

Example 07의 ``Command``는 노드가 update와 다음 경로를 반환할 때 사용하고, 여기의
``Command(resume=...)``는 클라이언트가 중단된 실행에 값을 전달할 때 사용한다.

흐름: ``generate -> human_review (interrupt) -> publish``

그래프 구조
-----------
주제로 초안을 만들고 사람의 승인·수정·거절을 기다린 뒤, 결정에 맞는 최종 문자열을 만든다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "topic": "LangGraph"
}
```
관찰할 결과: 생성한 draft에서 interrupt로 멈춥니다. approve 재개 시 final에 PUBLISHED가 포함됩니다.

실행 조건·방법:
Studio/API에서는 같은 thread를 사용합니다. Python 단독 실행은 main처럼 InMemorySaver를 주입하고 config={"configurable": {"thread_id": "input-demo"}}를 전달합니다.
from langgraph.types import Command
재개: invoke(Command(resume="approve"), config=config). 거절은 resume="reject", 수정 승인은 resume={"action": "edit", "text": "수정 초안"}입니다.
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt


class State(TypedDict, total=False):
    topic: str
    draft: str
    approved: bool
    final: str


def generate(state: State) -> dict:
    return {"draft": f"[Draft] An article about {state['topic']}."}


def human_review(state: State) -> dict:
    decision = interrupt(
        {
            "kind": "draft_review",
            "question": "Approve this draft?",
            "draft": state.get("draft", ""),
            "options": ["approve", "reject", "edit"],
        }
    )
    if isinstance(decision, dict) and decision.get("action") == "edit":
        return {
            "draft": decision.get("text", state.get("draft", "")),
            "approved": True,
        }
    return {"approved": decision == "approve"}


def publish(state: State) -> dict:
    if not state.get("approved"):
        return {"final": "(rejected)"}
    return {"final": f"PUBLISHED: {state.get('draft', '')}"}


def build_graph(*, checkpointer: BaseCheckpointSaver | None = None):
    builder = StateGraph(State)
    builder.add_node("generate", generate)
    builder.add_node("human_review", human_review)
    builder.add_node("publish", publish)
    builder.add_edge(START, "generate")
    builder.add_edge("generate", "human_review")
    builder.add_edge("human_review", "publish")
    builder.add_edge("publish", END)
    return builder.compile(checkpointer=checkpointer)


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.types import Command

    standalone = build_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "dynamic-interrupt-demo"}}

    interrupted = standalone.invoke({"topic": "LangGraph"}, config=config)
    print("interrupt:", interrupted["__interrupt__"][0].value)

    completed = standalone.invoke(Command(resume="approve"), config=config)
    print("completed:", completed["final"])
