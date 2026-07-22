from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Body, Header, HTTPException, Query, Response
from fastapi.responses import StreamingResponse

from .runtime import runtime

router = APIRouter(tags=["Thread Runs"])


def _run_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not payload.get("assistant_id"):
        raise HTTPException(status_code=422, detail="assistant_id is required")
    return payload


def _sse(events: list[tuple[str, Any]]) -> StreamingResponse:
    async def generate():
        for index, (event, data) in enumerate(events, 1):
            yield f"id: {index}\nevent: {event}\ndata: {json.dumps(data)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/threads/{thread_id}/runs")
async def list_runs(
    thread_id: str, limit: int = 10, offset: int = 0, status: str | None = None,
    select: list[str] | None = Query(default=None),
) -> list[dict[str, Any]]:
    await runtime.ensure_thread(thread_id)
    if runtime.run_repository is not None:
        rows = await runtime.run_repository.list_for_thread(
            thread_id, limit=limit, offset=offset, status=status
        )
        items = [runtime._run_row(row)[0] for row in rows]
        runtime.runs.update({item["run_id"]: item for item in items})
    else:
        items = [r for r in runtime.runs.values() if r["thread_id"] == thread_id]
        if status:
            items = [r for r in items if r["status"] == status]
        items = sorted(items, key=lambda r: r["created_at"], reverse=True)[offset:offset + limit]
    if select:
        return [{key: run[key] for key in select if key in run} for run in items]
    return items


@router.post("/threads/{thread_id}/runs")
async def create_run(thread_id: str, response: Response, payload: dict[str, Any] = Body(...)):
    run, _ = await runtime.create_run(thread_id, _run_payload(payload))
    response.headers["Content-Location"] = f"/threads/{thread_id}/runs/{run['run_id']}"
    return run


@router.post("/threads/{thread_id}/runs/stream")
async def stream_run(thread_id: str, payload: dict[str, Any] = Body(...)):
    run, result = await runtime.create_run(thread_id, _run_payload(payload), wait=True)
    return _sse([("metadata", {"run_id": run["run_id"]}), ("values", result), ("end", {})])


@router.post("/threads/{thread_id}/runs/wait")
async def wait_run(thread_id: str, response: Response, payload: dict[str, Any] = Body(...)):
    run, result = await runtime.create_run(thread_id, _run_payload(payload), wait=True)
    response.headers["Content-Location"] = f"/threads/{thread_id}/runs/{run['run_id']}"
    return result


@router.get("/threads/{thread_id}/runs/{run_id}")
async def get_run(thread_id: str, run_id: str):
    return await runtime.get_run(thread_id, run_id)


@router.delete("/threads/{thread_id}/runs/{run_id}")
async def delete_run(thread_id: str, run_id: str):
    await runtime.get_run(thread_id, run_id)
    if runtime.run_repository is not None:
        await runtime.run_repository.delete(run_id)
    runtime.runs.pop(run_id)
    runtime.run_results.pop(run_id, None)
    return None


@router.get("/threads/{thread_id}/runs/{run_id}/join")
async def join_run(thread_id: str, run_id: str, cancel_on_disconnect: bool = False):
    del cancel_on_disconnect
    run = await runtime.get_run(thread_id, run_id)
    return runtime.run_results.get(run["run_id"])


@router.get("/threads/{thread_id}/runs/{run_id}/stream")
async def resume_run_stream(
    thread_id: str, run_id: str, last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    stream_mode: str | None = None, cancel_on_disconnect: bool = False,
):
    del last_event_id, stream_mode, cancel_on_disconnect
    run = await runtime.get_run(thread_id, run_id)
    return _sse([("metadata", run), ("values", runtime.run_results.get(run_id)), ("end", {})])


@router.post("/threads/{thread_id}/runs/{run_id}/cancel")
async def cancel_run(
    thread_id: str, run_id: str, wait: bool = False,
    action: str = Query(default="interrupt", pattern="^(interrupt|rollback)$"),
):
    del wait, action
    run = await runtime.get_run(thread_id, run_id)
    await runtime.cancel(run)
    return run


@router.post("/runs/cancel", status_code=204)
async def cancel_runs(payload: dict[str, Any] = Body(...)) -> Response:
    if runtime.run_repository is not None:
        selected = [runtime._run_row(row)[0] for row in await runtime.run_repository.list_all()]
    else:
        selected = list(runtime.runs.values())
    if payload.get("thread_id"):
        selected = [r for r in selected if r["thread_id"] == payload["thread_id"]]
    if payload.get("run_ids"):
        selected = [r for r in selected if r["run_id"] in payload["run_ids"]]
    if payload.get("status") and payload["status"] != "all":
        selected = [r for r in selected if r["status"] == payload["status"]]
    for run in selected:
        await runtime.cancel(run)
    return Response(status_code=204)


@router.post("/runs")
async def stateless_run(payload: dict[str, Any] = Body(...)):
    _, result = await runtime.create_run(None, _run_payload(payload), wait=True)
    return result


@router.post("/runs/wait")
async def stateless_wait(payload: dict[str, Any] = Body(...)):
    _, result = await runtime.create_run(None, _run_payload(payload), wait=True)
    return result


@router.post("/runs/stream")
async def stateless_stream(payload: dict[str, Any] = Body(...)):
    run, result = await runtime.create_run(None, _run_payload(payload), wait=True)
    return _sse([("metadata", {"run_id": run["run_id"]}), ("values", result), ("end", {})])


@router.post("/runs/batch")
async def stateless_batch(payload: list[dict[str, Any]] = Body(..., min_length=1)):
    return [(await runtime.create_run(None, _run_payload(item), wait=True))[1] for item in payload]
