"""Verify when automatic summarization runs and which messages remain."""

from __future__ import annotations

import importlib.util
from pathlib import Path


GRAPH_PATH = Path(__file__).parent / "graph-advanced/13_summarization_middleware/graph.py"
spec = importlib.util.spec_from_file_location("summarization_middleware_example", GRAPH_PATH)
assert spec is not None and spec.loader is not None
example = importlib.util.module_from_spec(spec)
spec.loader.exec_module(example)


def run_conversation(graph):
    config = {"configurable": {"thread_id": "test-conversation"}}
    states = []
    for question in example.DEMO_TURNS:
        states.append(
            graph.invoke(
                {"messages": [{"role": "user", "content": question}]},
                config=config,
            )
        )
    return states


def test_long_conversation_is_summarized_before_fourth_model_call():
    summary_model = example.DemoSummaryModel()
    response_model = example.DemoResponseModel()
    graph = example.build_graph(
        summary_model=summary_model,
        response_model=response_model,
    )

    states = run_conversation(graph)

    assert [len(state["messages"]) for state in states] == [2, 4, 6, 4]
    assert len(summary_model.prompts) == 1
    assert example.DEMO_TURNS[0] in summary_model.prompts[0]
    assert len(response_model.contexts) == 4
    final_context = response_model.contexts[-1]
    assert len(final_context) == 3
    assert "Here is a summary" in final_context[0].content
    assert "서울 여행" in final_context[0].content
    assert final_context[-1].content == example.DEMO_TURNS[-1]
    assert states[-1]["messages"][0].additional_kwargs["lc_source"] == "summarization"


def test_short_conversation_does_not_call_summary_model():
    summary_model = example.DemoSummaryModel()
    graph = example.build_graph(summary_model=summary_model, trigger_tokens=4000)

    states = run_conversation(graph)

    assert summary_model.prompts == []
    assert len(states[-1]["messages"]) == 8
