"""Durable multi-worker admission/ownership. Never execute a graph in a DB tx."""

from __future__ import annotations

import hashlib
import json
import re
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import HTTPException
from psycopg.types.json import Jsonb

from infrastructure.postgres.fenced_saver import CheckpointOwnershipLost
from infrastructure.postgres.runtime_events import RuntimeEvents

DDL = (
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS runtime_namespace text",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS internal_status text",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS graph_id text",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS graph_version text",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS queue_seq bigserial",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS owner_id uuid",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS execution_epoch bigint NOT NULL DEFAULT 0",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS lease_until timestamptz",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS request_key text",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS request_hash text",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS side_effect_risk boolean NOT NULL DEFAULT false",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS event_seq bigint NOT NULL DEFAULT 0",
    "ALTER TABLE runs ADD COLUMN IF NOT EXISTS event_bytes bigint NOT NULL DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS runtime_capacity(namespace text PRIMARY KEY,max_active integer NOT NULL CHECK(max_active>0),max_queued integer NOT NULL CHECK(max_queued>=0))",
    "CREATE TABLE IF NOT EXISTS runtime_threads(thread_id uuid PRIMARY KEY REFERENCES threads(thread_id) ON DELETE CASCADE,active_run_id uuid,epoch bigint NOT NULL DEFAULT 0,blocked_reason text)",
    "CREATE TABLE IF NOT EXISTS runtime_workers(worker_id uuid PRIMARY KEY,namespace text NOT NULL,graph_version text NOT NULL,heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),draining boolean NOT NULL DEFAULT false)",
    "CREATE TABLE IF NOT EXISTS runtime_events(run_id uuid NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,sequence bigint NOT NULL,execution_epoch bigint NOT NULL,event text NOT NULL,namespace text[] NOT NULL DEFAULT '{}',payload jsonb NOT NULL,size_bytes integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(run_id,sequence))",
    "CREATE UNIQUE INDEX IF NOT EXISTS runtime_request_key ON runs(runtime_namespace,request_key) WHERE request_key IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS runtime_one_active_thread ON runs(thread_id) WHERE internal_status IN ('reserved','running','cancelling')",
    "CREATE INDEX IF NOT EXISTS runtime_pending ON runs(runtime_namespace,graph_version,queue_seq) WHERE internal_status IN ('queued','reserved')",
    "CREATE INDEX IF NOT EXISTS runtime_thread_fifo ON runs(thread_id,queue_seq) WHERE internal_status IN ('queued','reserved','running','cancelling')",
    "CREATE INDEX IF NOT EXISTS runtime_leases ON runs(runtime_namespace,lease_until) WHERE internal_status IN ('running','cancelling')",
    "CREATE INDEX IF NOT EXISTS runtime_terminal ON runs(runtime_namespace,updated_at) WHERE internal_status='terminal'",
)


async def migrate_runtime_queue(
    connection, namespace="fastapi", max_active=10, max_queued=10
):
    """Deployment-only additive migration, explicitly invoked once before workers."""
    async with connection.transaction():
        await connection.execute("SELECT pg_advisory_xact_lock(1794816001)")
        for statement in DDL:
            await connection.execute(statement)
        await connection.execute(
            "INSERT INTO runtime_capacity VALUES(%s,%s,%s) ON CONFLICT(namespace) DO NOTHING",
            (namespace, max_active, max_queued),
        )


class RuntimeQueue:
    def __init__(
        self,
        pool,
        namespace="fastapi",
        max_active=10,
        max_queued=10,
        lease_seconds: float = 30,
    ):
        self.pool, self.namespace = pool, namespace
        self.max_active, self.max_queued = max_active, max_queued
        self.lease_seconds = lease_seconds
        self.events = RuntimeEvents(pool, namespace)

    @staticmethod
    async def ensure_lease_deadline(conn, deadline):
        row = await (
            await conn.execute(
                "SELECT %s::timestamptz>clock_timestamp() AS valid", (deadline,)
            )
        ).fetchone()
        if not row or not row["valid"]:
            raise CheckpointOwnershipLost("Execution lease expired during transaction")

    async def verify(self):
        async with self.pool.connection() as conn:
            row = await (
                await conn.execute(
                    "SELECT * FROM runtime_capacity WHERE namespace=%s",
                    (self.namespace,),
                )
            ).fetchone()
            if (
                not row
                or row["max_active"] != self.max_active
                or row["max_queued"] != self.max_queued
            ):
                raise RuntimeError(
                    "Runtime migration/capacity configuration mismatch; run deployment migration first"
                )
            await conn.execute("SELECT owner_id,event_seq FROM runs LIMIT 0")
            await conn.execute("SELECT active_run_id FROM runtime_threads LIMIT 0")
            for table in (
                "runtime_workers",
                "runtime_events",
                "checkpoints",
                "checkpoint_blobs",
                "checkpoint_writes",
            ):
                await conn.execute(f"SELECT 1 FROM {table} LIMIT 0")
            legacy = await (
                await conn.execute(
                    "SELECT count(*) AS n FROM runs WHERE internal_status IS NULL AND status IN ('pending','running')"
                )
            ).fetchone()
            if legacy["n"]:
                raise RuntimeError(
                    "Drain or explicitly reconcile legacy memory workers before enabling PostgreSQL runtime"
                )

    @asynccontextmanager
    async def transaction(self, tid=None):
        async with self.pool.connection() as conn, conn.transaction():
            await conn.execute("SET LOCAL lock_timeout='5s'")
            capacity = await (
                await conn.execute(
                    "SELECT * FROM runtime_capacity WHERE namespace=%s FOR UPDATE",
                    (self.namespace,),
                )
            ).fetchone()
            if (
                not capacity
                or capacity["max_active"] != self.max_active
                or capacity["max_queued"] != self.max_queued
            ):
                raise RuntimeError(
                    "Runtime capacity authority is unavailable or incompatible"
                )
            if tid:
                await conn.execute(
                    "INSERT INTO runtime_threads(thread_id) VALUES(%s) ON CONFLICT DO NOTHING",
                    (tid,),
                )
                await conn.execute(
                    "SELECT thread_id FROM runtime_threads WHERE thread_id=%s FOR UPDATE",
                    (tid,),
                )
            yield conn

    async def worker(self, owner, version, draining=False):
        async with self.pool.connection() as conn:
            await conn.execute(
                "INSERT INTO runtime_workers(worker_id,namespace,graph_version,draining) VALUES(%s,%s,%s,%s) ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at=clock_timestamp(),draining=EXCLUDED.draining",
                (owner, self.namespace, version, draining),
            )

    async def enqueue(
        self,
        tid,
        payload,
        graph_id,
        version,
        request_key=None,
        request_payload=None,
        risk=False,
    ):
        if request_key is not None and not re.fullmatch(
            r"[A-Za-z0-9._:-]{1,128}", request_key
        ):
            raise HTTPException(422, "Invalid request_id/idempotency key")
        digest = hashlib.sha256(
            json.dumps(
                [tid, request_payload or payload], sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
        rid = str(uuid4())
        async with self.transaction() as conn:
            if request_key:
                previous = await (
                    await conn.execute(
                        "SELECT * FROM runs WHERE runtime_namespace=%s AND request_key=%s",
                        (self.namespace, request_key),
                    )
                ).fetchone()
                if previous:
                    if previous["request_hash"] != digest:
                        raise HTTPException(
                            409, "Idempotency key has another request payload"
                        )
                    return dict(previous)
            if tid is None:
                tid = str(uuid4())
                await conn.execute(
                    "INSERT INTO threads(thread_id,created_at,updated_at,state_updated_at,metadata,config,status,values,interrupts) VALUES(%s,clock_timestamp(),clock_timestamp(),clock_timestamp(),%s,'{}','idle','{}','{}')",
                    (tid, Jsonb({"graph_id": graph_id})),
                )
            thread = await (
                await conn.execute("SELECT * FROM threads WHERE thread_id=%s", (tid,))
            ).fetchone()
            if not thread:
                if payload.get("if_not_exists") != "create":
                    raise HTTPException(404, "Thread not found")
                await conn.execute(
                    "INSERT INTO threads(thread_id,created_at,updated_at,state_updated_at,metadata,config,status,values,interrupts) VALUES(%s,clock_timestamp(),clock_timestamp(),clock_timestamp(),%s,'{}','idle','{}','{}')",
                    (tid, Jsonb({"graph_id": graph_id})),
                )
                thread = {"metadata": {"graph_id": graph_id}}
            bound = (thread["metadata"] or {}).get("graph_id")
            if bound and bound != graph_id:
                raise HTTPException(409, "Thread belongs to another graph")
            await conn.execute(
                "INSERT INTO runtime_threads(thread_id) VALUES(%s) ON CONFLICT DO NOTHING",
                (tid,),
            )
            control = await (
                await conn.execute(
                    "SELECT * FROM runtime_threads WHERE thread_id=%s FOR UPDATE",
                    (tid,),
                )
            ).fetchone()
            if control["blocked_reason"]:
                raise HTTPException(
                    409,
                    {
                        "code": "thread_review_required",
                        "reason": control["blocked_reason"],
                    },
                )
            live = await (
                await conn.execute(
                    "SELECT count(*) AS n FROM runs WHERE thread_id=%s AND internal_status IN ('queued','reserved','running','cancelling')",
                    (tid,),
                )
            ).fetchone()
            if live["n"] and payload.get("multitask_strategy", "enqueue") == "reject":
                raise HTTPException(409, "Thread already has an active run")
            counts = await (
                await conn.execute(
                    "SELECT count(*) FILTER(WHERE internal_status IN ('reserved','running','cancelling')) AS active,count(*) FILTER(WHERE internal_status='queued') AS queued FROM runs WHERE runtime_namespace=%s AND internal_status IN ('queued','reserved','running','cancelling')",
                    (self.namespace,),
                )
            ).fetchone()
            reserve = not live["n"] and counts["active"] < self.max_active
            if counts["active"] + counts[
                "queued"
            ] >= self.max_active + self.max_queued or (
                not reserve and counts["queued"] >= self.max_queued
            ):
                raise HTTPException(
                    429, "Run capacity exceeded", headers={"Retry-After": "1"}
                )
            epoch = control["epoch"] + 1 if reserve else 0
            await conn.execute(
                "INSERT INTO runs(run_id,thread_id,assistant_id,created_at,updated_at,status,metadata,kwargs,multitask_strategy,runtime_namespace,internal_status,graph_id,graph_version,execution_epoch,request_key,request_hash,side_effect_risk) VALUES(%s,%s,%s,clock_timestamp(),clock_timestamp(),'pending',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    rid,
                    tid,
                    str(payload["assistant_id"]),
                    Jsonb(
                        {
                            **(payload.get("metadata") or {}),
                            "execution_version": version,
                        }
                    ),
                    Jsonb(payload),
                    payload.get("multitask_strategy", "enqueue"),
                    self.namespace,
                    "reserved" if reserve else "queued",
                    graph_id,
                    version,
                    epoch,
                    request_key,
                    digest,
                    risk,
                ),
            )
            if reserve:
                await conn.execute(
                    "UPDATE runtime_threads SET active_run_id=%s,epoch=%s WHERE thread_id=%s",
                    (rid, epoch, tid),
                )
            await conn.execute(
                "UPDATE threads SET status='busy',metadata=metadata || %s,updated_at=clock_timestamp() WHERE thread_id=%s",
                (Jsonb({"graph_id": graph_id}), tid),
            )
            await self.events.append_locked(
                conn, rid, epoch, [("metadata", {"run_id": rid})]
            )
            return dict(
                await (
                    await conn.execute("SELECT * FROM runs WHERE run_id=%s", (rid,))
                ).fetchone()
            )

    async def claim(self, owner, version):
        async with self.transaction() as conn:
            worker = await (
                await conn.execute(
                    "SELECT draining FROM runtime_workers WHERE worker_id=%s", (owner,)
                )
            ).fetchone()
            if not worker or worker["draining"]:
                return None
            row = await (
                await conn.execute(
                    "SELECT r.* FROM runs r JOIN runtime_threads t USING(thread_id) WHERE r.runtime_namespace=%s AND r.graph_version=%s AND r.internal_status IN ('reserved','queued') AND t.blocked_reason IS NULL AND (r.internal_status='reserved' OR (SELECT count(*) FROM runs slots WHERE slots.runtime_namespace=%s AND slots.internal_status IN ('reserved','running','cancelling'))<%s) AND (t.active_run_id IS NULL OR t.active_run_id=r.run_id) AND NOT EXISTS(SELECT 1 FROM runs earlier WHERE earlier.thread_id=r.thread_id AND earlier.queue_seq<r.queue_seq AND earlier.internal_status IN ('queued','reserved','running','cancelling')) ORDER BY r.queue_seq LIMIT 1 FOR UPDATE OF t SKIP LOCKED",
                    (self.namespace, version, self.namespace, self.max_active),
                )
            ).fetchone()
            if not row:
                return None
            tid = str(row["thread_id"])
            control = await (
                await conn.execute(
                    "SELECT * FROM runtime_threads WHERE thread_id=%s FOR UPDATE SKIP LOCKED",
                    (tid,),
                )
            ).fetchone()
            if not control:
                return None
            row = await (
                await conn.execute(
                    "SELECT * FROM runs WHERE run_id=%s FOR UPDATE SKIP LOCKED",
                    (row["run_id"],),
                )
            ).fetchone()
            if not row or row["internal_status"] not in ("queued", "reserved"):
                return None
            if row["internal_status"] == "queued":
                counts = await (
                    await conn.execute(
                        "SELECT count(*) AS n FROM runs WHERE runtime_namespace=%s AND internal_status IN ('reserved','running','cancelling')",
                        (self.namespace,),
                    )
                ).fetchone()
                if counts["n"] >= self.max_active:
                    return None
            epoch = control["epoch"] + 1
            await conn.execute(
                "UPDATE runtime_threads SET active_run_id=%s,epoch=%s WHERE thread_id=%s",
                (row["run_id"], epoch, tid),
            )
            result = await (
                await conn.execute(
                    "UPDATE runs SET owner_id=%s,execution_epoch=%s,lease_until=clock_timestamp()+(%s * interval '1 second'),internal_status='running',status='running',metadata=metadata-'runtime_blocked',updated_at=clock_timestamp() WHERE run_id=%s RETURNING *",
                    (owner, epoch, self.lease_seconds, row["run_id"]),
                )
            ).fetchone()
            await self.ensure_lease_deadline(conn, result["lease_until"])
            return dict(result)

    async def guard_write(self, conn, tid, authority):
        control = await (
            await conn.execute(
                "SELECT * FROM runtime_threads WHERE thread_id=%s FOR UPDATE", (tid,)
            )
        ).fetchone()
        if not control:
            raise CheckpointOwnershipLost("Thread authority does not exist")
        if authority.control:
            live = await (
                await conn.execute(
                    "SELECT count(*) AS n FROM runs WHERE thread_id=%s AND internal_status IN ('queued','reserved','running','cancelling')",
                    (tid,),
                )
            ).fetchone()
            if control["active_run_id"] or live["n"] or control["blocked_reason"]:
                raise CheckpointOwnershipLost("Thread has live work or requires review")
            return
        run = await (
            await conn.execute(
                "SELECT *,lease_until>clock_timestamp() AS lease_valid FROM runs WHERE run_id=%s FOR UPDATE",
                (authority.run_id,),
            )
        ).fetchone()
        if (
            not run
            or str(control["active_run_id"]) != authority.run_id
            or control["epoch"] != authority.fencing_token
            or str(run["owner_id"]) != authority.owner_id
            or run["execution_epoch"] != authority.fencing_token
            or not run["lease_valid"]
            or run["internal_status"] not in ("running", "cancelling")
            or run["cancel_requested_at"]
        ):
            raise CheckpointOwnershipLost(
                "Run lease or execution ownership was revoked"
            )

    async def heartbeat(self, run):
        async with self.transaction(str(run["thread_id"])) as conn:
            row = await (
                await conn.execute(
                    "SELECT *,lease_until>clock_timestamp() AS lease_valid FROM runs WHERE run_id=%s FOR UPDATE",
                    (run["run_id"],),
                )
            ).fetchone()
            control = await (
                await conn.execute(
                    "SELECT active_run_id,epoch FROM runtime_threads WHERE thread_id=%s",
                    (run["thread_id"],),
                )
            ).fetchone()
            if (
                not control
                or str(control["active_run_id"]) != str(run["run_id"])
                or control["epoch"] != run["execution_epoch"]
                or not row
                or str(row["owner_id"]) != str(run["owner_id"])
                or row["execution_epoch"] != run["execution_epoch"]
                or not row["lease_valid"]
                or row["internal_status"] not in ("running", "cancelling")
            ):
                raise CheckpointOwnershipLost("Lease lost")
            if row["cancel_requested_at"]:
                return False
            renewed = await (
                await conn.execute(
                    "UPDATE runs SET lease_until=clock_timestamp()+(%s * interval '1 second') WHERE run_id=%s RETURNING lease_until",
                    (self.lease_seconds, run["run_id"]),
                )
            ).fetchone()
            await self.ensure_lease_deadline(conn, renewed["lease_until"])
            return True

    async def publish(self, run, events):
        from infrastructure.postgres.fenced_saver import CheckpointAuthority

        async with self.transaction(str(run["thread_id"])) as conn:
            await self.guard_write(
                conn,
                str(run["thread_id"]),
                CheckpointAuthority(
                    str(run["thread_id"]),
                    str(run["run_id"]),
                    str(run["owner_id"]),
                    run["execution_epoch"],
                ),
            )
            await self.events.append_locked(
                conn, run["run_id"], run["execution_epoch"], events
            )
            await self.guard_write(
                conn,
                str(run["thread_id"]),
                CheckpointAuthority(
                    str(run["thread_id"]),
                    str(run["run_id"]),
                    str(run["owner_id"]),
                    run["execution_epoch"],
                ),
            )

    async def _terminal(
        self, conn, row, status, result=None, error=None, block=False, revoke=False
    ):
        tid = str(row["thread_id"])
        if row["cancel_requested_at"]:
            status = "interrupted"
        if status != "success":
            # Failed/interrupted executions keep their last valid saver state;
            # never publish a late or over-limit final result projection.
            result = None
        metadata = dict(row["metadata"] or {})
        if error:
            metadata["error"] = error
        await conn.execute(
            "UPDATE runs SET internal_status='terminal',status=%s,result=%s,metadata=%s,lease_until=NULL,updated_at=clock_timestamp(),execution_epoch=execution_epoch+%s WHERE run_id=%s",
            (
                status,
                Jsonb(result) if result is not None else None,
                Jsonb(metadata),
                1 if revoke else 0,
                row["run_id"],
            ),
        )
        await conn.execute(
            "UPDATE runtime_threads SET active_run_id=NULL,epoch=epoch+1,blocked_reason=coalesce(%s,blocked_reason) WHERE thread_id=%s AND (active_run_id=%s OR active_run_id IS NULL)",
            (
                "Ambiguous external side effects; explicit review required"
                if block
                else None,
                tid,
                row["run_id"],
            ),
        )
        live = await (
            await conn.execute(
                "SELECT count(*) AS n FROM runs WHERE thread_id=%s AND internal_status IN ('queued','reserved','running','cancelling')",
                (tid,),
            )
        ).fetchone()
        thread_status = (
            "busy" if live["n"] else "idle" if status == "success" else status
        )
        if result is not None:
            await conn.execute(
                "UPDATE threads SET values=%s,state_updated_at=clock_timestamp(),updated_at=clock_timestamp(),status=%s WHERE thread_id=%s",
                (Jsonb(result), thread_status, tid),
            )
        else:
            await conn.execute(
                "UPDATE threads SET updated_at=clock_timestamp(),status=%s WHERE thread_id=%s",
                (thread_status, tid),
            )
        events = (
            [("error", {"error": "execution_error", "message": str(error)})]
            if error
            else []
        ) + [("end", {})]
        await self.events.append_locked(
            conn, row["run_id"], row["execution_epoch"] + (1 if revoke else 0), events
        )

    async def finish(self, run, status, result=None, error=None):
        async with self.transaction(str(run["thread_id"])) as conn:
            row = await (
                await conn.execute(
                    "SELECT *,lease_until>clock_timestamp() AS lease_valid FROM runs WHERE run_id=%s FOR UPDATE",
                    (run["run_id"],),
                )
            ).fetchone()
            control = await (
                await conn.execute(
                    "SELECT active_run_id,epoch FROM runtime_threads WHERE thread_id=%s",
                    (run["thread_id"],),
                )
            ).fetchone()
            if (
                not control
                or str(control["active_run_id"]) != str(run["run_id"])
                or control["epoch"] != run["execution_epoch"]
                or not row
                or row["internal_status"] == "terminal"
                or str(row["owner_id"]) != str(run["owner_id"])
                or row["execution_epoch"] != run["execution_epoch"]
                or not row["lease_valid"]
            ):
                raise CheckpointOwnershipLost(
                    "Terminal commit lost execution ownership"
                )
            await self._terminal(
                conn,
                row,
                status,
                result,
                error,
                block=bool(
                    row["side_effect_risk"]
                    and (row["cancel_requested_at"] or status != "success")
                ),
            )
            await self.ensure_lease_deadline(conn, row["lease_until"])

    async def cancel(self, rid):
        async with self.pool.connection() as conn:
            row = await (
                await conn.execute(
                    "SELECT thread_id FROM runs WHERE run_id=%s AND runtime_namespace=%s",
                    (rid, self.namespace),
                )
            ).fetchone()
        if not row:
            raise HTTPException(404, "Run not found")
        async with self.transaction(str(row["thread_id"])) as conn:
            run = await (
                await conn.execute(
                    "SELECT * FROM runs WHERE run_id=%s FOR UPDATE", (rid,)
                )
            ).fetchone()
            if run["internal_status"] == "terminal":
                return dict(run)
            if run["internal_status"] not in (
                "queued",
                "reserved",
                "running",
                "cancelling",
            ):
                raise HTTPException(409, "Run is not owned by this runtime")
            await conn.execute(
                "UPDATE runs SET cancel_requested_at=clock_timestamp(),internal_status=CASE WHEN internal_status IN ('running','cancelling') THEN 'cancelling' ELSE internal_status END WHERE run_id=%s",
                (rid,),
            )
            if run["internal_status"] in ("queued", "reserved"):
                run["cancel_requested_at"] = True
                await self._terminal(conn, run, "interrupted", revoke=True)
            return dict(
                await (
                    await conn.execute("SELECT * FROM runs WHERE run_id=%s", (rid,))
                ).fetchone()
            )

    async def reap(self):
        async with self.pool.connection() as conn:
            rows = await (
                await conn.execute(
                    "SELECT run_id,thread_id FROM runs WHERE runtime_namespace=%s AND internal_status IN ('running','cancelling') AND lease_until<clock_timestamp() ORDER BY lease_until LIMIT 50",
                    (self.namespace,),
                )
            ).fetchall()
        for item in rows:
            async with self.transaction(str(item["thread_id"])) as conn:
                row = await (
                    await conn.execute(
                        "SELECT *,lease_until<clock_timestamp() AS expired FROM runs WHERE run_id=%s FOR UPDATE",
                        (item["run_id"],),
                    )
                ).fetchone()
                if (
                    row
                    and row["internal_status"] in ("running", "cancelling")
                    and row["expired"]
                ):
                    await self._terminal(
                        conn,
                        row,
                        "interrupted",
                        error="Execution lease expired; execution was not retried",
                        block=row["side_effect_risk"],
                        revoke=True,
                    )

    async def demote_unavailable_versions(self):
        # Never discard queued work or exceed queue capacity on deployment changes.
        async with self.transaction() as conn:
            queued = await (
                await conn.execute(
                    "SELECT r.run_id,r.thread_id,EXISTS(SELECT 1 FROM runtime_workers w WHERE w.namespace=r.runtime_namespace AND w.graph_version=r.graph_version AND NOT w.draining AND w.heartbeat_at>clock_timestamp()-(%s * interval '1 second')) AS compatible FROM runs r WHERE r.runtime_namespace=%s AND r.internal_status='queued' ORDER BY r.queue_seq LIMIT 100",
                    (self.lease_seconds, self.namespace),
                )
            ).fetchall()
            for item in queued:
                locked = await (
                    await conn.execute(
                        "SELECT thread_id FROM runtime_threads WHERE thread_id=%s FOR UPDATE SKIP LOCKED",
                        (item["thread_id"],),
                    )
                ).fetchone()
                if locked:
                    if item["compatible"]:
                        await conn.execute(
                            "UPDATE runs SET metadata=metadata-'runtime_blocked' WHERE run_id=%s",
                            (item["run_id"],),
                        )
                    else:
                        await conn.execute(
                            "UPDATE runs SET metadata=metadata || %s WHERE run_id=%s",
                            (
                                Jsonb(
                                    {"runtime_blocked": "execution_version_unavailable"}
                                ),
                                item["run_id"],
                            ),
                        )
            counts = await (
                await conn.execute(
                    "SELECT count(*) AS n FROM runs WHERE runtime_namespace=%s AND internal_status='queued'",
                    (self.namespace,),
                )
            ).fetchone()
            free = max(0, self.max_queued - counts["n"])
            rows = await (
                await conn.execute(
                    "SELECT r.run_id,r.thread_id FROM runs r WHERE r.runtime_namespace=%s AND r.internal_status='reserved' AND r.owner_id IS NULL AND NOT EXISTS(SELECT 1 FROM runtime_workers w WHERE w.namespace=r.runtime_namespace AND w.graph_version=r.graph_version AND NOT w.draining AND w.heartbeat_at>clock_timestamp()-(%s * interval '1 second')) ORDER BY r.queue_seq LIMIT 20",
                    (self.namespace, self.lease_seconds),
                )
            ).fetchall()
            for row in rows:
                await conn.execute(
                    "SELECT thread_id FROM runtime_threads WHERE thread_id=%s FOR UPDATE",
                    (row["thread_id"],),
                )
                await conn.execute(
                    "UPDATE runs SET metadata=metadata || %s WHERE run_id=%s",
                    (
                        Jsonb({"runtime_blocked": "execution_version_unavailable"}),
                        row["run_id"],
                    ),
                )
                if free == 0:
                    # With a full incompatible queue, retain the reservation and
                    # require compatible deployment or explicit operator cancel.
                    continue
                await conn.execute(
                    "UPDATE runs SET internal_status='queued' WHERE run_id=%s AND internal_status='reserved' AND owner_id IS NULL",
                    (row["run_id"],),
                )
                await conn.execute(
                    "UPDATE runtime_threads SET active_run_id=NULL,epoch=epoch+1 WHERE thread_id=%s AND active_run_id=%s",
                    (row["thread_id"], row["run_id"]),
                )
                free -= 1

    async def metrics(self):
        async with self.pool.connection() as conn:
            counts = await (
                await conn.execute(
                    "SELECT count(*) FILTER(WHERE internal_status IN ('reserved','running','cancelling')) AS active,count(*) FILTER(WHERE internal_status='queued') AS queued,count(*) FILTER(WHERE internal_status='reserved') AS reserved,count(*) FILTER(WHERE internal_status='running') AS running,count(*) FILTER(WHERE internal_status='cancelling') AS cancelling,count(*) FILTER(WHERE lease_until<clock_timestamp()) AS expired_leases,coalesce(max(extract(epoch FROM clock_timestamp()-created_at)) FILTER(WHERE internal_status='queued'),0) AS oldest_queued_seconds FROM runs WHERE runtime_namespace=%s AND internal_status IN ('queued','reserved','running','cancelling')",
                    (self.namespace,),
                )
            ).fetchone()
            blocked = await (
                await conn.execute(
                    "SELECT graph_version,count(*) AS pending FROM runs WHERE runtime_namespace=%s AND internal_status IN ('queued','reserved') AND metadata->>'runtime_blocked'='execution_version_unavailable' GROUP BY graph_version",
                    (self.namespace,),
                )
            ).fetchall()
            workers = await (
                await conn.execute(
                    "SELECT count(*) AS live,coalesce(max(extract(epoch FROM clock_timestamp()-heartbeat_at)),0) AS heartbeat_lag_seconds FROM runtime_workers WHERE namespace=%s AND NOT draining AND heartbeat_at>clock_timestamp()-(%s * interval '1 second')",
                    (self.namespace, self.lease_seconds),
                )
            ).fetchone()
        return {
            "namespace": self.namespace,
            "limits": {"active": self.max_active, "queued": self.max_queued},
            "counts": dict(counts),
            "blockedVersions": [dict(row) for row in blocked],
            "workers": dict(workers),
        }

    @asynccontextmanager
    async def control(self, tid):
        from infrastructure.postgres.fenced_saver import CheckpointAuthority

        async with self.transaction(tid) as conn:
            authority = CheckpointAuthority(
                thread_id=tid, control=True, connection=conn
            )
            try:
                await self.guard_write(conn, tid, authority)
                yield conn, authority
            except CheckpointOwnershipLost as error:
                # Only HTTP control conflicts are translated. Execution fencing
                # remains a runtime ownership failure, not an HTTP conflict.
                raise HTTPException(
                    409, {"code": "thread_control_conflict", "message": str(error)}
                ) from error

    async def review(self, tid, reason):
        async with self.transaction(tid) as conn:
            row = await (
                await conn.execute(
                    "SELECT active_run_id FROM runtime_threads WHERE thread_id=%s",
                    (tid,),
                )
            ).fetchone()
            if row["active_run_id"]:
                raise HTTPException(409, "Thread is still active")
            await conn.execute(
                "UPDATE runtime_threads SET blocked_reason=NULL WHERE thread_id=%s",
                (tid,),
            )
            await conn.execute(
                "UPDATE threads SET metadata=metadata || %s,updated_at=clock_timestamp() WHERE thread_id=%s",
                (Jsonb({"runtimeReview": {"reason": reason}}), tid),
            )
        return {"reviewed": True}
