from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import UUID, uuid4

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/a2a", tags=["A2A"])
_tasks: dict[str, dict[str, Any]] = {}


class A2ATaskRepository(Protocol):
    async def save(self, task: dict[str, Any]) -> dict[str, Any]: ...
    async def get(self, task_id: str) -> dict[str, Any] | None: ...


_repository: A2ATaskRepository | None = None


def set_a2a_task_repository(repository: A2ATaskRepository | None) -> None:
    """Select PostgreSQL persistence; ``None`` restores isolated in-memory mode."""
    global _repository
    _repository = repository


def export_state() -> dict[str, Any]:
    return {key: value.copy() for key, value in _tasks.items()}


def import_state(state: dict[str, Any]) -> None:
    _tasks.clear()
    _tasks.update({key: value for key, value in state.items() if isinstance(value, dict)})


def _error(request_id: Any, code: int, message: str, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}})


@router.post("/{assistant_id}", operation_id="post_a2a")
async def post_a2a(assistant_id: UUID, payload: dict[str, Any], accept: str | None = Header(default=None)) -> JSONResponse:
    request_id, method = payload.get("id"), payload.get("method")
    if accept is None:
        return _error(request_id, -32600, "Missing Accept header", 400)
    if payload.get("jsonrpc") != "2.0" or method not in {"message/send", "message/stream", "tasks/get", "tasks/cancel"}:
        return _error(request_id, -32600, "Invalid request", 400)
    params = payload.get("params") or {}
    if method in {"message/send", "message/stream"}:
        if method == "message/stream" and "text/event-stream" not in accept:
            return _error(request_id, -32602, "Accept must include text/event-stream", 400)
        message = params.get("message") or {}
        if not all(key in message for key in ("role", "parts", "messageId")):
            return _error(request_id, -32602, "Missing required message fields")
        task_id = str(uuid4())
        context_id = message.get("contextId") or str(uuid4())
        text = " ".join(part.get("text", "") for part in message["parts"] if part.get("kind") == "text")
        task = {"kind": "task", "id": task_id, "contextId": context_id, "status": {"state": "completed", "timestamp": datetime.now(UTC).isoformat()}, "artifacts": [{"artifactId": str(uuid4()), "name": "Assistant Response", "parts": [{"kind": "text", "text": text}]}], "assistantId": str(assistant_id)}
        if _repository is not None:
            task = await _repository.save(task)
        else:
            _tasks[task_id] = task
        return JSONResponse(content={"jsonrpc": "2.0", "id": request_id, "result": task})
    task_id = params.get("id")
    if method == "tasks/cancel":
        return _error(request_id, -32004, "Task cancellation is not supported")
    if not isinstance(task_id, str):
        return _error(request_id, -32602, "Task id is required")
    task = await _repository.get(task_id) if _repository is not None else _tasks.get(task_id)
    if task is None:
        return _error(request_id, -32001, "Task not found")
    return JSONResponse(content={"jsonrpc": "2.0", "id": request_id, "result": task})
