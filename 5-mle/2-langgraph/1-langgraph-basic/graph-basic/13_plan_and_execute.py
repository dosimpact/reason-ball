"""
Example 13 — Plan-and-Execute.

복잡한 작업을 LLM 으로 **단계 리스트(plan)** 를 만들고, 각 단계를 순서대로 실행하면서
plan 을 줄여나가는 패턴.


흐름
----
1. planner: task → list[str] (Pydantic 으로 강제)
2. executor: plan[0] 을 실행 → completed 에 추가, plan 에서 제거
3. plan 이 비면 finalize, 아니면 다시 executor

학습 포인트
-----------
- structured output 으로 plan 생성 (09 와 결합)
- state 의 list 를 노드에서 줄여 나가는 패턴 (queue-like)
- conditional edge 로 "남은 step 이 있는가?" 분기

Plan-and-Execute 패턴의 장점
- ReAct(매 step 마다 LLM 이 다음 행동을 즉흥적으로 결정) 보다 더 체계적이고 예측 가능

장점 (vs. ReAct 즉흥 판단)
-------------------------
1. 전체 그림 먼저 설계 → 단계 간 일관성/의존 관계 유지, 누락 감소
2. Planner(비싼 모델) / Executor(싼 모델) 분리로 비용·속도 최적화 가능
3. plan / completed 가 구조화된 state 로 남아 관찰·디버깅·재시작 용이
4. 종료 조건이 "plan 이 비었는가?" 로 결정적 → 무한 루프 위험 ↓
5. Pydantic 으로 step 개수 제약 → 토큰 폭발 방지
6. queue-like 구조라 replan 노드 추가로 동적 재계획 확장 쉬움

단점 / 안 맞는 경우
- 1~2 step 단순 작업엔 오버헤드 큼 (ReAct 가 더 가벼움)
- 초기 plan 품질에 결과가 종속됨 → 동적 환경엔 replan 필요

그래프 구조
-----------
START ─▶ planner ─▶ executor ─┬─▶ executor (loop)
                               └─▶ finalize ─▶ END

테스트 입력 예시 (state.task: str — 3~5 step 으로 분해 가능한 작업)
----------------------------------------------------------------
- {"task": "Plan a 1-day trip to Jeju Island for two adults."}
- {"task": "신입 개발자 온보딩 1주차 일정을 짜줘."}
- {"task": "Write a blog post about RAG: outline, draft, edit."}
- {"task": "주말에 친구 생일 파티를 준비하는 계획을 세워줘."}
- {"task": "회사 점심 회식 장소 선정부터 예약까지 절차를 정리해줘."}
- {"task": "Build a todo app: design, implement, test, deploy."}

확인 포인트
- out["plan"]: 빈 list 가 되어야 정상 종료 (모든 step 소진)
- out["completed"]: [{step, result}, ...] 형태로 누적
- out["answer"]: "Plan executed:\n1. ... → ..." 형태 최종 정리
- recursion_limit=20 권장 (planner+executor*5+finalize)
"""

from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from common.llm import create_llm


class Plan(BaseModel):
    """작업 분할 계획."""

    steps: list[str] = Field(
        description="3~5개의 짧은 실행 단계", min_length=1, max_length=6
    )


class State(TypedDict, total=False):
    task: str
    plan: list[str]
    completed: list[dict]
    answer: str


def _content(resp) -> str:
    c = resp.content
    if isinstance(c, list):
        return " ".join(b.get("text", "") for b in c if isinstance(b, dict))
    return str(c)


def planner(state: State) -> dict:
    llm = create_llm()
    plan: Plan = llm.with_structured_output(Plan).invoke(
        [
            SystemMessage(
                content="Break the user's task into 3-5 concrete, executable steps. "
                "Each step should be short and actionable."
            ),
            HumanMessage(content=state["task"]),
        ]
    )
    return {"plan": plan.steps, "completed": []}


def executor(state: State) -> dict:
    """plan 의 첫 단계를 실행 → plan 에서 제거, completed 에 추가."""
    plan = list(state.get("plan", []))
    if not plan:
        return {}
    step = plan.pop(0)

    llm = create_llm()
    resp = llm.invoke(
        [
            SystemMessage(
                content=f"You are executing one step of a larger plan.\n"
                f"Original task: {state['task']}\n"
                f"Already done: {state.get('completed', [])}\n"
                f"Reply with just the result of this single step (≤100 chars)."
            ),
            HumanMessage(content=f"Execute: {step}"),
        ]
    )
    completed = list(state.get("completed", []))
    completed.append({"step": step, "result": _content(resp).strip()})
    return {"plan": plan, "completed": completed}


def has_more_steps(state: State) -> str:
    return "executor" if state.get("plan") else "finalize"


def finalize(state: State) -> dict:
    summary_lines = [
        f"{i + 1}. {c['step']}\n   → {c['result']}"
        for i, c in enumerate(state.get("completed", []))
    ]
    return {"answer": "Plan executed:\n" + "\n".join(summary_lines)}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("planner", planner)
    builder.add_node("executor", executor)
    builder.add_node("finalize", finalize)

    builder.add_edge(START, "planner")
    builder.add_edge("planner", "executor")
    builder.add_conditional_edges(
        "executor", has_more_steps, {"executor": "executor", "finalize": "finalize"}
    )
    builder.add_edge("finalize", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    out = graph.invoke(
        {"task": "Plan a 1-day trip to Jeju Island for two adults."},
        config={"recursion_limit": 20},
    )
    print(out["answer"])
