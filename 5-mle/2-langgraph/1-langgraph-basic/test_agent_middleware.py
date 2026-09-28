"""The public create_agent loop should invoke each middleware boundary."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from langchain_core.messages import AIMessage, ToolMessage


GRAPH_PATH = Path(__file__).parent / "graph-advanced/12_agent_middleware/graph.py"
spec = importlib.util.spec_from_file_location("agent_middleware_example", GRAPH_PATH)
assert spec is not None and spec.loader is not None
example = importlib.util.module_from_spec(spec)
spec.loader.exec_module(example)


def test_agent_model_and_tool_hooks_follow_the_agent_loop():
    events: list[str] = []
    graph = example.build_graph(events)

    result = graph.invoke({"messages": [{"role": "user", "content": "6 곱하기 7은?"}]})

    assert events == [
        "before_agent",
        "before_model",
        "wrap_model_call:before",
        "wrap_model_call:after",
        "after_model",
        "wrap_tool_call:before:multiply",
        "wrap_tool_call:after:multiply",
        "before_model",
        "wrap_model_call:before",
        "wrap_model_call:after",
        "after_model",
        "after_agent",
    ]
    tool_outputs = [
        message.content
        for message in result["messages"]
        if isinstance(message, ToolMessage)
    ]
    assert tool_outputs == ["42"]
    assert isinstance(result["messages"][-1], AIMessage)
    assert result["messages"][-1].content == "계산 결과는 42입니다."
