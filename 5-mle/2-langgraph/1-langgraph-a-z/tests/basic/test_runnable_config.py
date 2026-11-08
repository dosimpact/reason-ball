"""04-2: 광고 분석의 작업 상태, 비즈니스 context, 실행 config와 Runtime 기능."""

from __future__ import annotations

import asyncio
import importlib
from copy import deepcopy
from dataclasses import asdict, replace

import pytest
from langchain_core.callbacks import BaseCallbackHandler
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.store.memory import InMemoryStore

module = importlib.import_module("graphs.basic.2-llm-base.02_02_runnable_config")


def test_state_changes_but_context_and_user_configuration_stay_separate():
    context = deepcopy(module.DEMO_CONTEXT)
    config = deepcopy(module.DEMO_CONFIG)
    original_context, original_config = deepcopy(context), deepcopy(config)
    result = module.graph.invoke(module.sample_input(), context=context, config=config)

    assert result["analysis_result"] == {
        "source": "local-fixture",
        "currency": "KRW",
        "campaign_count": 2,
        "spend": 300000,
        "revenue": 500000,
        "ctr_percent": 3.0,
        "roas": 1.67,
        "target_roas": 2.0,
        "meets_target": False,
    }
    assert result["current_step"] == "completed"
    assert result["messages"][0].type == "human"
    assert result["messages"][-1].type == "ai"
    assert "300,000원" in result["messages"][-1].content
    observations = result["observations"]
    assert [o["node"] for o in observations] == ["fetch_campaigns", "analyze", "summarize"]
    assert [o["state"]["current_step"] for o in observations] == [
        "fetching_campaigns",
        "analyzing",
        "summarizing",
    ]
    assert observations[0]["state"]["analysis_result"] is None
    assert observations[-1]["state"]["analysis_result"] == result["analysis_result"]
    for observed in observations:
        assert observed["context"] == asdict(context)
        assert observed["config"]["configurable"] == {"thread_id": "thread_789"}
        assert observed["config"]["metadata"] == {"request_id": "req_123"}
        assert observed["config"]["recursion_limit"] == 30
        assert observed["config"]["max_concurrency"] == 5
        assert observed["config"]["tags"] == ["advertiser-agent", "production"]
        assert not observed["runtime"]["store_available"]
    assert context == original_context
    assert config == original_config
    assert "advertiser_id" not in result  # 비즈니스 식별자는 context에 둔다.


def test_store_supplies_advertiser_setting_and_saves_request_scoped_analysis():
    store = InMemoryStore()
    store.put(("advertisers", "adv_456"), "settings", {"target_roas": 1.5})
    graph = module.build_graph(store=store)
    result = graph.invoke(
        module.sample_input(), context=module.DEMO_CONTEXT, config=module.DEMO_CONFIG
    )
    assert result["analysis_result"]["target_roas"] == 1.5
    assert result["analysis_result"]["meets_target"]
    assert (
        store.get(("advertisers", "adv_456", "analyses"), "req_123").value
        == result["analysis_result"]
    )
    assert store.get(("advertisers", "other-advertiser", "analyses"), "req_123") is None
    assert all(o["runtime"]["store_available"] for o in result["observations"])


def test_custom_progress_and_state_streams_show_workflow_steps():
    stream = list(
        module.graph.stream(
            module.sample_input(),
            context=module.DEMO_CONTEXT,
            config=module.DEMO_CONFIG,
            stream_mode=["custom", "values"],
        )
    )
    states = [value for mode, value in stream if mode == "values"]
    events = [value for mode, value in stream if mode == "custom"]
    assert [s["current_step"] for s in states] == [
        "fetching_campaigns",
        "analyzing",
        "summarizing",
        "completed",
    ]
    assert [e["step"] for e in events] == ["fetching_campaigns", "analyzing", "completed"]
    assert events[1]["roas"] == 1.67
    assert all(e["type"] == "campaign_progress" for e in events)


def test_run_name_names_outer_trace_not_node_configuration():
    class Capture(BaseCallbackHandler):
        def __init__(self):
            self.starts = []

        def on_chain_start(self, serialized, inputs, **kwargs):
            self.starts.append((kwargs.get("name"), kwargs.get("parent_run_id")))

    capture = Capture()
    result = module.graph.invoke(
        module.sample_input(),
        context=module.DEMO_CONTEXT,
        config={
            **module.DEMO_CONFIG,
            "callbacks": [capture],
        },
    )
    assert ("campaign_analysis", None) in capture.starts
    assert all(o["config"]["run_name"] is None for o in result["observations"])


def test_thread_id_selects_checkpoint_when_checkpointer_is_connected():
    graph = module.build_graph(checkpointer=InMemorySaver())
    graph.invoke(module.sample_input(), context=module.DEMO_CONTEXT, config=module.DEMO_CONFIG)
    snapshot = graph.get_state(module.DEMO_CONFIG)
    assert snapshot.values["current_step"] == "completed"
    assert len(snapshot.values["messages"]) == 2
    graph.invoke(module.sample_input(), context=module.DEMO_CONTEXT, config=module.DEMO_CONFIG)
    assert len(graph.get_state(module.DEMO_CONFIG).values["messages"]) == 4
    other_thread = {"configurable": {"thread_id": "other-thread"}}
    assert not graph.get_state(other_thread).values


def test_json_context_and_locale_are_used_per_request():
    context = replace(module.DEMO_CONTEXT, user_id="another-user", locale="en-US")
    result = module.graph.invoke(
        module.sample_input(),
        context=asdict(context),
        config={
            **module.DEMO_CONFIG,
            "metadata": {"request_id": "another-request"},
        },
    )
    assert result["messages"][-1].content.startswith("Training campaigns:")
    assert result["observations"][0]["context"]["user_id"] == "another-user"
    assert result["observations"][0]["config"]["metadata"]["request_id"] == "another-request"


def test_business_identity_in_config_does_not_replace_runtime_context():
    result = module.graph.invoke(
        module.sample_input(),
        context=module.DEMO_CONTEXT,
        config={
            "configurable": {"advertiser_id": "other-advertiser", "user_id": "other-user"},
        },
    )
    assert result["observations"][0]["context"]["advertiser_id"] == "adv_456"
    assert result["analysis_result"]["campaign_count"] == 2


def test_context_is_required_even_when_config_has_business_keys():
    with pytest.raises(ValueError, match="context"):
        module.graph.invoke(
            module.sample_input(),
            config={
                "configurable": {"user_id": "user_123", "advertiser_id": "adv_456"},
            },
        )


def test_campaign_read_permission_is_checked_before_analysis_or_store_write():
    store = InMemoryStore()
    context = replace(module.DEMO_CONTEXT, permissions=[])
    with pytest.raises(PermissionError, match="campaign:read"):
        module.build_graph(store=store).invoke(
            module.sample_input(),
            context=context,
            config={
                **module.DEMO_CONFIG,
                "configurable": {"permissions": ["campaign:read"]},
            },
        )
    assert not store.search(("advertisers", "adv_456", "analyses"))


@pytest.mark.parametrize("ids", [[], ["not-found"]])
def test_unknown_or_empty_campaign_selection_is_rejected(ids):
    with pytest.raises(ValueError, match="캠페인"):
        module.graph.invoke(
            {**module.sample_input(), "campaign_ids": ids}, context=module.DEMO_CONTEXT
        )


def test_campaigns_are_scoped_to_business_advertiser():
    with pytest.raises(ValueError, match="광고주"):
        module.graph.invoke(
            module.sample_input(),
            context=replace(
                module.DEMO_CONTEXT,
                advertiser_id="other-advertiser",
            ),
        )


def test_duplicate_campaign_ids_do_not_double_count_cost_and_revenue():
    result = module.graph.invoke(
        {
            **module.sample_input(),
            "campaign_ids": ["cmp_1", "cmp_1"],
        },
        context=module.DEMO_CONTEXT,
    )
    assert result["analysis_result"]["campaign_count"] == 1
    assert result["analysis_result"]["spend"] == 100000
    assert result["analysis_result"]["roas"] == 3.0


def test_execution_limit_is_enforced_by_runtime():
    with pytest.raises(GraphRecursionError):
        module.graph.invoke(
            module.sample_input(),
            context=module.DEMO_CONTEXT,
            config={
                **module.DEMO_CONFIG,
                "recursion_limit": 2,
            },
        )


def test_async_execution_has_same_state_context_and_config_contracts():
    result = asyncio.run(
        module.graph.ainvoke(
            module.sample_input(),
            context=module.DEMO_CONTEXT,
            config=module.DEMO_CONFIG,
        )
    )
    assert result["current_step"] == "completed"
    assert result["analysis_result"]["roas"] == 1.67
    assert all(o["context"]["advertiser_id"] == "adv_456" for o in result["observations"])


def test_public_graph_leaves_persistence_to_server():
    assert module.graph.store is None
    assert module.graph.checkpointer is None
