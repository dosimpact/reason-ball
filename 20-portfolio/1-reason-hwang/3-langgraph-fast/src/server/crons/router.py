from __future__ import annotations

from datetime import UTC, datetime
from threading import RLock
from typing import Any, Literal, Protocol
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

router = APIRouter(tags=["Crons"])


class CronCreate(BaseModel):
    assistant_id: str
    schedule: str = Field(min_length=1)
    timezone: str | None = None
    end_time: datetime | None = None
    input: dict[str, Any] | list[dict[str, Any]] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
    webhook: str | None = None
    interrupt_before: str | list[str] | None = None
    interrupt_after: str | list[str] | None = None
    on_run_completed: Literal["delete", "keep"] = "delete"
    enabled: bool = True
    stream_mode: str | list[str] = Field(default_factory=lambda: ["values"])
    stream_subgraphs: bool = False
    stream_resumable: bool = False
    durability: Literal["sync", "async", "exit"] = "async"


class ThreadCronCreate(CronCreate):
    pass


class CronPatch(BaseModel):
    schedule: str | None = None
    timezone: str | None = None
    end_time: datetime | None = None
    input: dict[str, Any] | list[dict[str, Any]] | None = None
    metadata: dict[str, Any] | None = None
    config: dict[str, Any] | None = None
    context: dict[str, Any] | None = None
    webhook: str | None = None
    interrupt_before: str | list[str] | None = None
    interrupt_after: str | list[str] | None = None
    on_run_completed: Literal["delete", "keep"] | None = None
    enabled: bool | None = None
    stream_mode: str | list[str] | None = None
    stream_subgraphs: bool | None = None
    stream_resumable: bool | None = None
    durability: Literal["sync", "async", "exit"] | None = None


class CronSearch(BaseModel):
    assistant_id: str | None = None
    thread_id: UUID | None = None
    enabled: bool | None = None
    metadata: dict[str, Any] | None = None
    limit: int = Field(default=10, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
    sort_by: str = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"
    select: list[str] | None = None


class CronCountRequest(BaseModel):
    assistant_id: str | None = None
    thread_id: UUID | None = None
    metadata: dict[str, Any] | None = None


_crons: dict[UUID, dict[str, Any]] = {}
_lock = RLock()


class CronRepository(Protocol):
    async def create(self, cron: dict[str, Any]) -> dict[str, Any]: ...
    async def get(self, cron_id: UUID) -> dict[str, Any] | None: ...
    async def search(
        self,
        *,
        assistant_id: str | None = None,
        thread_id: UUID | None = None,
        enabled: bool | None = None,
        metadata: dict[str, Any] | None = None,
        limit: int = 10,
        offset: int = 0,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> list[dict[str, Any]]: ...
    async def count(
        self,
        *,
        assistant_id: str | None = None,
        thread_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> int: ...
    async def update(self, cron: dict[str, Any]) -> dict[str, Any]: ...
    async def delete(self, cron_id: UUID) -> bool: ...


_repository: CronRepository | None = None


def set_cron_repository(repository: CronRepository | None) -> None:
    """Select PostgreSQL persistence; ``None`` restores isolated in-memory mode."""
    global _repository
    _repository = repository


def export_state() -> dict[str, Any]:
    with _lock:
        return {str(key): value.copy() for key, value in _crons.items()}


def import_state(state: dict[str, Any]) -> None:
    with _lock:
        _crons.clear()
        _crons.update(
            {UUID(key): value for key, value in state.items() if isinstance(value, dict)}
        )


async def _create(payload: CronCreate, thread_id: UUID | None = None) -> dict[str, Any]:
    now = datetime.now(UTC)
    cron_id = uuid4()
    data = payload.model_dump(mode="json")
    cron = {
        "cron_id": str(cron_id),
        "assistant_id": payload.assistant_id,
        "thread_id": str(thread_id or uuid4()),
        "end_time": data.get("end_time"),
        "schedule": payload.schedule,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "user_id": None,
        "payload": data,
        "next_run_date": None,
        "metadata": payload.metadata,
        "enabled": payload.enabled,
    }
    if _repository is not None:
        return await _repository.create(cron)
    with _lock:
        _crons[cron_id] = cron
    return cron


def _matches(cron: dict[str, Any], assistant_id: str | None, thread_id: UUID | None, metadata: dict[str, Any] | None) -> bool:
    if assistant_id is not None and cron["assistant_id"] != assistant_id:
        return False
    if thread_id is not None and cron["thread_id"] != str(thread_id):
        return False
    return not metadata or all(cron.get("metadata", {}).get(k) == v for k, v in metadata.items())


@router.post("/threads/{thread_id}/runs/crons")
async def create_thread_cron(thread_id: UUID, request: ThreadCronCreate) -> dict[str, Any]:
    return await _create(CronCreate(**request.model_dump()), thread_id)


@router.post("/runs/crons")
async def create_cron(request: CronCreate) -> dict[str, Any]:
    return await _create(request)


@router.post("/runs/crons/search", operation_id="search_crons_runs_crons_post")
async def search_crons(request: CronSearch) -> list[dict[str, Any]]:
    if _repository is not None:
        results = await _repository.search(
            assistant_id=request.assistant_id,
            thread_id=request.thread_id,
            enabled=request.enabled,
            metadata=request.metadata,
            limit=request.limit,
            offset=request.offset,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
        )
        if request.select:
            return [{key: cron.get(key) for key in request.select} for cron in results]
        return results
    with _lock:
        results = [c.copy() for c in _crons.values() if _matches(c, request.assistant_id, request.thread_id, request.metadata)]
    if request.enabled is not None:
        results = [c for c in results if c["enabled"] is request.enabled]
    results.sort(key=lambda c: c.get(request.sort_by) or "", reverse=request.sort_order == "desc")
    results = results[request.offset : request.offset + request.limit]
    if request.select:
        results = [{key: cron.get(key) for key in request.select} for cron in results]
    return results


@router.post("/runs/crons/count")
async def count_crons(request: CronCountRequest) -> int:
    if _repository is not None:
        return await _repository.count(
            assistant_id=request.assistant_id,
            thread_id=request.thread_id,
            metadata=request.metadata,
        )
    with _lock:
        return sum(_matches(c, request.assistant_id, request.thread_id, request.metadata) for c in _crons.values())


@router.get("/runs/crons/{cron_id}")
async def get_cron(cron_id: UUID) -> dict[str, Any]:
    if _repository is not None:
        cron = await _repository.get(cron_id)
    else:
        with _lock:
            cron = _crons.get(cron_id)
    if cron is None:
        raise HTTPException(status_code=404, detail="Cron not found")
    return cron


@router.patch("/runs/crons/{cron_id}")
async def patch_cron(cron_id: UUID, request: CronPatch) -> dict[str, Any]:
    changes = request.model_dump(exclude_unset=True, mode="json")
    if _repository is not None:
        cron = await _repository.get(cron_id)
        if cron is None:
            raise HTTPException(status_code=404, detail="Cron not found")
    else:
        with _lock:
            cron = _crons.get(cron_id)
            if cron is None:
                raise HTTPException(status_code=404, detail="Cron not found")
    payload = cron["payload"]
    if "metadata" in changes and changes["metadata"] is not None:
        cron["metadata"] = {**cron.get("metadata", {}), **changes.pop("metadata")}
        payload["metadata"] = cron["metadata"]
    payload.update(changes)
    for key in ("schedule", "end_time", "enabled"):
        if key in changes:
            cron[key] = changes[key]
    cron["updated_at"] = datetime.now(UTC).isoformat()
    if _repository is not None:
        return await _repository.update(cron)
    return cron.copy()


@router.delete("/runs/crons/{cron_id}")
async def delete_cron(cron_id: UUID) -> Response:
    if _repository is not None:
        if not await _repository.delete(cron_id):
            raise HTTPException(status_code=404, detail="Cron not found")
        return Response(status_code=200)
    with _lock:
        if _crons.pop(cron_id, None) is None:
            raise HTTPException(status_code=404, detail="Cron not found")
    return Response(status_code=200)
