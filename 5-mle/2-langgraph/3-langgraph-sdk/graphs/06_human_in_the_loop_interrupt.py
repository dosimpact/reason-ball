"""Example 06: human approval flow using interrupt() and Command(resume=...)."""

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from common.llm import create_llm


class ApprovalState(TypedDict, total=False):
    action: str
    proposed_action: str
    risk: str
    risk_summary: str
    approved: bool
    decision: str
    edited_action: str
    execution_result: str
    final: str
    approval_payload: dict[str, Any]


HIGH_RISK_TERMS = ("delete", "drop", "production", "payment", "email all", "refund")


def prepare_action(state: ApprovalState) -> dict:
    action = state.get("action", "delete production database backup after summarizing risk")
    lowered = action.lower()
    risk = "high" if any(term in lowered for term in HIGH_RISK_TERMS) else "low"
    return {
        "action": action,
        "proposed_action": action,
        "risk": risk,
        "approved": risk == "low",
    }


def summarize_risk(state: ApprovalState) -> dict:
    llm = create_llm()
    response = llm.invoke(
        [
            SystemMessage(
                content=(
                    "You are the Human-in-the-loop Interrupt UI example. "
                    "Summarize operational risk in one short sentence. Do not approve actions."
                )
            ),
            HumanMessage(
                content=(
                    f"Action: {state.get('proposed_action', '')}\n"
                    f"Risk level: {state.get('risk', 'unknown')}"
                )
            ),
        ]
    )
    summary = response.content if isinstance(response.content, str) else str(response.content)
    return {"risk_summary": summary}


def route_after_summary(state: ApprovalState) -> str:
    return "execute" if state.get("approved") else "request_approval"


def request_approval(state: ApprovalState) -> dict:
    payload = {
        "kind": "approval_request",
        "question": "Approve this high-risk action?",
        "action": state.get("proposed_action", ""),
        "risk": state.get("risk", "unknown"),
        "risk_summary": state.get("risk_summary", ""),
        "options": ["approve", "reject", "edit"],
    }
    decision = interrupt(payload)

    if isinstance(decision, dict) and decision.get("action") == "edit":
        edited = str(decision.get("action_text") or state.get("proposed_action", ""))
        return {
            "approval_payload": payload,
            "approved": True,
            "decision": "edited_approval",
            "edited_action": edited,
            "proposed_action": edited,
        }

    if decision == "approve" or (
        isinstance(decision, dict) and decision.get("action") == "approve"
    ):
        return {
            "approval_payload": payload,
            "approved": True,
            "decision": "approved",
        }

    return {
        "approval_payload": payload,
        "approved": False,
        "decision": "rejected",
    }


def execute(state: ApprovalState) -> dict:
    action = state.get("proposed_action", state.get("action", ""))
    if state.get("approved"):
        result = f"EXECUTED: {action}"
    else:
        result = f"BLOCKED: {action}"
    return {
        "execution_result": result,
        "final": f"{result} ({state.get('decision', 'auto_approved')})",
    }


def build_graph():
    builder = StateGraph(ApprovalState)
    builder.add_node("prepare_action", prepare_action)
    builder.add_node("summarize_risk", summarize_risk)
    builder.add_node("request_approval", request_approval)
    builder.add_node("execute", execute)

    builder.add_edge(START, "prepare_action")
    builder.add_edge("prepare_action", "summarize_risk")
    builder.add_conditional_edges(
        "summarize_risk",
        route_after_summary,
        {"request_approval": "request_approval", "execute": "execute"},
    )
    builder.add_edge("request_approval", "execute")
    builder.add_edge("execute", END)
    return builder.compile()


graph = build_graph()


if __name__ == "__main__":
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import Command

    demo_builder = StateGraph(ApprovalState)
    demo_builder.add_node("prepare_action", prepare_action)
    demo_builder.add_node("summarize_risk", summarize_risk)
    demo_builder.add_node("request_approval", request_approval)
    demo_builder.add_node("execute", execute)
    demo_builder.add_edge(START, "prepare_action")
    demo_builder.add_edge("prepare_action", "summarize_risk")
    demo_builder.add_conditional_edges(
        "summarize_risk",
        route_after_summary,
        {"request_approval": "request_approval", "execute": "execute"},
    )
    demo_builder.add_edge("request_approval", "execute")
    demo_builder.add_edge("execute", END)
    local = demo_builder.compile(checkpointer=MemorySaver())
    cfg = {"configurable": {"thread_id": "approval-demo"}}
    print(local.invoke({"action": "delete production database backup"}, config=cfg))
    print(local.invoke(Command(resume="reject"), config=cfg))
