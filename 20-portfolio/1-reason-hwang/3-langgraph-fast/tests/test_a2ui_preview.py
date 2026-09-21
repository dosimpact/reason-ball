import json

import pytest
from ag_ui.core import (
    CustomEvent,
    RunFinishedEvent,
    ToolCallArgsEvent,
    ToolCallStartEvent,
)

from server.a2ui.preview import PreviewStream, complete_components, preview_operations


def components():
    return [
        {"id": "root", "component": "Column", "children": ["revenue", "chart"]},
        {"id": "revenue", "component": "Metric", "label": "매출", "value": {"path": "/facts/summary/revenue"}},
        {"id": "chart", "component": "Chart", "type": "bar", "data": {"path": "/facts/series/regions"}},
    ]


def test_partial_json_only_returns_complete_members_and_ignores_nested_keys():
    first = components()[0]
    prefix = '{"note":{"components":[]},"surfaceId":"s","components":['
    assert complete_components(prefix + json.dumps(first) + ',{"id":') == [first]
    assert complete_components(prefix + json.dumps(first)[:-1]) == []
    assert complete_components('{"note":"components",') == []


def test_partial_root_uses_only_ready_branches_and_authoritative_facts():
    operations = preview_operations(components()[:2], "preview")
    assert operations is not None
    tree = {item["id"]: item for item in operations[1]["updateComponents"]["components"]}
    assert tree["root"]["children"] == ["revenue"]
    assert operations[2]["updateDataModel"]["value"]["facts"]["summary"]["revenue"] == "$680,000"
    assert components()[0]["children"] == ["revenue", "chart"]


def test_invalid_bindings_literals_cycles_and_duplicate_ids_are_not_painted():
    for value in ("$999", {"path": "/facts/missing"}):
        tree = components()[:2]
        tree[1]["value"] = value
        assert preview_operations(tree, "preview") is None
    tree = components()[:2]
    tree[0]["children"] = ["root"]
    assert preview_operations(tree, "preview") is None
    assert preview_operations([*components()[:2], components()[1]], "preview") is None


def test_stream_paints_before_tool_end_and_clears_on_retry_and_completion():
    stream = PreviewStream("test")
    start = ToolCallStartEvent(tool_call_id="inner", tool_call_name="render_a2ui")
    assert stream.observe(start).value == {"operations": []}
    arguments = '{"surfaceId":"s","components":[' + ','.join(json.dumps(item) for item in components()[:2]) + ','
    update = stream.observe(ToolCallArgsEvent(tool_call_id="inner", delta=arguments))
    assert update is not None and update.value["operations"]
    assert stream.observe(CustomEvent(name="a2ui.progress", value={"stage": "retrying"})).value == {"operations": []}
    assert stream.observe(ToolCallArgsEvent(tool_call_id="inner", delta="{}")) is None
    assert stream.observe(RunFinishedEvent(thread_id="t", run_id="test")).value == {"operations": []}


@pytest.mark.parametrize("mode,render_mode", [("dynamic", "invalid"), ("dynamic", []), ("fixed", "progressive")])
def test_http_rejects_invalid_render_options_before_model_setup(mode, render_mode):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from graph.primary_graphs.a2ui_demo.contract import MANIFEST
    from server.a2ui.router import router

    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        response = client.post(f"/ag-ui/a2ui/{mode}", json={
            "threadId": "option-test", "runId": "option-run", "state": {}, "messages": [],
            "tools": [], "context": [], "forwardedProps": {
                "a2uiContract": {"protocolVersion": MANIFEST["protocolVersion"], **MANIFEST["catalogs"][mode]},
                "a2uiRenderMode": render_mode,
            },
        })
    assert response.status_code == 422
    assert "a2uiRenderMode" in response.json()["detail"]
