from __future__ import annotations

from typing import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from langchain_lecture.projects.project_01_hello_world.chain import summarize_person
from langchain_lecture.projects.project_01_hello_world.prompts import SAMPLE_INFORMATION


class HelloWorldState(TypedDict):
    information: NotRequired[str]
    answer: NotRequired[str]
    error: NotRequired[str]


def summarize_node(state: HelloWorldState) -> dict[str, str]:
    try:
        information = state.get("information") or SAMPLE_INFORMATION
        return {"answer": summarize_person(information), "error": ""}
    except Exception as exc:
        return {"error": f"{type(exc).__name__}: {exc}"}


builder = StateGraph(HelloWorldState)
builder.add_node("summarize", summarize_node)
builder.add_edge(START, "summarize")
builder.add_edge("summarize", END)

graph = builder.compile()

