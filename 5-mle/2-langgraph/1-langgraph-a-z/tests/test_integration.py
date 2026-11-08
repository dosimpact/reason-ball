"""Regression checks for cross-project imports and preserved graph contracts."""
import importlib
import json
from pathlib import Path

from langchain_core.language_models.fake_chat_models import FakeListChatModel
import pytest

import common.llm
from scripts.validate_integration import validate

ROOT = Path(__file__).resolve().parents[1]
ENTRIES = [
    (graph_id, entry)
    for config in sorted(ROOT.glob("*langgraph*.json"))
    for graph_id, entry in json.loads(config.read_text())["graphs"].items()
]


class ConstructionModel(FakeListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def test_ids_paths_and_copy_completeness():
    assert sum(validate().values()) == 154


@pytest.mark.parametrize("graph_id,entry", ENTRIES, ids=[item[0] for item in ENTRIES])
def test_all_collections_import_together(graph_id, entry, monkeypatch):
    monkeypatch.setattr(common.llm, "create_llm", lambda *a, **kw: ConstructionModel(responses=["unused"]))
    monkeypatch.setenv("DEEP_AGENTS_MODE", "scripted")
    module_name, export = entry.rsplit(":", 1)
    module = importlib.import_module(module_name)
    candidate = getattr(module, export)
    graph = candidate({}) if not hasattr(candidate, "invoke") else candidate
    assert callable(graph.invoke), graph_id
    from langgraph.checkpoint.base import BaseCheckpointSaver
    from langgraph.store.base import BaseStore
    assert not isinstance(graph.checkpointer, BaseCheckpointSaver), graph_id
    assert not isinstance(graph.store, BaseStore), graph_id
    assert ROOT in Path(module.__file__).resolve().parents


def test_advanced_tools_do_not_collide():
    modules = [importlib.import_module(f"graphs.advanced.{name}.tools") for name in
               ["01_semantic_cache", "06_postgres_checkpointer", "08_eval_harness", "09_observability"]]
    assert len({module.__file__ for module in modules}) == 4
    assert all(module.__name__.startswith("graphs.advanced.") for module in modules)


def test_pattern_model_alias_and_unsupported_provider(monkeypatch):
    from dataclasses import replace
    from common.patterns.config import load_config
    from common.patterns.models import get_chat_model
    config = replace(load_config(), model_provider="openai", openai_model="luna", openai_api_key="test")
    model = get_chat_model(config)
    assert model.model_name == common.llm.resolve_model("luna")
    assert model.temperature is None
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    assert common.llm.create_llm().temperature is None
    assert common.llm.create_llm(temperature=0.7).temperature == 0.7
    assert set(common.llm.MODEL_ALIASES) == {"luna", "terra"}
    terra = common.llm.create_llm("terra")
    assert terra.model_name == common.llm.resolve_model("terra")
    if terra.model_name == "gpt-6.1-terra":
        assert terra.use_responses_api is True
    effort_model = common.llm.create_llm("terra", reasoning_effort="high")
    assert effort_model.reasoning == {"effort": "high"}
    assert effort_model.use_responses_api is True
    with pytest.raises(ValueError, match="Unsupported MODEL_PROVIDER"):
        get_chat_model(replace(config, model_provider="unsupported"))


def test_advanced_middleware_async_execution_and_todo_failure():
    import asyncio
    module = importlib.import_module("graphs.advanced.12_agent_middleware.graph")
    async def scenario():
        events = []
        result = await module.build_graph(events).ainvoke({"messages": [{"role": "user", "content": "6*7"}]})
        assert result["messages"][-1].content == "계산 결과는 42입니다."
        assert events.count("wrap_model_call:before") == 2
        assert "wrap_tool_call:after:multiply" in events
        todos = await module.build_todo_graph().ainvoke({"messages": [{"role": "user", "content": "6*7"}]})
        assert all(item["status"] == "completed" for item in todos["todos"])
        failed = await module.build_todo_graph(duplicate_writes=True).ainvoke({"messages": [{"role": "user", "content": "todo"}]})
        assert "거절" in failed["messages"][-1].content
    asyncio.run(scenario())


def test_advanced_summarization_async_and_platform_persistence_boundary():
    import asyncio
    module = importlib.import_module("graphs.advanced.13_summarization_middleware.graph")
    assert module.graph.checkpointer is None
    async def scenario():
        summary = module.DemoSummaryModel()
        graph = module.build_graph(summary_model=summary)
        config = {"configurable": {"thread_id": "async-summary"}}
        for question in module.DEMO_TURNS:
            result = await graph.ainvoke({"messages": [{"role": "user", "content": question}]}, config=config)
        assert len(summary.prompts) == 1
        assert len(result["messages"]) == 4
    asyncio.run(scenario())
