"""Small runtime shared by the thread, run, and streaming HTTP routers.

The storage boundary is deliberately explicit: production wiring can replace the
executor/checkpointer while the HTTP contract remains independently testable.
"""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Awaitable, Callable
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from langgraph.checkpoint.base.id import uuid6

Executor = Callable[[str, Any, dict[str, Any]], Any | Awaitable[Any]]


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


async def _default_executor(assistant_id: str, value: Any, config: dict[str, Any]) -> Any:
    del assistant_id, config
    return deepcopy(value)


class Runtime:
    """In-process reference implementation with the documented admission policy."""

    max_active = 10
    max_queued = 10

    def __init__(self) -> None:
        self.threads: dict[str, dict[str, Any]] = {}
        self.states: dict[str, list[dict[str, Any]]] = {}
        self.runs: dict[str, dict[str, Any]] = {}
        self.run_results: dict[str, Any] = {}
        self.events: dict[str, list[dict[str, Any]]] = {}
        self.active: set[str] = set()
        self.queued: list[str] = []
        self.executor: Executor = _default_executor
        self.thread_repository: Any = None
        self.run_repository: Any = None
        self.checkpointer: Any = None
        self._lock = asyncio.Lock()

    def reset(self) -> None:
        self.__init__()

    def export_state(self) -> dict[str, Any]:
        return deepcopy(
            {
                "threads": self.threads,
                "states": self.states,
                "runs": self.runs,
                "run_results": self.run_results,
                "events": self.events,
            }
        )

    def import_state(self, state: dict[str, Any]) -> None:
        for name in ("threads", "states", "runs", "run_results", "events"):
            value = state.get(name)
            if isinstance(value, dict):
                setattr(self, name, deepcopy(value))
        self.active = set()
        self.queued = []

    def set_executor(self, executor: Executor) -> None:
        self.executor = executor

    def set_repositories(self, thread_repository: Any = None, run_repository: Any = None) -> None:
        """Inject normalized repositories created from the application's existing pool."""
        self.thread_repository = thread_repository
        self.run_repository = run_repository

    def set_thread_repository(self, repository: Any = None) -> None:
        self.thread_repository = repository

    def set_run_repository(self, repository: Any = None) -> None:
        self.run_repository = repository

    def set_checkpointer(self, checkpointer: Any = None) -> None:
        """Inject AsyncPostgresSaver for checkpoint/history reads after restart."""
        self.checkpointer = checkpointer

    async def hydrate(self) -> None:
        """Rebuild the metadata cache after startup; active coordination is never restored."""
        if self.thread_repository is not None:
            rows = await self.thread_repository.list_all()
            self.threads = {str(row["thread_id"]): self._thread_row(row) for row in rows}
            for thread_id in self.threads:
                self.states.setdefault(thread_id, [])
        if self.run_repository is not None:
            rows = await self.run_repository.list_all()
            self.runs = {}
            for row in rows:
                run, result = self._run_row(row)
                self.runs[run["run_id"]] = run
                if result is not None:
                    self.run_results[run["run_id"]] = result
        self.active = set()
        self.queued = []

    @staticmethod
    def _thread_row(row: dict[str, Any]) -> dict[str, Any]:
        value = dict(row)
        value["thread_id"] = str(value["thread_id"])
        for field in ("created_at", "updated_at", "state_updated_at"):
            if value.get(field) is not None and not isinstance(value[field], str):
                value[field] = value[field].isoformat().replace("+00:00", "Z")
        if value.get("ttl") is None:
            value.pop("ttl", None)
        return value

    @staticmethod
    def _run_row(row: dict[str, Any]) -> tuple[dict[str, Any], Any]:
        value = dict(row)
        result = value.pop("result", None)
        for field in ("run_id", "thread_id", "assistant_id"):
            if value.get(field) is not None:
                value[field] = str(value[field])
        for field in ("created_at", "updated_at"):
            if value.get(field) is not None and not isinstance(value[field], str):
                value[field] = value[field].isoformat().replace("+00:00", "Z")
        return value, result

    async def ensure_thread(self, thread_id: str) -> dict[str, Any]:
        if self.thread_repository is not None:
            row = await self.thread_repository.get(thread_id)
            if row is None:
                self.threads.pop(thread_id, None)
                raise HTTPException(status_code=404, detail="Thread not found")
            thread = self._thread_row(row)
            self.threads[thread_id] = thread
            self.states.setdefault(thread_id, [])
            return thread
        return self.require_thread(thread_id)

    async def get_run(self, thread_id: str, run_id: str) -> dict[str, Any]:
        if self.run_repository is not None:
            row = await self.run_repository.get(run_id)
            if row is None or str(row["thread_id"]) != thread_id:
                raise HTTPException(status_code=404, detail="Run not found")
            run, result = self._run_row(row)
            self.runs[run_id] = run
            if result is not None:
                self.run_results[run_id] = result
            return run
        return self.require_run(thread_id, run_id)

    async def persist_thread(self, thread: dict[str, Any]) -> None:
        if self.thread_repository is not None:
            row = await self.thread_repository.upsert(thread)
            self.threads[thread["thread_id"]] = self._thread_row(row)

    async def persist_run(self, run: dict[str, Any], result: Any = None) -> None:
        if self.run_repository is not None:
            row = await self.run_repository.upsert(run, result)
            normalized, stored_result = self._run_row(row)
            self.runs[run["run_id"]] = normalized
            if stored_result is not None:
                self.run_results[run["run_id"]] = stored_result

    @staticmethod
    def _checkpoint_state(item: Any) -> dict[str, Any]:
        checkpoint = item.checkpoint
        config = dict(item.config.get("configurable") or {})
        channel_values = deepcopy(checkpoint.get("channel_values") or {})
        values = (
            channel_values["__root__"]
            if set(channel_values) == {"__root__"}
            else channel_values
        )
        result: dict[str, Any] = {
            "values": values,
            "next": [],
            "tasks": [],
            "checkpoint": {
                "thread_id": str(config.get("thread_id", "")),
                "checkpoint_ns": config.get("checkpoint_ns", ""),
                "checkpoint_id": str(config.get("checkpoint_id") or checkpoint.get("id", "")),
            },
            "metadata": deepcopy(item.metadata or {}),
            "created_at": checkpoint.get("ts") or utc_now(),
            "interrupts": [],
        }
        if item.parent_config:
            result["parent_checkpoint"] = deepcopy(item.parent_config.get("configurable") or {})
        return result

    async def state_from_storage(
        self, thread_id: str, checkpoint_id: str | None = None
    ) -> dict[str, Any]:
        await self.ensure_thread(thread_id)
        if self.checkpointer is None:
            return self.state(thread_id, checkpoint_id)
        configurable: dict[str, Any] = {"thread_id": thread_id, "checkpoint_ns": ""}
        if checkpoint_id:
            configurable["checkpoint_id"] = checkpoint_id
        item = await self.checkpointer.aget_tuple({"configurable": configurable})
        if item is None:
            if checkpoint_id:
                raise HTTPException(status_code=404, detail="Checkpoint not found")
            return self.state(thread_id)
        return self._checkpoint_state(item)

    async def history_from_storage(
        self, thread_id: str, *, limit: int = 10, before: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        await self.ensure_thread(thread_id)
        if self.checkpointer is None:
            states = list(reversed(self.states.get(thread_id, [])))
            if before:
                index = next(
                    (i for i, state in enumerate(states)
                     if state["checkpoint"]["checkpoint_id"] == before), -1
                )
                states = states[index + 1:] if index >= 0 else []
            if metadata:
                states = [
                    state for state in states
                    if all(state.get("metadata", {}).get(k) == v for k, v in metadata.items())
                ]
            return states[:limit]
        config = {"configurable": {"thread_id": thread_id, "checkpoint_ns": ""}}
        before_config = None
        if before:
            before_config = {
                "configurable": {
                    "thread_id": thread_id, "checkpoint_ns": "", "checkpoint_id": before
                }
            }
        items = self.checkpointer.alist(
            config, filter=metadata or None, before=before_config, limit=limit
        )
        return [self._checkpoint_state(item) async for item in items]

    def require_thread(self, thread_id: str) -> dict[str, Any]:
        thread = self.threads.get(thread_id)
        if thread is None:
            raise HTTPException(status_code=404, detail="Thread not found")
        return thread

    def require_run(self, thread_id: str, run_id: str) -> dict[str, Any]:
        run = self.runs.get(run_id)
        if run is None or run["thread_id"] != thread_id:
            raise HTTPException(status_code=404, detail="Run not found")
        return run

    def create_thread(self, payload: dict[str, Any]) -> dict[str, Any]:
        thread_id = payload.get("thread_id") or str(uuid4())
        if thread_id in self.threads:
            if payload.get("if_exists", "raise") == "do_nothing":
                return self.threads[thread_id]
            raise HTTPException(status_code=409, detail="Thread already exists")
        now = utc_now()
        thread = {
            "thread_id": thread_id,
            "created_at": now,
            "updated_at": now,
            "state_updated_at": now,
            "metadata": deepcopy(payload.get("metadata") or {}),
            "config": {},
            "status": "idle",
            "values": {},
            "interrupts": {},
        }
        if payload.get("ttl"):
            thread["ttl"] = deepcopy(payload["ttl"])
        self.threads[thread_id] = thread
        self.states[thread_id] = []
        for superstep in payload.get("supersteps") or []:
            for update in superstep.get("updates", []):
                self.add_state(thread_id, update.get("values"), update.get("as_node"))
        return thread

    async def create_thread_persisted(self, payload: dict[str, Any]) -> dict[str, Any]:
        requested_id = payload.get("thread_id")
        if requested_id and self.thread_repository is not None:
            existing = await self.thread_repository.get(requested_id)
            if existing is not None:
                thread = self._thread_row(existing)
                self.threads[requested_id] = thread
                if payload.get("if_exists", "raise") == "do_nothing":
                    return thread
                raise HTTPException(status_code=409, detail="Thread already exists")
            self.threads.pop(requested_id, None)
        thread = self.create_thread(payload)
        await self.persist_thread(thread)
        return self.threads[thread["thread_id"]]

    def state(self, thread_id: str, checkpoint_id: str | None = None) -> dict[str, Any]:
        self.require_thread(thread_id)
        history = self.states.get(thread_id, [])
        if checkpoint_id:
            for state in history:
                if state["checkpoint"].get("checkpoint_id") == checkpoint_id:
                    return state
            raise HTTPException(status_code=404, detail="Checkpoint not found")
        if history:
            return history[-1]
        return self._state_document(thread_id, self.threads[thread_id].get("values", {}), None)

    def _state_document(
        self, thread_id: str, values: Any, parent_id: str | None
    ) -> dict[str, Any]:
        checkpoint_id = str(uuid6())
        result: dict[str, Any] = {
            "values": deepcopy(values),
            "next": [],
            "tasks": [],
            "checkpoint": {
                "thread_id": thread_id,
                "checkpoint_ns": "",
                "checkpoint_id": checkpoint_id,
            },
            "metadata": {},
            "created_at": utc_now(),
            "interrupts": [],
        }
        if parent_id:
            result["parent_checkpoint"] = {
                "thread_id": thread_id,
                "checkpoint_ns": "",
                "checkpoint_id": parent_id,
            }
        return result

    def add_state(self, thread_id: str, values: Any, as_node: str | None = None) -> dict[str, Any]:
        thread = self.require_thread(thread_id)
        previous = self.states[thread_id][-1] if self.states[thread_id] else None
        current = deepcopy(thread.get("values", {}))
        if isinstance(current, dict) and isinstance(values, dict):
            current.update(deepcopy(values))
        else:
            current = deepcopy(values)
        parent_id = previous["checkpoint"]["checkpoint_id"] if previous else None
        state = self._state_document(thread_id, current, parent_id)
        if as_node:
            state["metadata"]["source"] = as_node
        self.states[thread_id].append(state)
        now = utc_now()
        thread.update(values=deepcopy(current), state_updated_at=now, updated_at=now)
        self.emit(thread_id, "values", current)
        return state

    async def add_state_persisted(
        self, thread_id: str, values: Any, as_node: str | None = None,
        checkpoint: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update normalized values and persist the exact returned checkpoint ID."""
        await self.ensure_thread(thread_id)
        state = self.add_state(thread_id, values, as_node)
        if self.checkpointer is not None:
            parent = checkpoint or (
                state.get("parent_checkpoint") if state.get("parent_checkpoint") else None
            )
            configurable: dict[str, Any] = {
                "thread_id": thread_id,
                "checkpoint_ns": (parent or {}).get("checkpoint_ns", ""),
            }
            parent_checkpoint_id = (parent or {}).get("checkpoint_id")
            if parent_checkpoint_id:
                configurable["checkpoint_id"] = parent_checkpoint_id
            checkpoint_id = state["checkpoint"]["checkpoint_id"]
            state_values = deepcopy(state["values"])
            if isinstance(state_values, dict):
                channel_values = state_values
            else:
                channel_values = {"__root__": state_values}
            new_versions = {name: checkpoint_id for name in channel_values}
            saver_checkpoint = {
                "v": 1,
                "ts": state["created_at"],
                "id": checkpoint_id,
                "channel_values": channel_values,
                "channel_versions": deepcopy(new_versions),
                "versions_seen": {},
                "pending_sends": [],
            }
            saved_config = await self.checkpointer.aput(
                {"configurable": configurable},
                saver_checkpoint,
                {
                    "source": as_node or "update",
                    "step": len(self.states.get(thread_id, [])) - 1,
                    "parents": {},
                },
                new_versions,
            )
            saved = saved_config.get("configurable") or {}
            canonical_id = str(saved.get("checkpoint_id") or checkpoint_id)
            state["checkpoint"] = {
                "thread_id": thread_id,
                "checkpoint_ns": saved.get("checkpoint_ns", configurable["checkpoint_ns"]),
                "checkpoint_id": canonical_id,
            }
            # Keep the in-process index aligned if a saver canonicalizes the ID.
            self.states[thread_id][-1]["checkpoint"] = deepcopy(state["checkpoint"])
        await self.persist_thread(self.threads[thread_id])
        return state

    def emit(self, thread_id: str, method: str, data: Any) -> dict[str, Any]:
        entries = self.events.setdefault(thread_id, [])
        seq = len(entries) + 1
        event = {
            "type": "event",
            "event_id": str(seq),
            "seq": seq,
            "method": method,
            "params": {"namespace": [], "timestamp": int(datetime.now(UTC).timestamp() * 1000), "data": data},
        }
        entries.append(event)
        return event

    async def create_run(
        self, thread_id: str | None, payload: dict[str, Any], *, wait: bool = False
    ) -> tuple[dict[str, Any], Any]:
        if thread_id is None:
            thread = await self.create_thread_persisted({})
            thread_id = thread["thread_id"]
            transient = payload.get("on_completion", "delete") == "delete"
        else:
            try:
                await self.ensure_thread(thread_id)
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
                if payload.get("if_not_exists", "reject") == "create":
                    await self.create_thread_persisted({"thread_id": thread_id})
                else:
                    raise
            transient = False

        strategy = payload.get("multitask_strategy", "enqueue")
        existing = [
            item for item in self.runs.values()
            if item["thread_id"] == thread_id and item["status"] in {"pending", "running"}
        ]
        if existing and strategy == "reject":
            raise HTTPException(status_code=409, detail="Thread already has an active run")

        async with self._lock:
            admitted = len(self.active) < self.max_active
            if not admitted and len(self.queued) >= self.max_queued:
                raise HTTPException(status_code=429, detail="Run capacity exceeded")
            run_id = str(uuid4())
            now = utc_now()
            run = {
                "run_id": run_id,
                "thread_id": thread_id,
                "assistant_id": str(payload["assistant_id"]),
                "created_at": now,
                "updated_at": now,
                "status": "running" if admitted else "pending",
                "metadata": deepcopy(payload.get("metadata") or {}),
                "kwargs": deepcopy(payload),
                "multitask_strategy": strategy,
            }
            self.runs[run_id] = run
            (self.active.add(run_id) if admitted else self.queued.append(run_id))
        assert thread_id is not None
        self.require_thread(thread_id)["status"] = "busy"
        self.emit(thread_id, "metadata", {"run_id": run_id, "status": run["status"]})
        await self.persist_thread(self.threads[thread_id])
        await self.persist_run(run)

        # A private test/adapter flag represents a long-lived external worker.
        if payload.get("_hold"):
            return run, None
        result = await self.complete_run(run_id, payload.get("input"), transient=transient)
        return run, result if wait else None

    async def complete_run(self, run_id: str, value: Any, *, transient: bool = False) -> Any:
        run = self.runs[run_id]
        try:
            output = self.executor(run["assistant_id"], value, run["kwargs"].get("config") or {})
            if inspect.isawaitable(output):
                output = await output
            self.run_results[run_id] = deepcopy(output)
            await self.add_state_persisted(run["thread_id"], output, "run")
            run["status"] = "success"
        except Exception as exc:  # runtime boundary translates graph failures into run state
            run["status"] = "error"
            run["metadata"]["error"] = str(exc)
            output = {"error": str(exc)}
        finally:
            run["updated_at"] = utc_now()
            self.active.discard(run_id)
            if run_id in self.queued:
                self.queued.remove(run_id)
            thread = self.threads.get(run["thread_id"])
            if thread:
                thread["status"] = "idle" if run["status"] == "success" else "error"
            self.emit(run["thread_id"], "metadata", {"run_id": run_id, "status": run["status"]})
            await self.persist_run(run, self.run_results.get(run_id))
            if thread is not None:
                await self.persist_thread(thread)
        if transient:
            # Keep the internal result through this response but do not retain thread state.
            self.threads.pop(run["thread_id"], None)
            self.states.pop(run["thread_id"], None)
            if self.run_repository is not None:
                await self.run_repository.delete(run_id)
            if self.thread_repository is not None:
                await self.thread_repository.delete(run["thread_id"])
        return output

    async def cancel(self, run: dict[str, Any]) -> None:
        if run["status"] in {"pending", "running"}:
            run.update(status="interrupted", updated_at=utc_now())
            self.active.discard(run["run_id"])
            if run["run_id"] in self.queued:
                self.queued.remove(run["run_id"])
            thread = self.threads.get(run["thread_id"])
            if thread:
                thread["status"] = "interrupted"
            self.emit(run["thread_id"], "metadata", {"run_id": run["run_id"], "status": "interrupted"})
            await self.persist_run(run, self.run_results.get(run["run_id"]))
            if thread:
                await self.persist_thread(thread)


runtime = Runtime()
