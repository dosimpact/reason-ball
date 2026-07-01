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


builder = StateGraph(CodeInterpreterState)
builder.add_node("run_code_interpreter", run_code_interpreter_node)
builder.add_edge(START, "run_code_interpreter")
builder.add_edge("run_code_interpreter", END)

graph = builder.compile()

