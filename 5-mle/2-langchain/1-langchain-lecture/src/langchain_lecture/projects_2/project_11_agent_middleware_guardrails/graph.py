"""에이전트 호출 앞뒤에 미들웨어와 가드레일을 적용하는 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects_2.project_11_agent_middleware_guardrails.agent import (
    run_guarded_agent,
)


class GuardrailAgentState(TypedDict):
    question: NotRequired[str]
    approvals: NotRequired[dict[str, Any]]
    result: NotRequired[dict[str, Any]]
    answer: NotRequired[str]
    status: NotRequired[str]
    error: NotRequired[str]


DEFAULT_QUESTION = "내 이메일 test@example.com 로 계산 2 + 3 * 4 결과를 알려줘."


def guardrail_node(state: GuardrailAgentState) -> dict[str, Any]:
    try:
        result = run_guarded_agent(
            state.get("question") or DEFAULT_QUESTION,
            approvals=state.get("approvals"),
        )
        return {
            "result": result,
            "answer": result["answer"],
            "status": result["status"],
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(GuardrailAgentState)
builder.add_node("guardrail_agent", guardrail_node)
builder.add_edge(START, "guardrail_agent")
builder.add_edge("guardrail_agent", END)

graph = builder.compile()
