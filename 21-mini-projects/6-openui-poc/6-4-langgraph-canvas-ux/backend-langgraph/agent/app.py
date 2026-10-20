"""Custom routes mounted by LangGraph; no model calls in saved-query API."""

import asyncio
import json
from uuid import uuid4

from pydantic import BaseModel, Field, ValidationError
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from agent.analytics import QueryError, service
from agent.canvas_graph import METRICS, workspace_graph


class RunBody(BaseModel):
    threadId: str | None = None
    canvas: dict = Field(default_factory=dict)
    message: str = Field(min_length=1, max_length=12000)
    history: list[dict] = Field(default_factory=list, max_length=30)
    chatArtifacts: list[dict] = Field(default_factory=list, max_length=50)
    widgets: list[dict] = Field(default_factory=list, max_length=50)
    selectedWidgetId: str | None = None


async def run(request: Request):
    try:
        raw = await request.body()
        if len(raw) > 1_000_000:
            return JSONResponse({"error": "Request too large"}, status_code=413)
        body = RunBody.model_validate_json(raw)
    except (ValidationError, ValueError):
        return JSONResponse({"error": "Invalid workspace request"}, status_code=400)
    run_id = str(uuid4())

    async def events():
        seq = 0

        def encode(event):
            return (
                "data: "
                + json.dumps(
                    {**event, "runId": run_id, "sequence": seq}, ensure_ascii=False
                )
                + "\n\n"
            )

        METRICS["activeRuns"] += 1
        try:
            yield encode({"channel": "run", "type": "start"})
            async with asyncio.timeout(120):
                async for event in workspace_graph.astream(
                    {**body.model_dump(), "runId": run_id}, stream_mode="custom"
                ):
                    if await request.is_disconnected():
                        METRICS["cancelledRuns"] += 1
                        return
                    seq += 1
                    yield encode(event)
            seq += 1
            METRICS["completedRuns"] += 1
            yield encode({"channel": "run", "type": "done"})
        except asyncio.CancelledError:
            METRICS["cancelledRuns"] += 1
            raise
        except Exception as exc:  # noqa: BLE001 -- terminate the SSE run with an explicit error
            seq += 1
            yield encode({"channel": "run", "type": "error", "error": str(exc)[:400]})
        finally:
            METRICS["activeRuns"] -= 1

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def query(request: Request):
    try:
        body = await request.json()
        if not isinstance(body, dict) or not isinstance(
            body.get("parameters", {}), dict
        ):
            raise TypeError()
        METRICS["refreshCalls"] += 1
        result = await asyncio.to_thread(
            lambda: service().refresh(
                request.path_params["query_id"],
                body.get("parameters", {}),
                body.get("queryVersion", 1),
            ),
        )
        return JSONResponse(result, headers={"Cache-Control": "no-store"})
    except (QueryError, ValueError, TypeError) as exc:
        return JSONResponse(
            {"error": str(exc) or "Invalid query request"}, status_code=400
        )


async def query_definition(request: Request):
    try:
        return JSONResponse(await asyncio.to_thread(lambda: service().definition(request.path_params["query_id"])))
    except QueryError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)


async def health(request: Request):
    return JSONResponse({"status": "ok", "metrics": METRICS, "synthetic": True})


app = Starlette(
    routes=[
        Route("/canvas/run", run, methods=["POST"]),
        Route("/canvas/query/{query_id}", query, methods=["POST"]),
        Route("/canvas/query/{query_id}", query_definition, methods=["GET"]),
        Route("/canvas/health", health),
    ]
)
