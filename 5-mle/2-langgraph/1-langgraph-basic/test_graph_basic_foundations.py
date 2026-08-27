from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.errors import GraphRecursionError


ROOT = Path(__file__).parent


def load_module(filename: str):
    path = ROOT / "graph-basic" / filename
    spec = importlib.util.spec_from_file_location(f"foundation_{path.stem}", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ScriptedToolModel:
    """Tool binding과 정해진 AIMessage 응답만 제공하는 network-free fake."""

    def __init__(self, responses: list[AIMessage]) -> None:
        self.responses = list(responses)
        self.bound_tool_names: list[str] = []
        self.invocations: list[list[Any]] = []

    def bind_tools(self, tools):
        self.bound_tool_names = [tool.name for tool in tools]
        return self

    def invoke(self, messages):
        self.invocations.append(list(messages))
        return self.responses.pop(0)


def test_01_simple_graph_runs_nodes_in_order():
    module = load_module("01_simple_graph.py")

    output = module.graph.invoke({"text": "hello langgraph", "steps": []})

    assert output == {
        "text": "HELLO LANGGRAPH!",
        "steps": ["uppercase", "exclaim"],
    }


def test_02_partial_state_updates_preserve_existing_keys():
    module = load_module("02_state_updates.py")

    output = module.graph.invoke({"text": "  Hello LangGraph  "})

    assert output["text"] == "  Hello LangGraph  "
    assert output["normalized"] == "hello langgraph"
    assert output["length"] == 15


def test_03_reducer_accumulates_while_plain_keys_overwrite():
    module = load_module("03_reducers.py")

    output = module.graph.invoke({"text": "  hello  ", "steps": []})

    assert output["text"] == "hello!"
    assert output["status"] == "enriched"
    assert output["steps"] == ["clean", "enrich"]


def test_04_output_schema_hides_input_and_internal_state():
    module = load_module("04_state_schemas.py")

    output = module.graph.invoke({"text": "  langgraph learner  "})

    assert output == {"result": "Hello, Langgraph Learner!"}
    assert "text" not in output
    assert "normalized" not in output


@pytest.mark.parametrize(
    ("number", "category", "message"),
    [
        (12, "even", "12 is even"),
        (7, "odd", "7 is odd"),
    ],
)
def test_05_conditional_routing_selects_matching_branch(
    number: int,
    category: str,
    message: str,
):
    module = load_module("05_conditional_routing.py")

    output = module.graph.invoke({"number": number})

    assert output["category"] == category
    assert output["message"] == message


def test_06_cycle_accumulates_each_iteration_and_terminates():
    module = load_module("06_cycles_and_recursion.py")

    output = module.graph.invoke(
        {"remaining": 3, "visited": []},
        config={"recursion_limit": 10},
    )

    assert output["remaining"] == 0
    assert output["visited"] == [3, 2, 1]
    assert output["result"] == "visited=[3, 2, 1]"


def test_06_recursion_limit_stops_an_unfinished_cycle():
    module = load_module("06_cycles_and_recursion.py")

    with pytest.raises(GraphRecursionError):
        module.graph.invoke(
            {"remaining": 10, "visited": []},
            config={"recursion_limit": 2},
        )


@pytest.mark.parametrize(
    ("score", "destination", "message"),
    [
        (3, "positive", "score 3 is non-negative"),
        (-1, "negative", "score -1 is negative"),
    ],
)
def test_07_command_updates_state_and_routes(
    score: int,
    destination: str,
    message: str,
):
    module = load_module("07_command_routing.py")

    output = module.graph.invoke({"score": score})

    assert output["route"] == destination
    assert output["message"] == message


def test_12_tool_schema_and_direct_invocation():
    module = load_module("12_tool_schema.py")

    output = module.graph.invoke({"a": 12, "b": 7})

    assert output["result"] == 84
    assert output["tool_schema"]["required"] == ["a", "b"]
    assert output["tool_schema"]["properties"]["a"]["type"] == "integer"


def test_13_bind_tools_produces_a_tool_call_without_executing_it(monkeypatch):
    fake_model = ScriptedToolModel(
        [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "multiply",
                        "args": {"a": 12, "b": 7},
                        "id": "multiply-request",
                        "type": "tool_call",
                    }
                ],
            )
        ]
    )
    monkeypatch.setattr("common.llm.create_llm", lambda: fake_model)
    module = load_module("13_tool_calls.py")

    output = module.graph.invoke(
        {"messages": [HumanMessage(content="12와 7을 곱해줘.")]}
    )

    assert fake_model.bound_tool_names == ["multiply"]
    assert output["messages"][-1].tool_calls == [
        {
            "name": "multiply",
            "args": {"a": 12, "b": 7},
            "id": "multiply-request",
            "type": "tool_call",
        }
    ]
    assert not any(isinstance(message, ToolMessage) for message in output["messages"])


def test_14_tool_node_executes_the_prepared_call():
    module = load_module("14_tool_node.py")

    output = module.graph.invoke({"messages": [], "a": 12, "b": 7})

    assert isinstance(output["messages"][-1], ToolMessage)
    assert output["messages"][-1].name == "multiply"
    assert output["messages"][-1].tool_call_id == "multiply-demo-call"
    assert output["messages"][-1].content == "84"


def test_15_react_loop_executes_tool_then_returns_final_answer(monkeypatch):
    fake_model = ScriptedToolModel(
        [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "calculate",
                        "args": {"expression": "12 * 7"},
                        "id": "calculate-request",
                        "type": "tool_call",
                    }
                ],
            ),
            AIMessage(content="12 * 7은 84입니다."),
        ]
    )
    monkeypatch.setattr("common.llm.create_llm", lambda: fake_model)
    module = load_module("15_react_tool_loop.py")

    output = module.graph.invoke(
        {"messages": [HumanMessage(content="12 * 7을 계산해줘.")]}
    )

    assert "calculate" in fake_model.bound_tool_names
    assert len(fake_model.invocations) == 2
    assert any(
        isinstance(message, ToolMessage) and message.content == "84"
        for message in fake_model.invocations[1]
    )
    assert output["messages"][-1].content == "12 * 7은 84입니다."
