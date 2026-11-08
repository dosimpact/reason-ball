"""DA-02/03: 실제 harness의 상태와 부수 효과를 검증한다."""

import json

import pytest
from deepagents.backends import StoreBackend
from langchain_core.messages import ToolMessage
from langgraph.errors import GraphRecursionError
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command

from common.deep_agents.model import ScriptedModel, call


def inputs(module):
    if hasattr(module, "sample_input"):
        return module.sample_input()
    return {"messages": [("user", module.PROMPT)]}


def tool_results(result):
    return [m for m in result["messages"] if isinstance(m, ToolMessage)]


def file_text(result, path):
    return result["files"][path]["content"]


@pytest.mark.parametrize("number", range(1, 19))
def test_every_independent_graph_executes(example, number):
    module = example(number)
    config = {"recursion_limit": 60}
    if number in (6, 14):
        config["configurable"] = {"thread_id": f"smoke-{number}"}
    result = module.graph.invoke(inputs(module), config=config)
    assert result["messages"]
    if number == 14:
        assert result["__interrupt__"]
    else:
        errors = [m for m in tool_results(result) if m.status == "error"]
        if number == 16:
            assert len(errors) == 1
            assert "limit exceeded" in errors[0].content.lower()
        else:
            assert not errors
        assert result["messages"][-1].type == "ai"


def test_default_harness_exposes_file_and_delegation_tools(example):
    module = example(2)
    model = ScriptedModel()
    module.build_graph(model=model).invoke(inputs(module))
    assert {"ls", "read_file", "write_file", "task"} <= set(model.bound_tools)
    assert "write_todos" not in model.bound_tools  # 0.7: opt in


def test_plan_updates_and_artifact_agree(example):
    module = example(3)
    updates = list(module.build_graph().stream(inputs(module), stream_mode="values"))
    statuses = [r["todos"][0]["status"] for r in updates if r.get("todos")]
    assert "in_progress" in statuses
    assert statuses[-1] == "completed"
    assert file_text(updates[-1], "/answer.txt") == "42"


def test_file_edit_and_missing_file_error(example):
    module = example(4)
    result = module.build_graph().invoke(inputs(module))
    assert file_text(result, "/note.txt") == "final"
    model = ScriptedModel(steps=[[call("read_file", file_path="/missing.txt")]])
    missing = module.build_graph(model=model).invoke(inputs(module))
    assert "not found" in str(tool_results(missing)[0].content).lower()


def test_filesystem_backend_writes_under_selected_root(example, tmp_path):
    module = example(5)
    result = module.build_graph(root=tmp_path).invoke(inputs(module))
    assert (tmp_path / "note.txt").read_text() == "disk-demo"
    assert "/note.txt" not in result.get("files", {})


def test_store_shared_across_threads_but_namespace_isolated(example):
    module = example(6)
    store = InMemoryStore()
    backend = StoreBackend(store=store, namespace=lambda _: ("alice", "files"))
    backend.write("/profile.txt", "alice-only")
    graph = module.build_graph(store=store, namespace="alice")
    for thread in ("first", "second"):
        result = graph.invoke(inputs(module), {"configurable": {"thread_id": thread}})
        assert "alice-only" in tool_results(result)[-1].content
    other = module.build_graph(store=store, namespace="bob")
    result = other.invoke(inputs(module), {"configurable": {"thread_id": "third"}})
    assert "alice-only" not in str(tool_results(result)[-1].content)
    assert "not found" in str(tool_results(result)[-1].content).lower()


def test_composite_routes_state_and_store_separately(example):
    module = example(7)
    store = InMemoryStore()
    result = module.build_graph(store=store).invoke(inputs(module))
    assert set(result["files"]) == {"/scratch.txt"}
    backend = StoreBackend(store=store, namespace=lambda _: ("learner", "memory"))
    assert "Korean" in backend.read("/preference.txt").file_data["content"]


def test_memory_loaded_before_first_model_call(example):
    module = example(8)
    model = ScriptedModel()
    module.build_graph(model=model).invoke(inputs(module))
    assert "MEMORY_KO" in str(model.seen[0][0].content)


def test_skill_description_then_full_body(example):
    module = example(9)
    model = ScriptedModel(steps=[[call("read_file", file_path=module.SKILL_PATH)]])
    module.build_graph(model=model).invoke(inputs(module))
    first_context = str(model.seen[0])
    assert "report" in first_context
    assert "REPORT_SKILL_APPLIED" not in first_context
    assert "REPORT_SKILL_APPLIED" in str(model.seen[1])


def test_offloading_preserves_original_json_and_readback(example):
    module = example(10)
    result = module.build_graph().invoke(inputs(module))
    path = "/large_tool_results/call-0-0"
    records = json.loads(file_text(result, path))
    assert len(records) == 200
    assert records[199]["amount"] == 597
    messages = tool_results(result)
    assert path in messages[0].content
    assert len(messages[0].content) < len(module.load_records.invoke({}))
    assert any(m.name == "read_file" and '"id": 0' in m.content for m in messages)


def test_summary_compresses_model_context_and_archives_history(example):
    module = example(11)
    model = ScriptedModel()
    summary = ScriptedModel(answer="SUMMARY_SENTINEL: A/B comparison")
    original = inputs(module)
    result = module.build_graph(model=model, summary_model=summary).invoke(original)
    assert len(summary.seen) == 1
    assert len(model.seen[0]) < len(original["messages"])
    assert "SUMMARY_SENTINEL" in str(model.seen[0])
    archives = [k for k in result["files"] if k.startswith("/conversation_history/")]
    assert len(archives) == 1
    assert "A/B" in file_text(result, archives[0])


def test_subagent_calls_its_own_tool(example):
    module = example(12)
    child = ScriptedModel(steps=[[call("lookup_sample")]], answer="child-result")
    result = module.build_graph(child_model=child).invoke(inputs(module))
    assert "fixture://comparison" in str(child.seen[-1])
    assert "child-result" in tool_results(result)[0].content


def test_parallel_tasks_have_isolated_message_context(example):
    module = example(13)
    researcher, reviewer = (
        ScriptedModel(answer="research-done"),
        ScriptedModel(answer="review-done"),
    )
    graph = module.build_graph(researcher=researcher, reviewer=reviewer)
    result = graph.invoke(inputs(module), {"max_concurrency": 2})
    assert len(tool_results(result)) == 2
    assert {m.content for m in tool_results(result)} == {"research-done", "review-done"}
    assert "PARENT_ONLY_MARKER" not in str(researcher.seen)
    assert "PARENT_ONLY_MARKER" not in str(reviewer.seen)
    assert "review-done" not in str(researcher.seen)


@pytest.mark.parametrize(
    "decision, expected", [("approve", "draft"), ("edit", "reviewed"), ("reject", None)]
)
def test_approval_pause_then_all_decision_paths(example, decision, expected):
    module = example(14)
    graph = module.build_graph()
    config = {"configurable": {"thread_id": decision}}
    paused = graph.invoke(inputs(module), config)
    assert "__interrupt__" in paused
    assert "/approved.txt" not in paused.get("files", {})
    result = graph.invoke(Command(resume={"decisions": [module.resume_decision(decision)]}), config)
    assert "__interrupt__" not in result
    if expected is None:
        assert "/approved.txt" not in result.get("files", {})
    else:
        assert file_text(result, "/approved.txt") == expected


def test_only_selected_business_tool_is_exposed(example):
    module = example(15)
    model = ScriptedModel()
    module.build_graph(model=model).invoke(inputs(module))
    assert [t for t in model.bound_tools if t.startswith("metric_")] == ["metric_17"]
    assert "read_file" in model.bound_tools


def test_retry_inside_call_limit_does_not_duplicate_limited_call(example):
    module = example(16)
    attempts = []
    result = module.build_graph(attempts=attempts).invoke(inputs(module))
    assert len(attempts) == 2  # first failure + one retry; second model call blocked
    assert "verified-value=42" in tool_results(result)[0].content
    assert tool_results(result)[1].status == "error"


def test_recursion_limit_stops_run(example):
    module = example(4)
    with pytest.raises(GraphRecursionError):
        module.build_graph().invoke(inputs(module), {"recursion_limit": 1})


def test_stream_contains_parent_child_and_message_projections(example):
    module = example(17)
    events = list(
        module.build_graph().stream(
            inputs(module),
            stream_mode=["messages", "updates"],
            subgraphs=True,
        )
    )
    assert any(namespace for namespace, _, _ in events)
    assert any(not namespace for namespace, _, _ in events)
    assert {mode for _, mode, _ in events} == {"messages", "updates"}


def test_research_workflow_has_plan_source_and_report(example):
    module = example(18)
    result = module.build_graph().invoke(inputs(module))
    assert result["todos"][0]["status"] == "completed"
    report = file_text(result, "/report.md")
    assert "fixture://research" in report
    assert "차이=10" in report
    assert "fixture://research" in tool_results(result)[1].content


@pytest.mark.parametrize("number", range(1, 19))
def test_async_runtime_path(example, number):
    import asyncio

    module = example(number)
    config = {"recursion_limit": 60}
    if number in (6, 14):
        config["configurable"] = {"thread_id": f"async-{number}"}
    result = asyncio.run(module.graph.ainvoke(inputs(module), config=config))
    assert result["messages"]
    if number == 14:
        assert result["__interrupt__"]
    else:
        errors = [m for m in tool_results(result) if m.status == "error"]
        assert len(errors) == (1 if number == 16 else 0)
        assert result["messages"][-1].type == "ai"


def test_live_mode_requires_explicit_credential(monkeypatch):
    from common.deep_agents.model import create_model

    monkeypatch.setenv("DEEP_AGENTS_MODE", "live")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        create_model()


def test_live_mode_constructs_provider_model_without_request(monkeypatch):
    from langchain_openai import ChatOpenAI

    from common.deep_agents.model import create_model

    monkeypatch.setenv("DEEP_AGENTS_MODE", "live")
    monkeypatch.setenv("OPENAI_API_KEY", "test-placeholder-not-a-real-key")
    from common.llm import resolve_model

    monkeypatch.setattr("common.llm.DEFAULT_MODEL", "luna")
    model = create_model()
    assert isinstance(model, ChatOpenAI)
    assert model.model_name == resolve_model("luna")
    assert model.model_name != "luna"
    assert model.request_timeout == 60
    assert model.max_retries == 1
