import asyncio
import json

import pytest

import agent.canvas_graph as module
from agent import analysis
from agent.canvas_graph import Operation, Parameters, Plan, canvas_graph

SQL = "SELECT strftime(month,'%Y-%m') AS month, SUM(revenue) AS revenue FROM monthly_metrics WHERE ($region='ALL' OR region=$region) AND month BETWEEN CAST($start_date AS DATE) AND CAST($end_date AS DATE) GROUP BY 1 ORDER BY 1"


@pytest.fixture(autouse=True)
def environment(tmp_path, monkeypatch):
    monkeypatch.setenv("CANVAS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ANALYSIS_TODAY", "2026-10-18")


def run(monkeypatch, plans, widgets=None, selected=None):
    class StubModel:
        def with_structured_output(self, *_):
            return self

        async def ainvoke(self, _):
            return plans.pop(0)

    monkeypatch.setattr(module, "model", StubModel)

    async def collect():
        return [
            event
            async for event in canvas_graph.astream(
                {
                    "request": {
                        "message": "request",
                        "canvases": [{"id": "c", "title": "Canvas"}],
                        "activeCanvasId": "c",
                        "widgets": widgets or [],
                        "selectedWidgetId": selected,
                    }
                },
                stream_mode="custom",
            )
        ]

    return asyncio.run(collect())


def test_two_independent_programs_and_query_registration(monkeypatch):
    events = run(
        monkeypatch,
        [
            Plan(
                message="분석",
                operations=[
                    Operation(action="create", sql=SQL, title="매출"),
                    Operation(
                        action="create",
                        sql=SQL.replace("revenue", "spend"),
                        title="광고비",
                    ),
                ],
            )
        ],
    )
    completed = [e for e in events if e["type"] == "complete"]
    assert len(completed) == 2
    first, second = [e["widget"] for e in completed]
    assert first["id"] != second["id"]
    assert first["bindingId"] != second["bindingId"]
    assert first["queryId"] != second["queryId"]
    assert "CanvasData(" in first["program"]
    assert any(e["type"] == "delta" for e in events)


def test_query_filter_edit_keeps_id_and_other_widget(monkeypatch):
    registered = analysis.register(SQL, {"region": "ALL", "period": "last_3_months"})
    current = {
        "id": "w1",
        "canvasId": "c",
        "title": "Sales",
        "chartType": "bar",
        "definitionRevision": 1,
        "bindingId": "b",
        **registered,
    }
    before = json.dumps(current)
    events = run(
        monkeypatch,
        [
            Plan(
                message="변경",
                operations=[
                    Operation(
                        action="update",
                        channel="chat",
                        targetId="w1",
                        parameters=Parameters(region="KR", period="last_6_months"),
                    )
                ],
            )
        ],
        [current],
        "w1",
    )
    assert next(e for e in events if e["type"] == "complete")["channel"] == "canvas"
    updated = next(e["widget"] for e in events if e["type"] == "complete")
    assert updated["parameters"] == {"region": "KR", "period": "last_6_months"}
    assert updated["definitionRevision"] == 2
    assert updated["queryId"] == current["queryId"]
    assert json.dumps(current) == before


def test_failed_widget_does_not_cancel_other_widget(monkeypatch):
    invalid = Operation(action="create", sql="SELECT * FROM missing")
    good = Operation(action="create", sql=SQL)
    plan = Plan(message="검증", operations=[invalid, good])
    events = run(monkeypatch, [plan, plan, plan])
    assert len([e for e in events if e["type"] == "failed"]) == 1
    assert len([e for e in events if e["type"] == "complete"]) == 1


def test_explanation_and_missing_target_do_not_write(monkeypatch):
    events = run(
        monkeypatch, [Plan(message="차트는 합성 데이터입니다.", operations=[])]
    )
    assert not any(e["type"] in {"start", "complete", "command"} for e in events)
    events = run(
        monkeypatch,
        [
            Plan(
                message="수정",
                operations=[Operation(action="update", targetId="missing")],
            )
        ],
    )
    assert any(e["type"] == "failed" for e in events)
    assert not any(e["type"] == "complete" for e in events)


def test_validation_feedback_repairs_plan_before_execution(monkeypatch):
    invalid = Plan(
        message="분석", operations=[Operation(action="create", sql="SELECT 1")]
    )
    valid = Plan(message="분석", operations=[Operation(action="create", sql=SQL)])
    events = run(monkeypatch, [invalid, valid])
    assert any(e["type"] == "complete" for e in events)
    assert not any(e["type"] == "failed" for e in events)


def test_markdown_title_update_keeps_content(monkeypatch):
    current = {
        "id": "m",
        "canvasId": "c",
        "title": "old",
        "content": "**본문 보존**",
        "chartType": "markdown",
        "definitionRevision": 1,
    }
    events = run(
        monkeypatch,
        [
            Plan(
                message="제목 변경",
                operations=[Operation(action="update", targetId="m", title="new")],
            )
        ],
        [current],
    )
    changed = next(event["widget"] for event in events if event["type"] == "complete")
    assert changed["content"] == current["content"]
    assert "본문 보존" in changed["program"] and 'Title("new"' in changed["program"]


def test_retry_executes_only_failed_operation_without_replanning(monkeypatch):
    def forbidden_model():
        raise AssertionError("Retry must not plan the whole successful request again")

    monkeypatch.setattr(module, "model", forbidden_model)

    async def collect():
        return [
            event
            async for event in canvas_graph.astream(
                {
                    "request": {
                        "message": "retry",
                        "canvases": [{"id": "c"}],
                        "activeCanvasId": "c",
                        "retryOperations": [
                            {
                                "action": "create",
                                "channel": "canvas",
                                "chartType": "markdown",
                                "content": "retry body",
                                "title": "retry only",
                            }
                        ],
                    }
                },
                stream_mode="custom",
            )
        ]

    events = asyncio.run(collect())
    assert len([event for event in events if event["type"] == "complete"]) == 1


def test_graph_cancellation_reaches_model_await(monkeypatch):
    async def scenario():
        started, cancelled = asyncio.Event(), asyncio.Event()

        class BlockingModel:
            def with_structured_output(self, *_):
                return self

            async def ainvoke(self, _):
                started.set()
                try:
                    await asyncio.Event().wait()
                finally:
                    cancelled.set()

        monkeypatch.setattr(module, "model", BlockingModel)

        async def collect():
            async for _ in canvas_graph.astream(
                {"request": {"message": "cancel"}}, stream_mode="custom"
            ):
                pass

        task = asyncio.create_task(collect())
        await asyncio.wait_for(started.wait(), 2)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        await asyncio.wait_for(cancelled.wait(), 2)

    asyncio.run(scenario())


def test_duplicate_titles_require_selection_even_if_model_guesses(monkeypatch):
    widgets = [
        {"id": "a", "canvasId": "c", "title": "same"},
        {"id": "b", "canvasId": "c", "title": "same"},
    ]
    events = run(
        monkeypatch,
        [
            Plan(
                message="수정",
                operations=[Operation(action="update", targetId="a", chartType="line")],
            )
        ],
        widgets,
    )
    assert not any(
        event["type"] in {"start", "complete", "command"} for event in events
    )
    assert any("선택" in event.get("text", "") for event in events)
