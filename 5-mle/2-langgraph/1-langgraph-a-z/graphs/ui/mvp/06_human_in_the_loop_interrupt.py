"""Example 06: human approval flow using interrupt() and Command(resume=...).

쉽게 이해하기
-------------
Interrupt는 실행을 멈춰 사람의 결정을 기다리는 지점이다.
예: 작업 내용을 검토하고 승인하거나 수정한다.
Command(resume=...)로 재개하며 이 예제의 execute는 결과 문자열을 만드는 데모다.

그래프 구조
-----------
요청 작업의 위험을 요약해 사람의 승인을 기다리고, 결정에 따른 모의 실행 결과 문자열을 만든다.

테스트 입력 예시
----------------
입력(JSON):
```json
{
  "action": "delete production database backup"
}
```
관찰할 결과: 위험 요약 후 승인 interrupt를 확인합니다. reject로 재개하면 실행 취소 결과를 관찰합니다.

실행 조건·방법:
실제 모델 호출에는 루트 .env의 provider/API 키가 필요하며 응답 문구는 실행마다 달라집니다.
실제 데이터베이스 삭제가 아니라 실행 결과 문자열을 만드는 예제입니다. 서버 thread 또는 main의 MemorySaver 구성에서 Command(resume="reject")를 전달합니다.

UI 협력 실습
-------------
승인 값은 같은 thread의 command.resume으로 전달됩니다. 승인 대기 중 새로고침하면 저장된 thread ID로 서버 상태를 다시 조회합니다. 승인·수정·거절과 복구를 각각 관찰하세요.
전체 실습: docs/stock/ui-learning-system.md (프로젝트 루트 기준).
"""
# 예제 개요: 위험도에 따라 사람의 승인이나 수정을 기다리는 interrupt 예제입니다.
# 핵심 흐름: Command(resume=...)로 결정을 전달하며, execute는 실제 작업 대신 결과 문자열만 만듭니다.

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from common.llm import create_llm


# 상태 및 UI 데이터 계약: 아래 타입들은 노드 사이에 전달하거나 화면에 표시할 데이터 구조입니다.
# ApprovalState는 입력, 중간 결과, 최종 결과를 공유하는 그래프 상태입니다.
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


# 요청의 위험 키워드를 확인하고 자동 승인 여부를 정합니다.
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


# 모델로 위험 요약만 생성하고 승인 결정은 별도로 유지합니다.
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


# 분기 판단: 현재 상태를 읽어 다음에 실행할 노드의 경로 이름을 반환합니다.
def route_after_summary(state: ApprovalState) -> str:
    return "execute" if state.get("approved") else "request_approval"


# 승인 요청으로 실행을 중단하고, 재개할 때 받은 승인·거절·수정 값을 상태에 반영합니다.
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


# 승인 여부에 따라 실행 또는 차단 결과 문자열을 만듭니다. 실제 외부 작업은 수행하지 않습니다.
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


# 그래프 구성: 노드를 등록한 뒤 START/END 연결과 조건부 경로를 정의하고 실행 가능한 그래프로 컴파일합니다.
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


# 서버 진입점: langgraph.json이 이 graph 객체를 가져와 SDK 실행 요청에 사용합니다.
graph = build_graph()


# 단독 실행 데모: 이 파일을 직접 실행할 때만 샘플 입력으로 그래프를 호출합니다.
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
