"""Minimal LangGraph smoke test for the local ChatGPT OAuth proxy.

Start the proxy first:

    uv run python proxy-server/main.py --serve

Then run:

    OPENAI_BASE_URL=http://127.0.0.1:2890/v1 \
    OPENAI_API_KEY=chatgpt-oauth-placeholder \
    uv run python examples/langgraph.py
"""

import sys
from pathlib import Path
from typing import TypedDict

# This file is named langgraph.py, so Python would otherwise try to import this
# script instead of the installed langgraph package.
EXAMPLES_DIR = Path(__file__).resolve().parent
sys.path = [path for path in sys.path if Path(path or ".").resolve() != EXAMPLES_DIR]

from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    prompt: str
    answer: str


llm = ChatOpenAI(model="gpt-5.6-luna")


def ask_model(state: State) -> State:
    response = llm.invoke(state["prompt"])
    return {"prompt": state["prompt"], "answer": response.content}


def build_graph():
    graph = StateGraph(State)
    graph.add_node("ask_model", ask_model)
    graph.add_edge(START, "ask_model")
    graph.add_edge("ask_model", END)
    return graph.compile()


def main() -> None:
    app = build_graph()
    result = app.invoke({"prompt": "인사 오지게 한번 박아봐", "answer": ""})
    print(result["answer"])


if __name__ == "__main__":
    main()
