"""Python 실행 도구와 CSV 분석 도구를 라우팅하는 코드 인터프리터 예제입니다. LangGraph 노드와 상태 전이를 정의해 예제를 그래프로 노출합니다."""

from __future__ import annotations

from typing import Any, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects.project_05_code_interpreter.agent import build_router_agent


class CodeInterpreterState(TypedDict):
    question: NotRequired[str]
    result: NotRequired[dict[str, Any]]
    answer: NotRequired[str]
    error: NotRequired[str]


DEFAULT_QUESTION = "Use Python to compute 15 * 17 and report the result."


def run_code_interpreter_node(state: CodeInterpreterState) -> dict[str, Any]:
    try:
        agent = build_router_agent()
        result = agent.invoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": state.get("question") or DEFAULT_QUESTION,
                    }
                ]
            }
        )
        return {
            "result": result,
            "answer": str(result["messages"][-1].content),
            "error": "",
        }
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


# 노드 하나를 중심으로 START에서 END까지 이어지는 LangGraph 흐름입니다.
builder = StateGraph(CodeInterpreterState)
builder.add_node("run_code_interpreter", run_code_interpreter_node)
builder.add_edge(START, "run_code_interpreter")
builder.add_edge("run_code_interpreter", END)

graph = builder.compile()

