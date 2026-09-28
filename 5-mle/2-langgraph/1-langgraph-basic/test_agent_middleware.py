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


def test_todo_middleware_injects_tool_and_replaces_todo_state():
    events: list[str] = []
    graph = example.build_todo_graph(events)

    snapshots = list(
        graph.stream(
            {"messages": [{"role": "user", "content": "6 곱하기 7을 계산하고 결과를 보고해줘."}]},
            stream_mode="values",
        )
    )

    todo_snapshots = [state["todos"] for state in snapshots if state.get("todos")]
    assert [item["status"] for item in todo_snapshots[0]] == ["in_progress", "pending"]
    assert todo_snapshots[-1] == [
        {"content": "6 × 7 계산", "status": "completed"},
        {"content": "결과 보고", "status": "completed"},
    ]
    assert len(todo_snapshots[-1]) == 2
    assert events.count("before_agent") == events.count("after_agent") == 1
    assert events.count("before_model") == events.count("after_model") == 4
    assert events.count("wrap_tool_call:before:write_todos") == 2
    assert events.count("wrap_tool_call:before:multiply") == 1
    assert snapshots[-1]["messages"][-1].content == "계산 결과는 42입니다."


def test_todo_middleware_rejects_parallel_writes_in_one_model_turn():
    events: list[str] = []
    graph = example.build_todo_graph(events, duplicate_writes=True)

    result = graph.invoke({"messages": [{"role": "user", "content": "할 일 목록을 작성해줘."}]})

    errors = [
        message for message in result["messages"]
        if isinstance(message, ToolMessage) and message.status == "error"
    ]
    assert len(errors) == 2
    assert all(
        "never be called multiple times in parallel" in message.content
        for message in errors
    )
    assert result.get("todos") in (None, [])
    assert "wrap_tool_call:before:write_todos" not in events
    assert result["messages"][-1].content == "병렬 write_todos 호출이 거절되었습니다."
