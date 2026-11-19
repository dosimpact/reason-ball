"""Single-process graph tasks; subscribers disconnect without cancelling execution."""
from __future__ import annotations

import asyncio
import json
import os
from copy import deepcopy
from collections import deque

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder


class RunManager:
    def __init__(self, runtime, registry):
        self.runtime, self.registry = runtime, registry
        self.max_active = int(os.getenv("LANGGRAPH_MAX_ACTIVE", "10"))
        self.max_queued = int(os.getenv("LANGGRAPH_MAX_QUEUED", "10"))
        if self.max_active < 1 or self.max_queued < 0:
            raise ValueError("Invalid graph execution limits")
        self.slots = asyncio.Semaphore(self.max_active)
        self.tasks = {}
        self.locks = {}
        self.logs = {}
        self.sequences = {}
        self.log_sizes = {}
        self.log_bytes = int(os.getenv("LANGGRAPH_STREAM_BUFFER_BYTES", str(8 * 1024 * 1024)))
        if self.log_bytes < 1024:
            raise ValueError("Stream buffer must be at least 1024 bytes")
        self.conditions = {}
        self.admission = asyncio.Lock()
        self.reserved = set()

    async def recover(self):
        for run in self.runtime.runs.values():
            if run["status"] in {"pending", "running"}:
                run["status"] = "interrupted"
                await self.runtime.persist_run(run)
                thread = self.runtime.threads.get(run["thread_id"])
                if thread:
                    thread["status"] = "interrupted"
                    await self.runtime.persist_thread(thread)

    @staticmethod
    def snapshot_document(snapshot, tid):
        return {"values": jsonable_encoder(snapshot.values), "next": list(snapshot.next),
                "tasks": jsonable_encoder(snapshot.tasks),
                "checkpoint": (snapshot.config or {}).get("configurable", {"thread_id": tid}),
                "parent_checkpoint": (snapshot.parent_config or {}).get("configurable"),
                "metadata": jsonable_encoder(snapshot.metadata or {}),
                "created_at": snapshot.created_at,
                "interrupts": jsonable_encoder(getattr(snapshot, "interrupts", ())) }

    def graph_for_thread(self, tid):
        thread = self.runtime.require_thread(tid)
        gid = thread.get("metadata", {}).get("graph_id")
        if not gid:
            raise HTTPException(409, "Thread has no graph association")
        return self.registry.get(gid)

    async def state(self, tid, checkpoint_id=None, subgraphs=False):
        if not self.runtime.require_thread(tid).get("metadata", {}).get("graph_id"):
            return {"values": {}, "next": [], "tasks": [], "checkpoint": None, "metadata": {}, "interrupts": []}
        config = {"configurable": {"thread_id": tid}}
        if checkpoint_id:
            config["configurable"]["checkpoint_id"] = checkpoint_id
        snapshot = await self.graph_for_thread(tid).aget_state(config, subgraphs=subgraphs)
        if checkpoint_id and not snapshot.created_at:
            raise HTTPException(404, "Checkpoint not found")
        return self.snapshot_document(snapshot, tid)

    async def history(self, tid, limit=10, before=None, metadata=None):
        if not self.runtime.require_thread(tid).get("metadata", {}).get("graph_id"):
            return []
        config = {"configurable": {"thread_id": tid}}
        before_config = {"configurable": {"thread_id": tid, "checkpoint_id": before}} if before else None
        return [self.snapshot_document(s, tid) async for s in self.graph_for_thread(tid).aget_state_history(
            config, filter=metadata, before=before_config, limit=limit)]

    async def update_state(self, tid, values, as_node=None, checkpoint=None):
        if any(r["thread_id"] == tid and r["status"] in {"pending", "running"} for r in self.runtime.runs.values()):
            raise HTTPException(409, "Cannot update state during active execution")
        config = {"configurable": {**(checkpoint or {}), "thread_id": tid}}
        updated = await self.graph_for_thread(tid).aupdate_state(config, values, as_node=as_node)
        snapshot = await self.graph_for_thread(tid).aget_state(updated)
        thread = self.runtime.threads[tid]
        thread["values"] = jsonable_encoder(snapshot.values)
        await self.runtime.persist_thread(thread)
        return self.snapshot_document(snapshot, tid)

    async def create(self, thread_id, payload, wait=False):
        from server.runs.runtime import utc_now
        from uuid import uuid4
        graph, graph_id, assistant = await self.registry.resolve(str(payload["assistant_id"]))
        modes = payload.get("stream_mode", ["values"])
        modes = [modes] if isinstance(modes, str) else modes
        if not isinstance(modes, list) or set(modes) - {"values", "updates", "messages", "messages-tuple", "custom", "debug", "checkpoints", "tasks"}:
            raise HTTPException(422, "Unsupported stream_mode")
        strategy = payload.get("multitask_strategy", "enqueue")
        if strategy not in {"enqueue", "reject"}:
            raise HTTPException(422, "Only enqueue/reject multitask strategies are supported")
        if payload.get("command") is not None:
            raise HTTPException(422, "Resume commands are outside phase 1")
        transient = thread_id is None and payload.get("on_completion", "delete") == "delete"
        if thread_id is None:
            thread_id = (await self.runtime.create_thread_persisted({"metadata": {"graph_id": graph_id}}))["thread_id"]
        else:
            try:
                await self.runtime.ensure_thread(thread_id)
            except HTTPException as error:
                if error.status_code != 404 or payload.get("if_not_exists") != "create":
                    raise
                await self.runtime.create_thread_persisted({"thread_id": thread_id, "metadata": {"graph_id": graph_id}})
        bound_graph = self.runtime.threads[thread_id].get("metadata", {}).get("graph_id")
        if bound_graph and bound_graph != graph_id:
            raise HTTPException(409, "Thread belongs to another graph")
        async with self.admission:
            live = [r for r in self.runtime.runs.values() if r["status"] in {"pending", "running"}]
            same_thread = any(r["thread_id"] == thread_id for r in live)
            immediate = len(self.reserved) < self.max_active and not same_thread
            queued_count = sum(r["run_id"] not in self.reserved for r in live)
            if not immediate and queued_count >= self.max_queued:
                raise HTTPException(429, "Run capacity exceeded", headers={"Retry-After": "1"})
            if strategy == "reject" and any(r["thread_id"] == thread_id for r in live):
                raise HTTPException(409, "Thread already has an active run")
            now = utc_now()
            run = {"run_id": str(uuid4()), "thread_id": thread_id,
                   "assistant_id": str(payload["assistant_id"]), "created_at": now,
                   "updated_at": now, "status": "pending", "metadata": deepcopy(payload.get("metadata") or {}),
                   "kwargs": deepcopy(payload), "multitask_strategy": strategy}
            self.runtime.runs[run["run_id"]] = run
            if immediate:
                self.reserved.add(run["run_id"])
            self.logs[run["run_id"]] = deque()
            self.sequences[run["run_id"]] = 0
            self.log_sizes[run["run_id"]] = 0
            self.conditions[run["run_id"]] = asyncio.Condition()
            thread = self.runtime.threads[thread_id]
            thread["metadata"].setdefault("graph_id", graph_id)
            thread["status"] = "busy"
            await self.runtime.persist_run(run)
            await self.runtime.persist_thread(thread)
            await self.publish(run, "metadata", {"run_id": run["run_id"]})
            self.tasks[run["run_id"]] = asyncio.create_task(self.execute(run, graph, graph_id, assistant, transient))
        if wait:
            await self.join(run["run_id"])
        return run, self.runtime.run_results.get(run["run_id"])

    async def publish(self, run, kind, data):
        rid = run["run_id"]
        log = self.logs[rid]
        encoded = jsonable_encoder(data)
        size = len(json.dumps(encoded, ensure_ascii=False).encode())
        self.sequences[rid] += 1
        log.append((self.sequences[rid], kind, encoded, size))
        self.log_sizes[rid] += size
        while len(log) > 1 and (len(log) > 256 or self.log_sizes[rid] > self.log_bytes):
            self.log_sizes[rid] -= log.popleft()[3]
        async with self.conditions[rid]:
            self.conditions[rid].notify_all()

    async def execute(self, run, graph, graph_id, assistant, transient):
        from server.runs.runtime import utc_now
        payload, tid = run["kwargs"], run["thread_id"]
        try:
            async with self.locks.setdefault(tid, asyncio.Lock()):
                async with self.slots:
                    self.reserved.add(run["run_id"])
                    run["status"] = "running"
                    await self.runtime.persist_run(run)
                    config = deepcopy(assistant.config if assistant else {})
                    incoming = payload.get("config") or {}
                    config = {**config, **incoming, "configurable": {**config.get("configurable", {}), **incoming.get("configurable", {}), "thread_id": tid}, "metadata": {**config.get("metadata", {}), **incoming.get("metadata", {}), "run_id": run["run_id"], "graph_id": graph_id}}
                    context = {**(assistant.context if assistant else {}), **(payload.get("context") or {})}
                    modes = payload.get("stream_mode", ["values"])
                    modes = [modes] if isinstance(modes, str) else modes
                    requested = ["messages" if m == "messages-tuple" else m for m in modes]
                    # Always consume values to persist thread's latest searchable projection.
                    requested = list(dict.fromkeys([*requested, "values"]))
                    nested = bool(payload.get("stream_subgraphs", False))
                    async for chunk in graph.astream(payload.get("input"), config=config,
                            context=context, stream_mode=requested, subgraphs=nested,
                            interrupt_before=payload.get("interrupt_before"), interrupt_after=payload.get("interrupt_after")):
                        if nested:
                            namespace, kind, data = chunk
                        else:
                            kind, data = chunk
                            namespace = ()
                        if kind == "values" and not namespace:
                            self.runtime.run_results[run["run_id"]] = jsonable_encoder(data)
                        if kind in requested and (kind != "values" or "values" in modes):
                            name = "messages-tuple" if kind == "messages" else kind
                            if namespace:
                                name += "|" + "|".join(namespace)
                            await self.publish(run, name, data)
                    snapshot = await graph.aget_state(config)
                    output = jsonable_encoder(snapshot.values)
                    self.runtime.run_results[run["run_id"]] = output
                    thread = self.runtime.threads[tid]
                    thread.update(values=output, state_updated_at=utc_now(), updated_at=utc_now())
                    run["status"] = "interrupted" if snapshot.next else "success"
        except asyncio.CancelledError:
            run["status"] = "interrupted"
        except Exception as error:
            run["status"] = "error"
            run["metadata"]["error"] = str(error)
            await self.publish(run, "error", {"error": type(error).__name__, "message": str(error)})
        finally:
            self.reserved.discard(run["run_id"])
            run["updated_at"] = utc_now()
            thread = self.runtime.threads.get(tid)
            if thread:
                others = any(r["run_id"] != run["run_id"] and r["thread_id"] == tid and r["status"] in {"pending", "running"} for r in self.runtime.runs.values())
                thread["status"] = "busy" if others else ("idle" if run["status"] == "success" else run["status"])
                await self.runtime.persist_thread(thread)
            try:
                await self.runtime.persist_run(run, self.runtime.run_results.get(run["run_id"]))
            finally:
                await self.publish(run, "end", {})
            self.tasks.pop(run["run_id"], None)
            asyncio.get_running_loop().call_later(60, self.expire_log, run["run_id"])
            if transient and thread:
                if self.runtime.thread_repository:
                    await self.runtime.thread_repository.delete(tid)
                self.runtime.threads.pop(tid, None)

    def expire_log(self, rid):
        self.logs.pop(rid, None)
        self.conditions.pop(rid, None)
        self.sequences.pop(rid, None)
        self.log_sizes.pop(rid, None)

    async def join(self, rid):
        task = self.tasks.get(rid)
        if task:
            await asyncio.shield(task)

    async def cancel(self, run):
        task = self.tasks.get(run["run_id"])
        if task and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            # Cancellation before coroutine entry has no finally block.
            if run["status"] in {"pending", "running"}:
                from server.runs.runtime import utc_now
                self.reserved.discard(run["run_id"])
                run.update(status="interrupted", updated_at=utc_now())
                await self.runtime.persist_run(run)
                thread = self.runtime.threads.get(run["thread_id"])
                if thread:
                    thread["status"] = "interrupted"
                    await self.runtime.persist_thread(thread)
                await self.publish(run, "end", {})

    async def stream(self, run):
        rid, index = run["run_id"], 0
        if rid not in self.logs:
            yield "event: metadata\ndata: " + json.dumps({"run_id": rid}) + "\n\n"
            yield "event: values\ndata: " + json.dumps(self.runtime.run_results.get(rid)) + "\n\n"
            yield "event: end\ndata: {}\n\n"
            return
        if self.logs[rid] and self.logs[rid][0][0] > 1:
            yield "event: metadata\ndata: " + json.dumps({"run_id": rid}) + "\n\n"
        while True:
            async with self.conditions[rid]:
                await self.conditions[rid].wait_for(lambda: self.sequences[rid] > index)
                batch = [item for item in self.logs[rid] if item[0] > index]
            if batch and index and batch[0][0] > index + 1:
                yield 'event: error\ndata: {"error":"stream_buffer_gap","message":"Fetch thread state to recover latest values"}\n\n'
                return
            for sequence, kind, data, _size in batch:
                index = sequence
                yield f"id: {index}\nevent: {kind}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                if kind == "end":
                    return

    async def close(self):
        tasks = list(self.tasks.values())
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
