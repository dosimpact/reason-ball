"""Validate actual UI events and reducer state without an LLM/API key."""

import importlib

import pytest
from langgraph.graph.ui import ui_message_reducer


graph = importlib.import_module("graph-basic.47_push_ui_message").graph


def test_ui_events_merge_and_link_to_response(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    chunks = list(graph.stream({"messages": [], "ui": []}, stream_mode=["custom", "values"]))
    events = [event for mode, event in chunks if mode == "custom"]
    final = [state for mode, state in chunks if mode == "values"][-1]

    assert len(events) == 2
    assert events[0]["type"] == "ui"
    assert events[0]["name"] == "task_card"
    assert events[0]["props"]["status"] == "running"
    assert events[0]["id"] == events[1]["id"] == final["card_id"]
    assert events[1]["metadata"]["merge"] is True
    assert events[1]["metadata"]["message_id"] == final["messages"][-1].id
    assert len(final["ui"]) == 1
    assert final["ui"][0]["props"] == {
        "title": "LangGraph UI 메시지 학습", "status": "completed", "progress": 100
    }


def test_ui_reducer_rejects_removing_unknown_id():
    with pytest.raises(ValueError, match="doesn't exist"):
        ui_message_reducer([], {"type": "remove-ui", "id": "missing"})
