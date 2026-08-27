"""Example 25 — 정책 기반 Approval system.

선행 개념
---------
- Example 22의 dynamic interrupt와 Example 24의 tool approval 흐름

새 개념
-------
- 작업 위험도를 먼저 분류해 저위험 작업은 자동 승인
- 고위험 작업만 human approval로 보내는 policy gate
- 승인 / 거절 / 수정 후 승인이라는 세 가지 결정 처리

복습 개념
---------
- 조건부 edge, ``interrupt()``, ``Command(resume=...)``

Example 24가 모든 tool call을 동일하게 멈춘다면, 이 예제는 먼저 정책을 적용해
사람의 검토가 필요한 작업만 선택한다. 실제 서비스에서는 문자열 키워드 대신 권한,
리소스, 금액, 환경 등의 구조화된 정책 입력을 사용해야 한다.

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
        "decision_reason": "auto-approved low-risk action"
        if risk == "low"
        else "human approval required",
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
    from langgraph.checkpoint.memory import InMemorySaver
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
    standalone = builder.compile(checkpointer=InMemorySaver())

    cfg = {"configurable": {"thread_id": "approval-demo"}}
    print(
        standalone.invoke({"action": "delete production database backup"}, config=cfg)
    )
    print(standalone.invoke(Command(resume="reject"), config=cfg))
