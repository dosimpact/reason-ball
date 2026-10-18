from collections.abc import AsyncIterator

from fastapi.testclient import TestClient

import app.main as main
from app.schemas import (
    CanvasPatch,
    ChatStreamRequest,
    GenerativeResponse,
    GraphArtifact,
    GraphArtifactProps,
    ToolCallEvent,
)
from app.graph import _normalize_response


def _read_sse_events(text: str) -> list[str]:
    return [line.removeprefix("event: ") for line in text.splitlines() if line.startswith("event: ")]


def test_health() -> None:
    client = TestClient(main.app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_chat_stream_contract(monkeypatch) -> None:
    async def fake_run_graph(_request) -> GenerativeResponse:
        return GenerativeResponse(
            message="Here is a chart.",
            tool_calls=[ToolCallEvent(name="getSalesData", input={})],
            artifacts=[
                GraphArtifact(
                    component="Graph",
                    props=GraphArtifactProps(
                        title="Monthly Revenue",
                        data={
                            "type": "bar",
                            "labels": ["Jan", "Feb"],
                            "datasets": [{"label": "Revenue", "data": [1, 2]}],
                        },
                    ),
                )
            ],
        )

    monkeypatch.setattr(main, "run_graph", fake_run_graph)
    client = TestClient(main.app)

    with client.stream(
        "POST",
        "/api/chat/stream",
        json={"message": "chart", "history": [], "canvas": None},
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert _read_sse_events(body) == ["tool_call", "message_delta", "artifact", "done"]


def test_chat_stream_error_event(monkeypatch) -> None:
    async def failing_run_graph(_request) -> AsyncIterator[None]:
        raise RuntimeError("boom")

    monkeypatch.setattr(main, "run_graph", failing_run_graph)
    client = TestClient(main.app)

    response = client.post("/api/chat/stream", json={"message": "chart"})

    assert response.status_code == 200
    assert "event: error" in response.text


def test_chat_stream_canvas_patch_contract(monkeypatch) -> None:
    async def fake_run_graph(_request) -> GenerativeResponse:
        return GenerativeResponse(
            message="Updated the canvas.",
            canvas_patch=CanvasPatch(
                components=[
                    {
                        "componentType": "Graph",
                        "id": "component-1",
                        "title": "Revenue Updated",
                        "chartType": "line",
                    }
                ]
            ),
        )

    monkeypatch.setattr(main, "run_graph", fake_run_graph)
    client = TestClient(main.app)

    with client.stream(
        "POST",
        "/api/chat/stream",
        json={
            "message": "update chart",
            "history": [],
            "canvas": {
                "activeCanvasId": "canvas-1",
                "canvases": [{"id": "canvas-1", "name": "Main", "isActive": True}],
                "activeCanvas": {
                    "id": "canvas-1",
                    "name": "Main",
                    "components": [
                        {
                            "id": "component-1",
                            "componentType": "Graph",
                            "title": "Revenue",
                            "chartType": "bar",
                            "order": 0,
                        }
                    ],
                },
            },
        },
    ) as response:
        body = response.read().decode("utf-8")

    assert response.status_code == 200
    assert _read_sse_events(body) == ["message_delta", "canvas_patch", "done"]
    assert '"chartType": "line"' in body


def test_normalize_response_adds_missing_markdown_artifact() -> None:
    normalized = _normalize_response(
        ChatStreamRequest(message="Create a markdown executive summary note"),
        [{"month": "Jan", "revenue": 100}],
        GenerativeResponse(message="Done.", artifacts=[]),
    )

    assert normalized.message == "Done."
    assert [artifact.component for artifact in normalized.artifacts] == ["Markdown"]
