"""공통 HTTP 상태 계약: 대화 소유, 충돌, 삭제 중 실행 보호."""

from starlette.testclient import TestClient

from agent import history
from agent.app import app
from agent.dashboard.api import active


def test_state_api_conflict_and_active_thread_guard(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))

    async def valid(program):
        assert program == "root = Card([])"

    monkeypatch.setattr("agent.dashboard.api.validate_program", valid)
    thread = history.create_thread("API verification")["id"]
    client = TestClient(app)
    assert client.get("/dashboard/state/" + thread).json()["revision"] == 0
    payload = {
        "operation_id": "op-1",
        "base_revision": 0,
        "action": "add",
        "panel_id": "first",
        "payload": {"title": "First", "program": "root = Card([])"},
    }
    response = client.post("/dashboard/state/" + thread, json=payload)
    assert response.status_code == 200
    assert response.json()["revision"] == 1
    assert (
        client.post("/dashboard/state/" + thread, json=payload).json()["revision"] == 1
    )
    assert (
        client.post(
            "/dashboard/state/" + thread, json={**payload, "operation_id": "op-2"}
        ).status_code
        == 409
    )
    active.add(thread)
    try:
        assert client.delete("/comparison/threads/delete/" + thread).status_code == 409
    finally:
        active.discard(thread)
    assert client.get("/dashboard/state/not-a-uuid").status_code == 400


def test_invalid_program_update_keeps_previous_panel(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    from agent.dashboard import store

    thread = history.create_thread("Keep valid content")["id"]
    store.execute(
        thread,
        {
            "operation_id": "first",
            "base_revision": 0,
            "action": "add",
            "panel_id": "p",
            "payload": {"title": "Original", "program": "root = Card([])"},
        },
    )

    async def reject(program):
        raise ValueError("Parser rejected")

    monkeypatch.setattr("agent.dashboard.api.validate_program", reject)
    response = TestClient(app).post(
        "/dashboard/state/" + thread,
        json={
            "operation_id": "bad",
            "base_revision": 1,
            "action": "update",
            "panel_id": "p",
            "payload": {"program": "root = UnknownComponent()"},
        },
    )
    assert response.status_code == 400
    assert store.read(thread)["panels"][0]["program"] == "root = Card([])"


def test_cancel_during_planning_saves_status_and_releases_run(monkeypatch, tmp_path):
    import asyncio
    import json

    from starlette.requests import Request

    from agent.dashboard import api

    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    thread = history.create_thread("Cancelled plan")["id"]

    async def run():
        entered = asyncio.Event()

        async def plan(*args):
            entered.set()
            await asyncio.Event().wait()

        monkeypatch.setattr(api, "plan_request", plan)
        monkeypatch.setattr(api, "list_documents", list)

        async def receive():
            return {
                "type": "http.request",
                "body": json.dumps(
                    {
                        "threadId": thread,
                        "messages": [{"role": "user", "content": "Analyze"}],
                    }
                ).encode(),
            }

        response = await api.chat(
            Request(
                {
                    "type": "http",
                    "method": "POST",
                    "path": "/dashboard/chat",
                    "headers": [],
                },
                receive,
            )
        )

        async def consume():
            async for _ in response.body_iterator:
                pass

        task = asyncio.create_task(consume())
        await asyncio.wait_for(entered.wait(), 2)
        assert thread in active
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        assert thread not in active
        saved = history.get_messages(thread)
        assert saved[0]["content"] == "Analyze"
        assert "분석 중단" in saved[-1]["content"]
        assert "완성되지 않았을 수" in saved[-1]["content"]

    asyncio.run(run())


def test_failed_run_persists_failure_without_finished_event(monkeypatch, tmp_path):
    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    thread = history.create_thread("Failed plan")["id"]

    async def fail(*args):
        raise RuntimeError("private error detail")

    monkeypatch.setattr("agent.dashboard.api.plan_request", fail)
    monkeypatch.setattr("agent.dashboard.api.list_documents", list)
    response = TestClient(app).post(
        "/dashboard/chat",
        json={"threadId": thread, "messages": [{"role": "user", "content": "Analyze"}]},
    )
    assert "RUN_ERROR" in response.text
    assert "RUN_FINISHED" not in response.text
    assert "private error detail" not in response.text
    assert thread not in active
    assert "분석 실패" in history.get_messages(thread)[-1]["content"]


def test_clarification_is_rendered_and_saved_without_running_graph(
    monkeypatch, tmp_path
):
    from agent.dashboard import api
    from agent.dashboard.execution import CanvasPlan

    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    thread = history.create_thread("Confirmation")["id"]

    async def plan(*args):
        return CanvasPlan(
            operations=[],
            instruction="Ask first",
            clarification="임시 탭의 패널 1개도 함께 삭제할까요?",
        )

    def forbidden(*args):
        raise AssertionError("Clarification must not execute the agent graph")

    monkeypatch.setattr(api, "plan_request", plan)
    monkeypatch.setattr(api, "build_dashboard_graph", forbidden)
    client = TestClient(app)
    response = client.post(
        "/dashboard/chat",
        json={
            "threadId": thread,
            "messages": [{"role": "user", "content": "Delete tab"}],
        },
    )
    assert response.status_code == 200
    assert "함께 삭제할까요?" in response.text
    assert "RUN_FINISHED" in response.text and "RUN_ERROR" not in response.text
    assert "함께 삭제할까요?" in history.get_messages(thread)[-1]["content"]
    assert client.get("/dashboard/state/" + thread).json()["revision"] == 0


def test_historical_evidence_followup_streams_only_reviewed_answer(
    monkeypatch, tmp_path
):
    from langchain_core.messages import (
        AIMessage,
        HumanMessage,
        ToolMessage,
        convert_to_openai_messages,
    )

    from agent.dashboard import api
    from agent.dashboard.execution import CanvasPlan

    monkeypatch.setenv("DOCUMENT_DATA_DIR", str(tmp_path))
    thread = history.create_thread("Grounded followup")["id"]
    prior = [
        HumanMessage("Read risks"),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "id": "read",
                    "name": "read_document_page",
                    "args": {"document_id": "nvidia", "page": 34},
                }
            ],
        ),
        ToolMessage(
            content="Other than risks below, no material changes",
            tool_call_id="read",
            name="read_document_page",
        ),
    ]
    monkeypatch.setattr(
        history, "get_messages", lambda _: convert_to_openai_messages(prior)
    )

    async def plan(*args):
        return CanvasPlan(
            operations=[], instruction="Explain previous source", source_read="none"
        )

    class Run:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def events(self):
            yield {
                "type": "TEXT_MESSAGE_START",
                "messageId": "draft",
                "role": "assistant",
            }
            yield {
                "type": "TEXT_MESSAGE_CONTENT",
                "messageId": "draft",
                "delta": "UNREVIEWED_DRAFT",
            }
            yield {"type": "TEXT_MESSAGE_END", "messageId": "draft"}

        @property
        def extensions(self):
            return {"openui": self.events()}

        async def output(self):
            return {
                "messages": [
                    *prior,
                    HumanMessage("Explain again"),
                    AIMessage("REVIEWED_QUALIFIED_ANSWER"),
                ]
            }

    class Graph:
        async def astream_events(self, *args, **kwargs):
            return Run()

    monkeypatch.setattr(api, "plan_request", plan)
    monkeypatch.setattr(api, "list_documents", list)
    monkeypatch.setattr(api, "build_dashboard_graph", lambda *args: Graph())
    response = TestClient(app).post(
        "/dashboard/chat",
        json={
            "threadId": thread,
            "messages": [{"role": "user", "content": "Explain again"}],
        },
    )
    assert "RUN_ERROR" not in response.text
    assert "UNREVIEWED_DRAFT" not in response.text
    assert response.text.count("REVIEWED_QUALIFIED_ANSWER") == 1
    assert "RUN_FINISHED" in response.text
