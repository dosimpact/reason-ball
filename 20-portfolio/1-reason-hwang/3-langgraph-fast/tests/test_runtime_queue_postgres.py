"""Opt-in queue invariants against an explicitly owned disposable PostgreSQL."""

import asyncio
import os
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import HTTPException
from langgraph.checkpoint.base import empty_checkpoint
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from infrastructure.postgres.fenced_saver import (
    CheckpointAuthority,
    CheckpointOwnershipLost,
    FencedAsyncPostgresSaver,
    checkpoint_authority,
)
from infrastructure.postgres.migrations import prepare_schema
from infrastructure.postgres.runtime_queue import RuntimeQueue, migrate_runtime_queue


@pytest_asyncio.fixture
async def queue():
    dsn = os.environ.get("FENCING_TEST_DATABASE_URL")
    if not dsn or os.environ.get("FENCING_TEST_OWNED_DATABASE") != "1":
        pytest.skip("requires an explicitly owned disposable PostgreSQL database")
    schema = "qa_queue_" + uuid4().hex
    admin = AsyncConnectionPool(
        dsn, kwargs={"autocommit": True, "row_factory": dict_row}, open=False
    )
    await admin.open()
    pool = None
    try:
        async with admin.connection() as conn:
            await prepare_schema(conn, profile="local", schema=schema)
            await migrate_runtime_queue(
                conn, namespace="qa", max_active=1, max_queued=2
            )
        pool = AsyncConnectionPool(
            dsn,
            kwargs={
                "autocommit": True,
                "prepare_threshold": 0,
                "row_factory": dict_row,
                "options": f"-c search_path={schema},public",
            },
            open=False,
            max_size=8,
        )
        await pool.open()
        await AsyncPostgresSaver(pool).setup()
        instance = RuntimeQueue(pool, namespace="qa", max_active=1, max_queued=2)
        await instance.verify()
        yield instance
    finally:
        if pool is not None:
            await pool.close()
        async with admin.connection() as conn:
            await conn.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
            assert (
                await (
                    await conn.execute(
                        "SELECT count(*) AS n FROM pg_namespace WHERE nspname=%s",
                        (schema,),
                    )
                ).fetchone()
            )["n"] == 0
        await admin.close()


def payload():
    return {"assistant_id": "graph", "input": {"value": "test"}}


async def register(queue):
    owner = str(uuid4())
    await queue.worker(owner, "version")
    return owner


def authority(run):
    return CheckpointAuthority(
        str(run["thread_id"]),
        str(run["run_id"]),
        str(run["owner_id"]),
        run["execution_epoch"],
    )


@pytest.mark.asyncio
async def test_global_admission_and_claim_are_atomic_across_connections(queue):
    rows = await asyncio.gather(
        *(queue.enqueue(None, payload(), "graph", "version") for _ in range(3))
    )
    assert sorted(row["internal_status"] for row in rows) == [
        "queued",
        "queued",
        "reserved",
    ]
    with pytest.raises(HTTPException) as error:
        await queue.enqueue(None, payload(), "graph", "version")
    assert error.value.status_code == 429
    owners = await asyncio.gather(register(queue), register(queue))
    claims = await asyncio.gather(*(queue.claim(owner, "version") for owner in owners))
    assert sum(run is not None for run in claims) == 1


@pytest.mark.asyncio
async def test_fifo_queued_cancel_does_not_revoke_active_owner(queue):
    first = await queue.enqueue(None, payload(), "graph", "version")
    tid = str(first["thread_id"])
    second = await queue.enqueue(tid, payload(), "graph", "version")
    third = await queue.enqueue(tid, payload(), "graph", "version")
    owner = await register(queue)
    run = await queue.claim(owner, "version")
    await queue.cancel(str(second["run_id"]))
    async with queue.pool.connection() as conn, conn.transaction():
        await queue.guard_write(conn, tid, authority(run))
    await queue.finish(run, "success", {"answer": "first"})
    next_run = await queue.claim(owner, "version")
    assert str(next_run["run_id"]) == str(third["run_id"])
    assert await queue.heartbeat(next_run)
    await queue.cancel(str(next_run["run_id"]))
    assert not await queue.heartbeat(next_run)
    await queue.finish(next_run, "success", {"answer": "must be interrupted"})
    async with queue.pool.connection() as conn:
        status = await (
            await conn.execute(
                "SELECT status FROM runs WHERE run_id=%s", (next_run["run_id"],)
            )
        ).fetchone()
        assert status["status"] == "interrupted"
        thread = await (
            await conn.execute("SELECT values FROM threads WHERE thread_id=%s", (tid,))
        ).fetchone()
        assert thread["values"] == {"answer": "first"}


@pytest.mark.asyncio
async def test_production_guard_fences_saver_after_reap_and_blocks_risky_thread(queue):
    row = await queue.enqueue(None, payload(), "graph", "version", risk=True)
    run = await queue.claim(await register(queue), "version")
    saver = FencedAsyncPostgresSaver(queue.pool, queue.guard_write)
    await saver.setup()
    config = {"configurable": {"thread_id": str(run["thread_id"]), "checkpoint_ns": ""}}
    with checkpoint_authority(authority(run)):
        config = await saver.aput(config, empty_checkpoint(), {}, {})
        await saver.aput_writes(config, [("value", "before")], "first")
    async with queue.pool.connection() as conn:
        await conn.execute(
            "UPDATE runs SET lease_until=clock_timestamp()-interval '1 second' WHERE run_id=%s",
            (row["run_id"],),
        )
    await queue.reap()
    with checkpoint_authority(authority(run)):
        with pytest.raises(CheckpointOwnershipLost):
            await saver.aput(config, empty_checkpoint(), {}, {})
        with pytest.raises(CheckpointOwnershipLost):
            await saver.aput_writes(config, [("value", "late")], "late")
    with pytest.raises(CheckpointOwnershipLost):
        await queue.finish(run, "success", {"late": True})
    with pytest.raises(HTTPException) as error:
        await queue.enqueue(str(run["thread_id"]), payload(), "graph", "version")
    assert error.value.status_code == 409
    await queue.review(str(run["thread_id"]), "operator inspected external effects")
    assert (await queue.enqueue(str(run["thread_id"]), payload(), "graph", "version"))[
        "internal_status"
    ] == "reserved"


@pytest.mark.asyncio
async def test_control_transaction_blocks_admission_until_commit(queue):
    row = await queue.enqueue(None, payload(), "graph", "version")
    await queue.cancel(str(row["run_id"]))
    tid = str(row["thread_id"])
    async with queue.control(tid):
        pending = asyncio.create_task(queue.enqueue(tid, payload(), "graph", "version"))
        await asyncio.sleep(0.05)
        assert not pending.done()
    assert (await asyncio.wait_for(pending, 2))["internal_status"] == "reserved"
    with pytest.raises(HTTPException) as conflict:
        async with queue.control(tid):
            pass
    assert conflict.value.status_code == 409


@pytest.mark.asyncio
async def test_idempotency_key_deduplicates_concurrent_admission(queue):
    left, right = await asyncio.gather(
        *(
            queue.enqueue(None, payload(), "graph", "version", request_key="same")
            for _ in range(2)
        )
    )
    assert left["run_id"] == right["run_id"]
    with pytest.raises(HTTPException) as error:
        await queue.enqueue(
            None,
            {**payload(), "input": {"different": True}},
            "graph",
            "version",
            request_key="same",
        )
    assert error.value.status_code == 409


@pytest.mark.asyncio
async def test_thread_epoch_revocation_fences_heartbeat_and_terminal_commit(queue):
    await queue.enqueue(None, payload(), "graph", "version")
    run = await queue.claim(await register(queue), "version")
    async with queue.pool.connection() as conn:
        await conn.execute(
            "UPDATE runtime_threads SET epoch=epoch+1 WHERE thread_id=%s",
            (run["thread_id"],),
        )
    with pytest.raises(CheckpointOwnershipLost):
        await queue.heartbeat(run)
    with pytest.raises(CheckpointOwnershipLost):
        await queue.finish(run, "success", {"late": True})


@pytest.mark.asyncio
async def test_abandoned_version_reservation_releases_slot_without_reexecution(queue):
    old = await queue.enqueue(None, payload(), "graph", "old-version")
    await queue.demote_unavailable_versions()
    async with queue.pool.connection() as conn:
        row = await (
            await conn.execute(
                "SELECT internal_status,owner_id,metadata FROM runs WHERE run_id=%s",
                (old["run_id"],),
            )
        ).fetchone()
    assert row["internal_status"] == "queued" and row["owner_id"] is None
    assert row["metadata"]["runtime_blocked"] == "execution_version_unavailable"
    newer = await queue.enqueue(None, payload(), "graph", "version")
    claimed = await queue.claim(await register(queue), "version")
    assert str(claimed["run_id"]) == str(newer["run_id"])
    assert str(claimed["run_id"]) != str(old["run_id"])


async def queue_snapshot(queue, run):
    async with queue.pool.connection() as conn:
        result = {}
        for table, key, value in (
            ("runs", "run_id", run["run_id"]),
            ("threads", "thread_id", run["thread_id"]),
            ("runtime_threads", "thread_id", run["thread_id"]),
        ):
            result[table] = dict(
                await (
                    await conn.execute(
                        f"SELECT * FROM {table} WHERE {key}=%s", (value,)
                    )
                ).fetchone()
            )
        result["events"] = [
            dict(row)
            for row in await (
                await conn.execute(
                    "SELECT * FROM runtime_events WHERE run_id=%s ORDER BY sequence",
                    (run["run_id"],),
                )
            ).fetchall()
        ]
        return result


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["publish", "finish"])
async def test_lease_expiry_during_event_write_rolls_back_entire_transaction(
    queue, operation
):
    await queue.enqueue(None, payload(), "graph", "version")
    run = await queue.claim(await register(queue), "version")
    async with queue.pool.connection() as conn:
        await conn.execute(
            "CREATE FUNCTION delay_runtime_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.25); RETURN NEW; END $$"
        )
        await conn.execute(
            "CREATE TRIGGER delay_runtime_event AFTER INSERT ON runtime_events FOR EACH ROW EXECUTE FUNCTION delay_runtime_event()"
        )
        await conn.execute(
            "UPDATE runs SET lease_until=clock_timestamp()+interval '0.15 seconds' WHERE run_id=%s",
            (run["run_id"],),
        )
    before = await queue_snapshot(queue, run)
    with pytest.raises(CheckpointOwnershipLost):
        if operation == "publish":
            await queue.publish(run, [("custom", {"late": True})])
        else:
            await queue.finish(run, "success", {"late": True})
    assert await queue_snapshot(queue, run) == before
    async with queue.pool.connection() as conn:
        await conn.execute("DROP TRIGGER delay_runtime_event ON runtime_events")
    await queue.reap()
    after = await queue_snapshot(queue, run)
    assert after["runs"]["internal_status"] == "terminal"
    assert after["runs"]["status"] == "interrupted"
    assert after["runs"]["result"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["claim", "heartbeat"])
async def test_new_lease_expiry_during_run_update_rolls_back_claim_or_renewal(
    queue, operation
):
    row = await queue.enqueue(None, payload(), "graph", "version")
    owner = await register(queue)
    run = await queue.claim(owner, "version") if operation == "heartbeat" else row
    async with queue.pool.connection() as conn:
        await conn.execute(
            "CREATE FUNCTION delay_new_lease() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.lease_until IS DISTINCT FROM OLD.lease_until THEN PERFORM pg_sleep(0.25); END IF; RETURN NEW; END $$"
        )
        await conn.execute(
            "CREATE TRIGGER delay_new_lease AFTER UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION delay_new_lease()"
        )
    before = await queue_snapshot(queue, run)
    queue.lease_seconds = 0.15
    with pytest.raises(CheckpointOwnershipLost):
        if operation == "claim":
            await queue.claim(owner, "version")
        else:
            await queue.heartbeat(run)
    assert await queue_snapshot(queue, run) == before


@pytest.mark.asyncio
async def test_unavailable_version_demotion_preserves_full_queue_caps_and_all_requests(
    queue,
):
    rows = [
        await queue.enqueue(None, payload(), "graph", "old-version") for _ in range(3)
    ]
    await queue.demote_unavailable_versions()
    async with queue.pool.connection() as conn:
        stored = await (
            await conn.execute(
                "SELECT run_id,internal_status FROM runs ORDER BY queue_seq"
            )
        ).fetchall()
    assert {str(row["run_id"]) for row in stored} == {
        str(row["run_id"]) for row in rows
    }
    assert [row["internal_status"] for row in stored].count("reserved") == 1
    assert [row["internal_status"] for row in stored].count("queued") == 2
