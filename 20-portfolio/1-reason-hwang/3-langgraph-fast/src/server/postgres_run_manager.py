"""PostgreSQL-owned execution; process memory holds tasks only, never authority."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from psycopg.types.json import Jsonb

from infrastructure.postgres.fenced_saver import (
    CheckpointAuthority,
    CheckpointOwnershipLost,
    checkpoint_authority,
)
from server.run_manager import RunManager


def execution_version():
    explicit = os.getenv("LANGGRAPH_EXECUTION_VERSION")
    if explicit:
        if len(explicit) > 128:
            raise ValueError("Execution version exceeds 128 characters")
        return explicit
    root = Path(__file__).resolve().parents[2]
    digest = hashlib.sha256()
    for path in sorted((root / "src").rglob("*")):
        if (
            path.is_file()
            and path.suffix in {".py", ".txt"}
            and "__pycache__" not in path.parts
        ):
            digest.update(str(path.relative_to(root)).encode())
            digest.update(path.read_bytes())
    for name in ("langgraph.json", "uv.lock"):
        digest.update((root / name).read_bytes())
    for name in ("OPENAI_MODEL", "SEC_CHAT_MODEL", "OPEN_UI_MODEL", "OPENUI_MODEL"):
        digest.update((name + "=" + os.getenv(name, "")).encode())
    return digest.hexdigest()


logger = logging.getLogger(__name__)


class PostgresRunManager(RunManager):
    durable = True

    def __init__(self, runtime, registry, queue):
        self.runtime, self.registry, self.queue = runtime, registry, queue
        self.tasks = {}
        self.owner_id = str(uuid4())
        self.version = execution_version()
        self.poll = float(os.getenv("LANGGRAPH_POLL_SECONDS", "1"))
        self.heartbeat_seconds = float(os.getenv("LANGGRAPH_HEARTBEAT_SECONDS", "5"))
        self.local_limit = int(
            os.getenv("LANGGRAPH_WORKER_MAX_ACTIVE", str(queue.max_active))
        )
        self.drain_seconds = float(os.getenv("LANGGRAPH_DRAIN_SECONDS", "10"))
        if (
            not 0.05 <= self.poll <= 10
            or self.local_limit < 1
            or not 0.1 <= self.heartbeat_seconds < queue.lease_seconds / 2
        ):
            raise ValueError("Invalid runtime poll/heartbeat/local task limit")
        self.stopping = False
        self.db_failed = False
        self.dispatcher = None
        self.listener = None
        self.listener_connected = False
        self.wake = asyncio.Event()

    async def recover(self):
        await self.queue.verify()
        await self.queue.worker(self.owner_id, self.version)
        self.dispatcher = asyncio.create_task(self.dispatch())
        if os.getenv("LANGGRAPH_RUNTIME_LISTEN", "true").lower() == "true":
            self.listener = asyncio.create_task(self.listen())

    async def listen(self):
        import psycopg

        while not self.stopping:
            try:
                async with await psycopg.AsyncConnection.connect(
                    self.queue.pool.conninfo, autocommit=True
                ) as conn:
                    await conn.execute("LISTEN langgraph_runtime_events")
                    self.listener_connected = True
                    self.wake.set()
                    self.queue.events.notify_all()
                    async for _notice in conn.notifies():
                        self.wake.set()
                        self.queue.events.notify(_notice.payload)
                        if self.stopping:
                            break
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - runtime authority boundary
                self.listener_connected = False
                await asyncio.sleep(self.poll)
            finally:
                self.listener_connected = False

    async def dispatch(self):
        ticks = 0
        while not self.stopping:
            try:
                await self.queue.worker(self.owner_id, self.version)
                await self.queue.reap()
                await self.queue.demote_unavailable_versions()
                while len(self.tasks) < self.local_limit and not self.stopping:
                    run = await self.queue.claim(self.owner_id, self.version)
                    if not run:
                        break
                    rid = str(run["run_id"])
                    self.tasks[rid] = asyncio.create_task(self.execute_owned(run))
                ticks += 1
                if ticks % 10 == 0:
                    await self.queue.events.prune()
                    await self.cleanup_transient()
                self.db_failed = False
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - runtime authority boundary
                # No DB authority means no new work and no checkpoint writes.
                self.db_failed = True
                for task in list(self.tasks.values()):
                    task.cancel()
            self.wake.clear()
            try:
                await asyncio.wait_for(self.wake.wait(), timeout=self.poll)
            except TimeoutError:
                pass

    async def create_thread(self, payload):
        from uuid import UUID

        if payload.get("supersteps"):
            raise HTTPException(
                422, "Thread supersteps are not supported in durable mode"
            )
        try:
            tid = (
                str(UUID(payload["thread_id"]))
                if payload.get("thread_id")
                else str(uuid4())
            )
        except (ValueError, TypeError) as error:
            raise HTTPException(422, "Invalid thread ID") from error
        metadata = dict(payload.get("metadata") or {})
        if payload.get("graph_id"):
            if metadata.get("graph_id") not in (None, payload["graph_id"]):
                raise HTTPException(409, "Conflicting graph association")
            metadata["graph_id"] = payload["graph_id"]
        if metadata.get("graph_id"):
            self.registry.get(metadata["graph_id"])
        async with self.queue.pool.connection() as conn:
            row = await (
                await conn.execute(
                    "INSERT INTO threads(thread_id,created_at,updated_at,state_updated_at,metadata,config,status,values,interrupts,ttl) VALUES(%s,clock_timestamp(),clock_timestamp(),clock_timestamp(),%s,'{}','idle','{}','{}',%s) ON CONFLICT(thread_id) DO NOTHING RETURNING *",
                    (tid, Jsonb(metadata), Jsonb(payload.get("ttl"))),
                )
            ).fetchone()
            if not row:
                if payload.get("if_exists", "raise") != "do_nothing":
                    raise HTTPException(409, "Thread already exists")
                row = await (
                    await conn.execute(
                        "SELECT * FROM threads WHERE thread_id=%s", (tid,)
                    )
                ).fetchone()
        return self.runtime._thread_row(dict(row))

    async def create(self, thread_id, payload, wait=False):
        if self.stopping or self.db_failed:
            raise HTTPException(503, "Runtime has no database execution authority")
        if any(key.startswith("_runtime_") for key in payload):
            raise HTTPException(422, "Reserved runtime fields are server-owned")
        graph, gid, assistant = await self.registry.resolve(
            str(payload["assistant_id"])
        )
        del graph
        modes = payload.get("stream_mode", ["values"])
        modes = [modes] if isinstance(modes, str) else modes
        if (
            not isinstance(modes, list)
            or not all(isinstance(m, str) for m in modes)
            or set(modes)
            - {
                "values",
                "updates",
                "messages",
                "messages-tuple",
                "custom",
                "debug",
                "checkpoints",
                "tasks",
            }
        ):
            raise HTTPException(422, "Unsupported stream_mode")
        if (
            payload.get("multitask_strategy", "enqueue") not in {"enqueue", "reject"}
            or payload.get("command") is not None
        ):
            raise HTTPException(422, "Unsupported multitask/resume command")
        if payload.get("on_disconnect", "continue") != "continue":
            raise HTTPException(
                422, "Disconnect cancellation is not supported; use explicit cancel"
            )
        original = deepcopy(payload)
        saved = deepcopy(payload)
        base = deepcopy(assistant.config if assistant else {})
        requested = payload.get("config") or {}
        saved["_runtime_config"] = {
            **base,
            **requested,
            "configurable": {
                **base.get("configurable", {}),
                **requested.get("configurable", {}),
            },
        }
        saved["_runtime_context"] = {
            **(assistant.context if assistant else {}),
            **(payload.get("context") or {}),
        }
        saved["_runtime_transient"] = (
            thread_id is None and payload.get("on_completion", "delete") == "delete"
        )
        risk = gid not in getattr(self.registry, "read_only_graphs", set())
        try:
            row = await self.queue.enqueue(
                thread_id,
                saved,
                gid,
                self.version,
                payload.get("request_id"),
                original,
                risk,
            )
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(503, "Database admission is unavailable") from error
        self.wake.set()
        if wait:
            result = await self.join(str(row["run_id"]))
            row = await self.raw_run(str(row["run_id"]))
        else:
            result = None
        return self.public_run(row), result

    @staticmethod
    def public_run(row):
        encoded = jsonable_encoder(dict(row))
        result = {
            key: encoded[key]
            for key in (
                "run_id",
                "thread_id",
                "assistant_id",
                "created_at",
                "updated_at",
                "status",
                "metadata",
                "kwargs",
                "multitask_strategy",
            )
            if key in encoded
        }
        result["kwargs"] = {
            k: v
            for k, v in result.get("kwargs", {}).items()
            if not k.startswith("_runtime_")
        }
        if row.get("cancel_requested_at"):
            result["cancel_requested"] = True
        return result

    async def raw_run(self, rid):
        async with self.queue.pool.connection() as conn:
            row = await (
                await conn.execute(
                    "SELECT * FROM runs WHERE run_id=%s AND runtime_namespace=%s",
                    (rid, self.queue.namespace),
                )
            ).fetchone()
        if not row:
            raise HTTPException(404, "Run not found")
        return dict(row)

    async def monitor(self, run, task):
        try:
            while True:
                await asyncio.sleep(self.heartbeat_seconds)
                owned = await asyncio.wait_for(
                    self.queue.heartbeat(run), timeout=self.heartbeat_seconds
                )
                if not owned:
                    task.cancel()
                    return
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - runtime authority boundary
            task.cancel()

    async def execute_owned(self, run):
        rid, tid = str(run["run_id"]), str(run["thread_id"])
        status, result, error = "interrupted", None, None
        events = asyncio.Queue(maxsize=256)
        task = asyncio.current_task()
        assert task is not None
        monitor = asyncio.create_task(self.monitor(run, task))

        async def write_events():
            while True:
                first = await events.get()
                if first is None:
                    return
                batch = [first]
                deadline = asyncio.get_running_loop().time() + 0.05
                stop = False
                while len(batch) < 32:
                    remaining = deadline - asyncio.get_running_loop().time()
                    if remaining <= 0:
                        break
                    try:
                        item = await asyncio.wait_for(events.get(), remaining)
                    except TimeoutError:
                        break
                    if item is None:
                        stop = True
                        break
                    batch.append(item)
                await self.queue.publish(run, batch)
                if stop:
                    return

        writer = asyncio.create_task(write_events())

        def writer_failed(done):
            if not done.cancelled() and done.exception() is not None:
                task.cancel()

        writer.add_done_callback(writer_failed)
        try:
            authority = CheckpointAuthority(
                tid, rid, self.owner_id, run["execution_epoch"]
            )
            with checkpoint_authority(authority):
                graph = self.registry.get(run["graph_id"])
                payload = run["kwargs"]
                config = deepcopy(payload["_runtime_config"])
                config["configurable"] = {
                    **config.get("configurable", {}),
                    "thread_id": tid,
                }
                config["metadata"] = {
                    **config.get("metadata", {}),
                    "run_id": rid,
                    "graph_id": run["graph_id"],
                }
                modes = payload.get("stream_mode", ["values"])
                modes = [modes] if isinstance(modes, str) else modes
                requested = list(
                    dict.fromkeys(
                        [
                            *(
                                "messages" if m == "messages-tuple" else m
                                for m in modes
                            ),
                            "values",
                        ]
                    )
                )
                nested = bool(payload.get("stream_subgraphs", False))
                async for chunk in graph.astream(
                    payload.get("input"),
                    config=config,
                    context=payload["_runtime_context"],
                    stream_mode=requested,
                    subgraphs=nested,
                    interrupt_before=payload.get("interrupt_before"),
                    interrupt_after=payload.get("interrupt_after"),
                ):
                    namespace, kind, data = chunk if nested else ((), *chunk)
                    if kind != "values" or "values" in modes:
                        name = "messages-tuple" if kind == "messages" else kind
                        if namespace:
                            name += "|" + "|".join(namespace)
                        await events.put((name, jsonable_encoder(data)))
                await events.put(None)
                await writer
                snapshot = await graph.aget_state(config)
                result = jsonable_encoder(snapshot.values)
                if len(json.dumps(result).encode()) > int(
                    os.getenv("LANGGRAPH_MAX_RESULT_BYTES", str(64 * 1024 * 1024))
                ):
                    raise ValueError("Final result exceeds runtime result size limit")
                status = "interrupted" if snapshot.next else "success"
        except asyncio.CancelledError:
            status = "interrupted"
            if writer.done() and not writer.cancelled() and writer.exception():
                error = str(writer.exception())
        except Exception as exc:  # noqa: BLE001 - graph execution boundary
            status = "error"
            error = str(exc)
        finally:
            monitor.cancel()
            writer.cancel()
            await asyncio.gather(monitor, writer, return_exceptions=True)
            try:
                await self.queue.finish(run, status, result, error)
            except Exception:  # noqa: BLE001 - runtime authority boundary
                # Expired/revoked owners never publish a late terminal result.
                # The durable lease reaper alone settles an abandoned execution.
                logger.warning(
                    "Terminal commit was fenced or database authority unavailable",
                    extra={"run_id": rid},
                )
            self.tasks.pop(rid, None)
            self.wake.set()

    async def join(self, rid):
        while True:
            row = await self.raw_run(rid)
            if row["internal_status"] == "terminal":
                return row["result"]
            await asyncio.sleep(min(self.poll, 0.25))

    async def cancel(self, run, wait=False):
        rid = str(run["run_id"])
        row = await self.queue.cancel(rid)
        self.wake.set()
        if wait and row["internal_status"] != "terminal":
            try:
                await asyncio.wait_for(
                    self.join(rid),
                    timeout=float(os.getenv("LANGGRAPH_CANCEL_WAIT_SECONDS", "10")),
                )
            except TimeoutError:
                pass
            row = await self.raw_run(rid)
        run.clear()
        run.update(self.public_run(row))
        return run

    async def stream(self, run, cursor=0):
        async for item in self.queue.events.stream(str(run["run_id"]), cursor):
            yield item

    async def update_state(self, tid, values, as_node=None, checkpoint=None):
        await self.runtime.ensure_thread(tid)
        async with (
            self.queue.control(tid) as (conn, authority),
            _authority_async(authority),
        ):
            config = {"configurable": {**(checkpoint or {}), "thread_id": tid}}
            updated = await self.graph_for_thread(tid).aupdate_state(
                config, values, as_node=as_node
            )
            snapshot = await self.graph_for_thread(tid).aget_state(updated)
            await conn.execute(
                "UPDATE threads SET values=%s,state_updated_at=clock_timestamp(),updated_at=clock_timestamp() WHERE thread_id=%s",
                (Jsonb(jsonable_encoder(snapshot.values)), tid),
            )
        return self.snapshot_document(snapshot, tid)

    async def delete_thread(self, tid, automatic=False):
        await self.runtime.ensure_thread(tid)
        async with (
            self.queue.control(tid) as (conn, authority),
            _authority_async(authority),
        ):
            if automatic:
                keyed = await (
                    await conn.execute(
                        "SELECT 1 FROM runs WHERE thread_id=%s AND request_key IS NOT NULL LIMIT 1",
                        (tid,),
                    )
                ).fetchone()
                if keyed:
                    return False
            await self.registry.checkpointer.adelete_thread(tid)
            await conn.execute("DELETE FROM runs WHERE thread_id=%s", (tid,))
            await conn.execute("DELETE FROM threads WHERE thread_id=%s", (tid,))
        self.runtime.threads.pop(tid, None)

    async def delete_run(self, tid, rid):
        await self.runtime.ensure_thread(tid)
        async with self.queue.control(tid) as (conn, _authority):
            await conn.execute(
                "DELETE FROM runs WHERE thread_id=%s AND run_id=%s", (tid, rid)
            )

    async def patch_thread(self, tid, payload):
        await self.runtime.ensure_thread(tid)
        async with self.queue.control(tid) as (conn, _authority):
            row = await (
                await conn.execute(
                    "SELECT metadata FROM threads WHERE thread_id=%s FOR UPDATE", (tid,)
                )
            ).fetchone()
            incoming = payload.get("metadata") or {}
            if "graph_id" in incoming and incoming["graph_id"] != row["metadata"].get(
                "graph_id"
            ):
                raise HTTPException(409, "Thread graph association is immutable")
            await conn.execute(
                "UPDATE threads SET metadata=metadata || %s,updated_at=clock_timestamp() WHERE thread_id=%s",
                (Jsonb(incoming), tid),
            )
            if "ttl" in payload:
                await conn.execute(
                    "UPDATE threads SET ttl=%s WHERE thread_id=%s",
                    (Jsonb(payload["ttl"]), tid),
                )
        return await self.runtime.ensure_thread(tid)

    async def cleanup_transient(self):
        async with self.queue.pool.connection() as conn:
            rows = await (
                await conn.execute(
                    "SELECT thread_id FROM runs WHERE runtime_namespace=%s AND internal_status='terminal' AND kwargs->>'_runtime_transient'='true' AND request_key IS NULL AND updated_at<clock_timestamp()-interval '60 seconds' LIMIT 20",
                    (self.queue.namespace,),
                )
            ).fetchall()
        for row in rows:
            try:
                await self.delete_thread(str(row["thread_id"]), automatic=True)
            except (HTTPException, CheckpointOwnershipLost):
                pass

    async def close(self):
        self.stopping = True
        self.queue.events.close()
        try:
            await self.queue.worker(self.owner_id, self.version, draining=True)
        except Exception:  # noqa: BLE001 - runtime authority boundary
            self.db_failed = True
        if self.dispatcher:
            self.dispatcher.cancel()
        if self.listener:
            self.listener.cancel()
        tasks = list(self.tasks.values())
        if tasks:
            try:
                await asyncio.wait_for(
                    asyncio.shield(asyncio.gather(*tasks, return_exceptions=True)),
                    self.drain_seconds,
                )
            except TimeoutError:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.gather(
            *(t for t in (self.dispatcher, self.listener) if t), return_exceptions=True
        )


@asynccontextmanager
async def _authority_async(authority):
    with checkpoint_authority(authority):
        yield
