"""
Example 25 — Approval system.

툴 실행/외부 변경/고위험 작업 전에 정책으로 위험도를 판정하고,
필요한 경우 human approval 을 받아 승인/수정/거절로 분기하는 패턴.

그래프 구조
-----------
START ─▶ classify_risk ─┬─▶ execute ─▶ END
                         └─▶ request_approval (interrupt) ─▶ execute ─▶ END

테스트 입력 예시 (interrupt 경로는 thread_id 필요)
-----------------------------------------------
▶ 자동 실행
   - {"action": "read customer profile"}
▶ 승인 필요
   - {"action": "delete production database backup"}
   - Command(resume="approve")
   - Command(resume={"action": "edit", "action_text": "archive production database backup"})
   - Command(resume="reject")
"""

from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt


class State(TypedDict, total=False):
    action: str
    risk: str
    approved: bool
    decision_reason: str
    execution_result: str


HIGH_RISK_TERMS = ("delete", "drop", "production", "payment", "email all", "refund")


def classify_risk(state: State) -> dict:
    action = state["action"].lower()
    risk = "high" if any(term in action for term in HIGH_RISK_TERMS) else "low"
    return {
        "risk": risk,
        "approved": risk == "low",
        "decision_reason": "auto-approved low-risk action" if risk == "low" else "human approval required",
    }


def route_after_risk(state: State) -> str:
    return "execute" if state.get("approved") else "request_approval"


def request_approval(state: State) -> dict:
    decision = interrupt(
        {
            "kind": "approval_request",
            "action": state.get("action", ""),
            "risk": state.get("risk", "unknown"),
            "options": ["approve", "reject", "edit"],
        }
    )

    if isinstance(decision, dict) and decision.get("action") == "edit":
        return {
            "action": decision.get("action_text", state.get("action", "")),
            "approved": True,
            "decision_reason": "human edited and approved action",
        }
    if decision == "approve":
        return {"approved": True, "decision_reason": "human approved action"}
    return {"approved": False, "decision_reason": "human rejected action"}


def execute(state: State) -> dict:
    if not state.get("approved"):
        return {"execution_result": f"BLOCKED: {state.get('action', '')}"}
    return {"execution_result": f"EXECUTED: {state.get('action', '')}"}


def build_graph():
    builder = StateGraph(State)
    builder.add_node("classify_risk", classify_risk)
    builder.add_node("request_approval", request_approval)
    builder.add_node("execute", execute)

    builder.add_edge(START, "classify_risk")
    builder.add_conditional_edges(
        "classify_risk",
        route_after_risk,
        {"request_approval": "request_approval", "execute": "execute"},
    )
    builder.add_edge("request_approval", "execute")
    builder.add_edge("execute", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import Command

    builder = StateGraph(State)
    builder.add_node("classify_risk", classify_risk)
    builder.add_node("request_approval", request_approval)
    builder.add_node("execute", execute)
    builder.add_edge(START, "classify_risk")
    builder.add_conditional_edges(
        "classify_risk",
        route_after_risk,
        {"request_approval": "request_approval", "execute": "execute"},
    )
    builder.add_edge("request_approval", "execute")
    builder.add_edge("execute", END)
    standalone = builder.compile(checkpointer=MemorySaver())

    cfg = {"configurable": {"thread_id": "approval-demo"}}
    print(standalone.invoke({"action": "delete production database backup"}, config=cfg))
    print(standalone.invoke(Command(resume="reject"), config=cfg))
