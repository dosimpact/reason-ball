from __future__ import annotations

import json
from copy import deepcopy
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Body, Header, Query
from fastapi.responses import StreamingResponse

from server.runs.runtime import runtime, utc_now

router = APIRouter(prefix="/threads", tags=["Threads"])


def _matches(item: dict[str, Any], filters: dict[str, Any]) -> bool:
    if filters.get("ids") and item["thread_id"] not in filters["ids"]:
        return False
    if filters.get("status") and item["status"] != filters["status"]:
        return False
    for field in ("metadata", "values"):
        expected = filters.get(field) or {}
        actual = item.get(field) or {}
        if any(actual.get(key) != value for key, value in expected.items()):
            return False
    return True


@router.post("")
async def create_thread(payload: dict[str, Any] = Body(default_factory=dict)):
    return await runtime.create_thread_persisted(payload)


@router.post("/search")
async def search_threads(payload: dict[str, Any] = Body(default_factory=dict)):
    if runtime.thread_repository is not None:
        rows = await runtime.thread_repository.search(payload)
        items = [runtime._thread_row(row) for row in rows]
        runtime.threads.update({item["thread_id"]: item for item in items})
    else:
        items = [thread for thread in runtime.threads.values() if _matches(thread, payload)]
        sort_by = payload.get("sort_by", "created_at")
        items.sort(key=lambda value: value.get(sort_by, ""), reverse=payload.get("sort_order", "desc") == "desc")
        offset, limit = payload.get("offset", 0), payload.get("limit", 10)
        items = items[offset:offset + limit]
    if payload.get("select"):
        items = [{key: item[key] for key in payload["select"] if key in item} for item in items]
    return items


@router.post("/count")
async def count_threads(payload: dict[str, Any] = Body(default_factory=dict)) -> int:
    if runtime.thread_repository is not None:
        return await runtime.thread_repository.count(payload)
    return sum(_matches(thread, payload) for thread in runtime.threads.values())


@router.post("/prune")
async def prune_threads(payload: dict[str, Any] = Body(...)):
    count = 0
    strategy = payload.get("strategy", "delete")
    for thread_id in payload.get("thread_ids", []):
        try:
            await runtime.ensure_thread(thread_id)
        except Exception as exc:
            if getattr(exc, "status_code", None) == 404:
                continue
            raise
        if thread_id not in runtime.threads:
            continue
        if strategy == "delete":
            if runtime.run_repository is not None:
                await runtime.run_repository.delete_for_thread(thread_id)
            if runtime.thread_repository is not None:
                await runtime.thread_repository.delete(thread_id)
            runtime.threads.pop(thread_id, None)
            runtime.states.pop(thread_id, None)
            runtime.events.pop(thread_id, None)
        else:
            history = runtime.states.get(thread_id, [])
            runtime.states[thread_id] = history[-1:] if history else []
            await runtime.persist_thread(runtime.threads[thread_id])
        count += 1
    return {"pruned_count": count}


@router.get("/{thread_id}/state")
async def latest_state(thread_id: str, subgraphs: bool = False):
    del subgraphs
    return await runtime.state_from_storage(thread_id)


@router.post("/{thread_id}/state")
async def update_state(thread_id: str, payload: dict[str, Any] = Body(default_factory=dict)):
    state = await runtime.add_state_persisted(
        thread_id, payload.get("values"), payload.get("as_node"), payload.get("checkpoint")
    )
    return {"checkpoint": state["checkpoint"]}


@router.get("/{thread_id}/state/{checkpoint_id}")
async def state_at_checkpoint(thread_id: str, checkpoint_id: str, subgraphs: bool = False):
    del subgraphs
    return await runtime.state_from_storage(thread_id, checkpoint_id)


@router.post("/{thread_id}/state/checkpoint")
async def state_for_checkpoint(thread_id: str, payload: dict[str, Any] = Body(...)):
    await runtime.ensure_thread(thread_id)
    checkpoint_id = (payload.get("checkpoint") or {}).get("checkpoint_id")
    return await runtime.state_from_storage(thread_id, checkpoint_id)


@router.get("/{thread_id}/history")
async def history(thread_id: str, limit: int = 10, before: str | None = None):
    return await runtime.history_from_storage(thread_id, limit=limit, before=before)


@router.post("/{thread_id}/history")
async def history_post(thread_id: str, payload: dict[str, Any] = Body(default_factory=dict)):
    before = (payload.get("before") or {}).get("checkpoint_id")
    return await runtime.history_from_storage(
        thread_id, limit=payload.get("limit", 1), before=before,
        metadata=payload.get("metadata") or None,
    )


@router.post("/{thread_id}/copy")
async def copy_thread(thread_id: str):
    source = await runtime.ensure_thread(thread_id)
    copy = await runtime.create_thread_persisted({"metadata": deepcopy(source.get("metadata", {}))})
    copy["values"] = deepcopy(source.get("values", {}))
    runtime.states[copy["thread_id"]] = deepcopy(runtime.states.get(thread_id, []))
    for state in runtime.states[copy["thread_id"]]:
        state["checkpoint"]["thread_id"] = copy["thread_id"]
        state["checkpoint"]["checkpoint_id"] = str(uuid4())
    await runtime.persist_thread(copy)
    return copy


@router.get("/{thread_id}")
async def get_thread(thread_id: str, include: str | None = None):
    thread = deepcopy(await runtime.ensure_thread(thread_id))
    if include != "ttl":
        thread.pop("ttl", None)
    return thread


@router.delete("/{thread_id}")
async def delete_thread(thread_id: str):
    await runtime.ensure_thread(thread_id)
    if runtime.run_repository is not None:
        await runtime.run_repository.delete_for_thread(thread_id)
    if runtime.thread_repository is not None:
        await runtime.thread_repository.delete(thread_id)
    runtime.threads.pop(thread_id, None)
    runtime.states.pop(thread_id, None)
    runtime.events.pop(thread_id, None)
    for run_id in [key for key, run in runtime.runs.items() if run["thread_id"] == thread_id]:
        runtime.runs.pop(run_id, None)
        runtime.run_results.pop(run_id, None)
    return None


@router.patch("/{thread_id}")
async def patch_thread(thread_id: str, payload: dict[str, Any] = Body(default_factory=dict)):
    thread = await runtime.ensure_thread(thread_id)
    thread["metadata"].update(payload.get("metadata") or {})
    if "ttl" in payload:
        thread["ttl"] = deepcopy(payload["ttl"])
    thread["updated_at"] = utc_now()
    await runtime.persist_thread(thread)
    return thread


@router.get("/{thread_id}/stream")
async def join_thread_stream(
    thread_id: str, last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    stream_modes: list[str] = Query(default=["run_modes"]),
):
    await runtime.ensure_thread(thread_id)
    events = runtime.events.get(thread_id, [])
    if last_event_id and last_event_id not in {"-", "-1"}:
        events = [event for event in events if event["seq"] > int(last_event_id)]

    async def generate():
        for event in events:
            yield f"id: {event['seq']}\nevent: {event['method']}\ndata: {json.dumps(event['params']['data'])}\n\n"

    del stream_modes
    return StreamingResponse(generate(), media_type="text/event-stream")
