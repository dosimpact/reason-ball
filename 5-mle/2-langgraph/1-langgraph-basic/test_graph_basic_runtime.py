"""17~28 runtime examples의 외부 API 없는 핵심 동작 검증."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType

from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command


ROOT = Path(__file__).parent
os.environ.setdefault("OPENAI_API_KEY", "test-key-for-offline-construction")

_MODULES: dict[str, ModuleType] = {}


def load_example(filename: str) -> ModuleType:
    """숫자로 시작하는 예제 파일을 일반 Python module처럼 안전하게 로딩한다."""
    if filename in _MODULES:
        return _MODULES[filename]

    path = ROOT / "graph-basic" / filename
    module_name = f"runtime_test_{path.stem}"
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None and spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    _MODULES[filename] = module
    return module


class ToolCallingFakeModel(FakeMessagesListChatModel):
    """정해진 tool call을 반환하면서 ``bind_tools``도 지원하는 fake model."""

    def bind_tools(self, tools, *, tool_choice=None, **kwargs):
        return self


def tool_calling_fake() -> ToolCallingFakeModel:
    return ToolCallingFakeModel(
        responses=[
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "calculate",
                        "args": {"expression": "2 + 2"},
                        "id": "call-1",
                        "type": "tool_call",
                    }
                ],
            ),
            AIMessage(content="finished"),
        ]
    )


def test_retry_is_repeatable_and_always_succeeds_on_third_attempt():
    module = load_example("19_retry_policy.py")

    for _ in range(3):
        output = module.graph.invoke({"target": "same-target"})
        assert output["attempts"] == 3
        assert output["result"] == "OK on attempt #3"


def test_checkpointer_accumulates_and_isolates_threads():
    module = load_example("20_checkpointer.py")
    graph = module.build_graph(checkpointer=InMemorySaver())
    thread_a = {"configurable": {"thread_id": "runtime-chat-a"}}
    thread_b = {"configurable": {"thread_id": "runtime-chat-b"}}

    graph.invoke({"messages": [HumanMessage(content="first")]}, config=thread_a)
    second = graph.invoke(
        {"messages": [HumanMessage(content="second")]}, config=thread_a
    )
    isolated = graph.invoke(
        {"messages": [HumanMessage(content="isolated")]}, config=thread_b
    )

    assert second["messages"][-1].content == "turn=2; latest=second"
    assert len(second["messages"]) == 4
    assert isolated["messages"][-1].content == "turn=1; latest=isolated"
    assert len(isolated["messages"]) == 2


def test_state_snapshots_update_history_and_replay():
    module = load_example("21_state_snapshots.py")
    graph = module.build_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "runtime-snapshot"}}

    first = graph.invoke({"value": 2, "trace": []}, config=config)
    assert first["value"] == 6
    assert graph.get_state(config).next == ()

    updated_config = graph.update_state(
        config,
        {"value": 10, "trace": ["manual:10"]},
        as_node="increment",
    )
    assert graph.get_state(updated_config).next == ("double",)
    assert graph.invoke(None, config=updated_config)["value"] == 20

    history = list(graph.get_state_history(config))
    original_increment = next(
        snapshot
        for snapshot in history
        if snapshot.values.get("value") == 3 and snapshot.next == ("double",)
    )
    replayed = graph.invoke(None, config=original_increment.config)
    assert replayed["value"] == 6
    assert replayed["trace"] == ["increment:3", "double:6"]


def test_dynamic_interrupt_resumes_with_command_value():
    module = load_example("22_dynamic_interrupt.py")
    graph = module.build_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "runtime-dynamic-interrupt"}}

    interrupted = graph.invoke({"topic": "LangGraph"}, config=config)
    assert interrupted["__interrupt__"][0].value["kind"] == "draft_review"

    completed = graph.invoke(Command(resume="approve"), config=config)
    assert completed["approved"] is True
    assert completed["final"] == "PUBLISHED: [Draft] An article about LangGraph."


def test_static_breakpoint_pauses_and_resumes_without_approval_value():
    module = load_example("23_static_breakpoint.py")
    graph = module.build_graph(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "runtime-static-breakpoint"}}

    paused = graph.invoke({"value": 21}, config=config)
    assert paused["prepared"] is True
    assert "result" not in paused
    assert graph.get_state(config).next == ("execute",)

    completed = graph.invoke(None, config=config)
    assert completed["result"] == 42


def test_tool_approval_supports_approve_and_reject_without_api_calls():
    module = load_example("24_tool_approval.py")

    approved_graph = module.build_graph(
        checkpointer=InMemorySaver(),
        llm=tool_calling_fake(),
    )
    approved_config = {"configurable": {"thread_id": "runtime-tool-approve"}}
    interrupted = approved_graph.invoke(
        {"messages": [HumanMessage(content="calculate")]},
        config=approved_config,
    )
    assert interrupted["__interrupt__"][0].value["kind"] == "tool_approval"
    approved = approved_graph.invoke(Command(resume="approve"), config=approved_config)
    approved_tool_messages = [
        message for message in approved["messages"] if isinstance(message, ToolMessage)
    ]
    assert approved_tool_messages[-1].content == "4"
    assert approved["messages"][-1].content == "finished"

    rejected_graph = module.build_graph(
        checkpointer=InMemorySaver(),
        llm=tool_calling_fake(),
    )
    rejected_config = {"configurable": {"thread_id": "runtime-tool-reject"}}
    rejected_graph.invoke(
        {"messages": [HumanMessage(content="calculate")]},
        config=rejected_config,
    )
    rejected = rejected_graph.invoke(
        Command(resume="reject"), config=rejected_config
    )
    rejected_tool_messages = [
        message for message in rejected["messages"] if isinstance(message, ToolMessage)
    ]
    assert "rejected" in rejected_tool_messages[-1].content
    assert rejected["messages"][-1].content == "finished"


def test_policy_approval_auto_executes_low_risk_and_interrupts_high_risk():
    module = load_example("25_approval_system.py")

    low_risk = module.graph.invoke({"action": "read customer profile"})
    assert low_risk["risk"] == "low"
    assert low_risk["approved"] is True
    assert low_risk["execution_result"] == "EXECUTED: read customer profile"

    builder = StateGraph(module.State)
    builder.add_node("classify_risk", module.classify_risk)
    builder.add_node("request_approval", module.request_approval)
    builder.add_node("execute", module.execute)
    builder.add_edge(START, "classify_risk")
    builder.add_conditional_edges(
        "classify_risk",
        module.route_after_risk,
        {"request_approval": "request_approval", "execute": "execute"},
    )
    builder.add_edge("request_approval", "execute")
    builder.add_edge("execute", END)
    high_risk_graph = builder.compile(checkpointer=InMemorySaver())
    config = {"configurable": {"thread_id": "runtime-policy-high-risk"}}

    interrupted = high_risk_graph.invoke(
        {"action": "delete production database backup"}, config=config
    )
    assert interrupted["risk"] == "high"
    assert interrupted["__interrupt__"][0].value["kind"] == "approval_request"

    approved = high_risk_graph.invoke(Command(resume="approve"), config=config)
    assert approved["approved"] is True
    assert approved["execution_result"].startswith("EXECUTED:")


def test_long_term_store_isolates_users():
    module = load_example("26_long_term_memory.py")
    graph = module.build_graph(store=InMemoryStore())
    user_1 = module.Context(user_id="runtime-user-1")
    user_2 = module.Context(user_id="runtime-user-2")

    graph.invoke({"fact": "favorite color is blue"}, context=user_1)
    graph.invoke({"fact": "lives in Seoul"}, context=user_1)

    recalled_1 = graph.invoke({"limit": 10}, context=user_1)
    recalled_2 = graph.invoke({"limit": 10}, context=user_2)
    assert recalled_1["recalled"] == ["favorite color is blue", "lives in Seoul"]
    assert recalled_2["recalled"] == []


def test_history_reducer_adds_two_entries_per_node():
    module = load_example("28_history_reducer.py")

    output = module.graph.invoke({"text": "  LangGraph   Makes State Explicit  "})

    assert output["result"] == "langgraph makes state explicit (30 chars)"
    assert len(output["history"]) == 4
    assert [
        (entry["node"], entry["event"]) for entry in output["history"]
    ] == [
        ("normalize", "start"),
        ("normalize", "end"),
        ("annotate", "start"),
        ("annotate", "end"),
    ]
