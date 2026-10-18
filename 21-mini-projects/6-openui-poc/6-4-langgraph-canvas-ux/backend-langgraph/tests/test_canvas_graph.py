"""Query reuse must be enforced before any new model SQL can execute."""

import asyncio
import json
from types import SimpleNamespace

import pytest

from agent import canvas_graph as canvas


def test_filter_edit_reuses_registered_query_even_if_model_emits_sql(monkeypatch):
    events = []
    calls = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)

    def refresh(query_id, parameters):
        calls.append((query_id, parameters))
        return {"rows": [{"period": "2026-10", "value": 42}]}

    monkeypatch.setattr(canvas, "service", lambda: SimpleNamespace(refresh=refresh))

    class Model:
        async def astream(self, messages):
            yield SimpleNamespace(content='root = Col([CanvasChart("Sales", "line")])')

    monkeypatch.setattr(canvas, "model", Model)
    original = {
        "widgetId": "sales",
        "tabId": "sales-tab",
        "layout": {"width": 6, "height": 640},
        "definitionRevision": 1,
        "queryId": "saved-query",
        "program": 'root = Col([CanvasChart("Sales", "bar")])',
        "title": "Sales",
        "uiState": {"selected": "October"},
    }
    plan = canvas.Plan(
        mode="canvas",
        explanation="Update selected chart",
        operations=[
            canvas.Operation(
                action="update",
                widgetId="sales",
                title="Sales",
                sql="SELECT CURRENT_DATE",
                queryMode="reuse",
                region="KR",
                months=3,
                chartType="line",
            ),
        ],
    )
    asyncio.run(
        canvas.work_node(
            {"plan": plan, "widgets": [original], "message": "한국 최근 3개월"}
        )
    )
    assert calls == [("saved-query", {"months": 3, "region": "KR"})]
    committed = next(event["widget"] for event in events if event["type"] == "commit")
    assert committed["tabId"] == "sales-tab"
    assert committed["layout"] == {"width": 6, "height": 640}
    assert committed["queryId"] == "saved-query"
    assert committed["uiState"] == original["uiState"]
    assert committed["definitionRevision"] == 2
    assert original["definitionRevision"] == 1


@pytest.mark.parametrize("explanation", ["", "   ", "\n\t"])
@pytest.mark.parametrize("mode", ["canvas", "clarify", "explain"])
def test_empty_plan_explanation_emits_visible_chat_notice(
    monkeypatch, explanation, mode
):
    events = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)
    operations = (
        [canvas.Operation(action="delete", widgetId="sales")]
        if mode == "canvas"
        else []
    )
    asyncio.run(
        canvas.work_node(
            {
                "plan": canvas.Plan(
                    mode=mode, explanation=explanation, operations=operations
                ),
                "widgets": [{"widgetId": "sales", "definitionRevision": 1}],
                "message": "매출과 광고비 Canvas",
            }
        )
    )
    chat = next(event["delta"] for event in events if event["channel"] == "chat")
    text = json.loads(chat.removeprefix("root = Col([Text(").removesuffix(")])"))
    assert text.strip()
    if mode == "canvas":
        assert "작업 1개를 진행합니다" in text
        assert "완료" not in text
        assert any(event["type"] == "delete" for event in events)


def test_publish_chart_emits_artifact_without_canvas_mutation(monkeypatch):
    events = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)
    monkeypatch.setattr(canvas, "service", lambda: SimpleNamespace(register=lambda *args: {
        "queryId": "a" * 24, "definition": {"title": args[2]}, "snapshot": {"rows": []}
    }))
    result = canvas.publish_analysis_chart.invoke({"sql": "SELECT 1", "title": "Sales", "description": "Monthly"})
    assert result["artifactId"] == events[0]["artifact"]["artifactId"]
    assert events[0]["channel"] == "artifact"
    assert events[0]["artifact"]["queryDefinition"]["title"] == "Sales"
    assert all(event["channel"] != "canvas" for event in events)


def test_failed_publish_does_not_emit_artifact(monkeypatch):
    events = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)

    def fail(*args):
        raise canvas.QueryError("Rejected query")

    monkeypatch.setattr(canvas, "service", lambda: SimpleNamespace(register=fail, describe=dict))
    result = canvas.publish_analysis_chart.invoke({"sql": "bad", "title": "Sales", "description": "Monthly"})
    assert result["error"] == "Rejected query"
    assert events == []


def test_definition_api_moves_sqlite_work_off_event_loop(monkeypatch):
    import threading

    from starlette.requests import Request

    from agent import app as routes

    main_thread = threading.get_ident()

    def definition(query_id):
        assert threading.get_ident() != main_thread
        return {"queryId": query_id}

    def get_service():
        assert threading.get_ident() != main_thread
        return SimpleNamespace(definition=definition)

    monkeypatch.setattr(routes, "service", get_service)
    response = asyncio.run(routes.query_definition(Request({"type": "http", "path_params": {"query_id": "saved"}})))
    assert response.status_code == 200
    assert json.loads(response.body)["queryId"] == "saved"


def test_publish_rejects_partial_dates_before_emitting_invalid_artifact(monkeypatch):
    events = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)
    monkeypatch.setattr(canvas, "service", lambda: SimpleNamespace(describe=dict))
    result = canvas.publish_analysis_chart.invoke({"sql": "SELECT 1", "title": "Sales", "description": "Monthly", "start_date": "2026-07-01"})
    assert "both" in result["error"]
    assert events == []


def test_chat_chart_root_uses_only_issued_artifact_ids(monkeypatch):
    events = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)
    ids = iter(["issued-sales", "issued-ads"])

    async def publish(args):
        artifact_id = next(ids)
        events.append({"channel": "artifact", "artifact": {"artifactId": artifact_id}})
        return {"artifactId": artifact_id}

    monkeypatch.setattr(canvas, "publish_analysis_chart", SimpleNamespace(ainvoke=publish))
    asyncio.run(canvas.work_node({"message": "two charts", "widgets": [], "plan": canvas.Plan(mode="chat", explanation="Sales and advertising", operations=[canvas.Operation(action="create", title="Sales", sql="query1"), canvas.Operation(action="create", title="Ads", sql="query2")])}))
    program = "".join(e["delta"] for e in events if e["channel"] == "chat")
    assert program == 'root = Col([AnalysisChart("issued-sales"), AnalysisChart("issued-ads")])'
    assert all(e["channel"] != "canvas" for e in events)

@pytest.mark.parametrize("mode", ["chat", "canvas"])
def test_registered_content_has_no_query_dependency(monkeypatch, mode):
    events = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)

    async def generate(op, existing=None):
        return 'root = Col([Text("A note")])'

    monkeypatch.setattr(canvas, "generate_registered_program", generate)
    monkeypatch.setattr(canvas, "service", lambda: pytest.fail("No analytics service for registered UI"))
    plan = canvas.Plan(mode=mode, explanation="노트 생성", operations=[
        canvas.Operation(action="create", kind="registered", title="노트", content="A note")
    ])
    asyncio.run(canvas.work_node({"plan": plan, "widgets": [], "message": "노트", "canvas": {"activeTabId": "notes"}}))
    if mode == "chat":
        text = "".join(e.get("delta", "") for e in events)
        assert 'CanvasItem("openui"' in text
        assert "A note" in text
        assert not any(e["type"] == "commit" for e in events)
    else:
        widget = next(e["widget"] for e in events if e["type"] == "commit")
        assert widget["kind"] == "registered"
        assert widget["tabId"] == "notes"
        assert "queryId" not in widget


def test_registered_update_preserves_layout_and_rejects_refresh(monkeypatch):
    events = []
    monkeypatch.setattr(canvas, "get_stream_writer", lambda: events.append)

    async def generate(op, existing=None):
        assert existing["program"] == "old"
        assert "Latest user request (apply requested wording): update" in op.content
        return 'root = Col([Text("new")])'

    monkeypatch.setattr(canvas, "generate_registered_program", generate)
    original = {"kind": "registered", "widgetId": "note", "sourceId": "original", "program": "old", "title": "Note", "tabId": "notes", "layout": {"width": 6, "height": 420}, "definitionRevision": 3}
    for action in ["update", "refresh"]:
        events.clear()
        plan = canvas.Plan(mode="canvas", explanation="Update", operations=[canvas.Operation(action=action, widgetId="note", title="Updated")])
        asyncio.run(canvas.work_node({"plan": plan, "widgets": [original], "message": "update"}))
        if action == "update":
            result = next(e["widget"] for e in events if e["type"] == "commit")
            assert result["layout"] == original["layout"]
            assert result["sourceId"] == original["sourceId"]
            assert result["definitionRevision"] == 4
        else:
            assert any(e["type"] == "error" for e in events)
            assert not any(e["type"] == "commit" for e in events)
        assert original["program"] == "old"


@pytest.mark.parametrize('program', [
    '$name = ""\nform = Card([Input($name, "이름")])\nroot=Col([form])',
    '```openui\nroot = Col([Text("Form() is just text")])\n```',
    '$name = ""\nroot = Col([Form([Input($name, "이름"), Button("Reset", @Reset($name))])])',
])
def test_registered_program_accepts_declarations_and_transport_fences(program):
    catalog = canvas.Path(canvas.__file__).with_name('system-prompt.txt').read_text()
    result = canvas.check_registered_program(program, catalog)
    assert 'root' in result
    assert not result.startswith('```')


@pytest.mark.parametrize('program', [
    'root = Col([UnknownForm([])])', 'root = Col([FormExample()])',
    'root = Col([CanvasItem("openui", "nested", "")])',
    'text = "root = Col([])"', '', 'x' * 10001,
])
def test_registered_program_rejects_unknown_calls_or_missing_root(program):
    catalog = canvas.Path(canvas.__file__).with_name('system-prompt.txt').read_text()
    with pytest.raises(ValueError):
        canvas.check_registered_program(program, catalog)


@pytest.mark.parametrize('repair_succeeds', [True, False])
def test_registered_generation_repairs_once_before_publishing(monkeypatch, repair_succeeds):
    calls = []
    class Model:
        async def ainvoke(self, messages):
            calls.append(list(messages))
            return SimpleNamespace(content=(
                '$name = ""\nroot = Col([Input($name, "이름")])'
                if len(calls) == 2 and repair_succeeds else 'root = Col([FormExample([])])'
            ))
    monkeypatch.setattr(canvas, 'model', Model)
    request = canvas.generate_registered_program(canvas.Operation(action='create', kind='registered'))
    if repair_succeeds:
        assert asyncio.run(request).startswith('$name')
    else:
        with pytest.raises(ValueError, match='다시 요청'):
            asyncio.run(request)
    assert len(calls) == 2
    assert 'Unknown calls: FormExample' in calls[1][-1][1]
