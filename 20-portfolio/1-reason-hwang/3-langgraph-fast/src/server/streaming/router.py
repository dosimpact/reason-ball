from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse

from server.runs.runtime import runtime

router = APIRouter(prefix="/threads/{thread_id}", tags=["Streaming"])


@router.post("/stream/events")
async def protocol_events(thread_id: str, payload: dict[str, Any] = Body(...)):
    await runtime.ensure_thread(thread_id)
    channels = payload.get("channels")
    if not isinstance(channels, list) or not channels:
        raise HTTPException(status_code=400, detail="channels must be a non-empty array")
    since = payload.get("since", 0)
    allowed = {item if isinstance(item, str) else item.get("channel") for item in channels}
    events = [
        event for event in runtime.events.get(thread_id, [])
        if event["seq"] > since and (event["method"] in allowed or "*" in allowed)
    ]

    async def generate():
        for event in events:
            yield f"id: {event['seq']}\nevent: {event['method']}\ndata: {json.dumps(event)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/commands")
async def protocol_command(thread_id: str, payload: dict[str, Any] = Body(...)):
    await runtime.ensure_thread(thread_id)
    if "id" not in payload or "method" not in payload:
        raise HTTPException(status_code=400, detail="id and method are required")
    method = payload["method"]
    params = payload.get("params") or {}
    try:
        if method == "run.start":
            if not params.get("assistant_id"):
                raise HTTPException(status_code=400, detail="assistant_id is required")
            run, _ = await runtime.create_run(thread_id, params)
            result: Any = {"run_id": run["run_id"]}
        elif method == "input.respond":
            state = await runtime.add_state_persisted(
                thread_id, params.get("input"), "input.respond"
            )
            result = {"checkpoint": state["checkpoint"]}
        elif method == "agent.getTree":
            result = {"thread_id": thread_id, "nodes": []}
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported command method: {method}")
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Missing parameter: {exc.args[0]}") from exc
    return {"type": "response", "id": payload["id"], "result": result}
