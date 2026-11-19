"""Opt-in real PostgreSQL proof. Use only a disposable, explicitly owned DB."""

import asyncio
import os
import uuid

import psycopg
import pytest
from langgraph.checkpoint.base import empty_checkpoint
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from infrastructure.postgres.fenced_saver import (
    CheckpointAuthority,
    CheckpointOwnershipLost,
    FencedAsyncPostgresSaver,
    checkpoint_authority,
)
from infrastructure.postgres.runtime_events import RuntimeEvents


@pytest.mark.asyncio
async def test_real_postgres_atomic_saver_control_and_events():
    dsn = os.environ.get("FENCING_TEST_DATABASE_URL")
    if not dsn or os.environ.get("FENCING_TEST_OWNED_DATABASE") != "1":
        pytest.skip("requires an explicitly owned disposable PostgreSQL database")
    schema = "qa_fence_" + uuid.uuid4().hex
    admin = AsyncConnectionPool(
        dsn, kwargs={"autocommit": True, "row_factory": dict_row}, open=False
    )
    await admin.open()
    pool = None
    try:
        async with admin.connection() as conn:
            await conn.execute(f'CREATE SCHEMA "{schema}"')
        pool = AsyncConnectionPool(
            dsn,
            kwargs={
                "autocommit": True,
                "row_factory": dict_row,
                "prepare_threshold": 0,
                "options": f"-c search_path={schema},public",
            },
            open=False,
        )
        await pool.open()
        async with pool.connection() as conn:
            await conn.execute(
                "CREATE TABLE authority(thread_id text PRIMARY KEY, owner_id text, epoch bigint, lease_until timestamptz)"
            )
            await conn.execute(
                "INSERT INTO authority VALUES('thread','owner',1,clock_timestamp()+interval '1 hour')"
            )
            await conn.execute("CREATE TABLE control_state(value text)")
            await conn.execute(
                "CREATE TABLE runs(run_id uuid PRIMARY KEY,runtime_namespace text,event_seq bigint DEFAULT 0,event_bytes bigint DEFAULT 0,internal_status text,result jsonb,updated_at timestamptz DEFAULT clock_timestamp())"
            )
            await conn.execute(
                "CREATE TABLE runtime_events(run_id uuid REFERENCES runs(run_id),sequence bigint,execution_epoch bigint,event text,namespace text[],payload jsonb,size_bytes int,created_at timestamptz,PRIMARY KEY(run_id,sequence))"
            )
        expire_after_write = False
        guard_count = 0

        async def guard(conn, thread_id, authority):
            nonlocal guard_count
            guard_count += 1
            if expire_after_write and guard_count % 2 == 0:
                await conn.execute("SELECT pg_sleep(0.15)")
            cur = await conn.execute(
                "SELECT *,lease_until>clock_timestamp() AS valid FROM authority WHERE thread_id=%s FOR UPDATE",
                (thread_id,),
            )
            row = await cur.fetchone()
            if not row or (
                not authority.control
                and (
                    row["owner_id"] != authority.owner_id
                    or row["epoch"] != authority.fencing_token
                    or not row["valid"]
                )
            ):
                raise CheckpointOwnershipLost("stale owner")

        saver = FencedAsyncPostgresSaver(pool, guard)
        await saver.setup()
        checkpoint = empty_checkpoint()
        checkpoint["channel_values"] = {"nested": {"value": 1}}
        checkpoint["channel_versions"] = {"nested": "1"}
        config = {"configurable": {"thread_id": "thread", "checkpoint_ns": ""}}
        authority = CheckpointAuthority("thread", "run", "owner", 1)
        with checkpoint_authority(authority):
            config = await saver.aput(config, checkpoint, {}, {"nested": "1"})
            await saver.aput_writes(config, [("result", {"ok": True})], "first")

        async def counts():
            async with pool.connection() as conn:
                values = []
                for table in ("checkpoints", "checkpoint_blobs", "checkpoint_writes"):
                    values.append(
                        (
                            await (
                                await conn.execute(f"SELECT count(*) AS n FROM {table}")
                            ).fetchone()
                        )["n"]
                    )
                return tuple(values)

        baseline = await counts()
        assert baseline == (1, 1, 1)
        async with pool.connection() as conn:
            await conn.execute("UPDATE authority SET owner_id='new',epoch=2")
        with checkpoint_authority(authority):
            with pytest.raises(CheckpointOwnershipLost):
                await saver.aput(config, empty_checkpoint(), {}, {})
            with pytest.raises(CheckpointOwnershipLost):
                await saver.aput_writes(config, [("result", "stale")], "stale")
        assert await counts() == baseline
        async with pool.connection() as conn:
            await conn.execute(
                "UPDATE authority SET owner_id='owner',epoch=1,lease_until=clock_timestamp()+interval '0.1 second'"
            )
        expire_after_write = True
        guard_count = 0
        with checkpoint_authority(authority), pytest.raises(CheckpointOwnershipLost):
            await saver.aput_writes(
                config, [("result", "rollback")], "expired-after-write"
            )
        assert await counts() == baseline
        expire_after_write = False
        async with pool.connection() as conn:
            with pytest.raises(RuntimeError, match="rollback control"):
                async with conn.transaction():
                    with checkpoint_authority(
                        CheckpointAuthority("thread", control=True, connection=conn)
                    ):
                        assert await saver.aget_tuple(config) is not None
                        await saver.adelete_thread("thread")
                        await conn.execute(
                            "INSERT INTO control_state VALUES('changed')"
                        )
                        raise RuntimeError("rollback control")
        assert await counts() == baseline
        async with pool.connection() as conn:
            assert (
                await (
                    await conn.execute("SELECT count(*) AS n FROM control_state")
                ).fetchone()
            )["n"] == 0
        run_id = str(uuid.uuid4())
        events = RuntimeEvents(pool, "qa", max_events=2)
        async with pool.connection() as conn, conn.transaction():
            await conn.execute(
                "INSERT INTO runs(run_id,runtime_namespace,internal_status) VALUES(%s,'qa','running')",
                (run_id,),
            )
            assert await events.append_locked(
                conn,
                run_id,
                1,
                [("values", {"n": 1}), ("custom|child", {"n": 2}), ("end", {})],
            ) == [1, 2, 3]
            await conn.execute(
                "UPDATE runs SET internal_status='terminal' WHERE run_id=%s", (run_id,)
            )
        page = await events.read(run_id)
        assert page["gap"] and page["oldestCursor"] == 2
        assert [event["sequence"] for event in page["events"]] == [2, 3]
        frames = [frame async for frame in events.stream(run_id)]
        assert any("stream_buffer_gap" in frame for frame in frames)
        assert sum("event: end" in frame for frame in frames) == 1
        async with pool.connection() as conn:
            await conn.execute(
                "UPDATE runs SET updated_at=clock_timestamp()-interval '2 minutes' WHERE run_id=%s",
                (run_id,),
            )
        await events.prune()
        assert not (await events.read(run_id))["events"]
        async with pool.connection() as conn:
            await conn.execute(
                "UPDATE runs SET result=%s::jsonb WHERE run_id=%s",
                ('{"restored":true}', run_id),
            )
        restored = [frame async for frame in events.stream(run_id)]
        assert len(restored) == 3 and "event: values" in restored[1]
        assert "restored" in restored[1]
        # Independent LISTEN session wakes a DB-backed stream immediately,
        # despite a deliberately long fallback poll timeout.
        notified_run = str(uuid.uuid4())
        hinted = RuntimeEvents(pool, "qa", poll_seconds=10)
        async with pool.connection() as conn:
            await conn.execute(
                "INSERT INTO runs(run_id,runtime_namespace,internal_status) VALUES(%s,'qa','running')",
                (notified_run,),
            )
        async with await psycopg.AsyncConnection.connect(
            dsn, autocommit=True
        ) as listener:
            await listener.execute("LISTEN langgraph_runtime_events")

            async def forward_notice():
                async for notice in listener.notifies(stop_after=1, timeout=2):
                    hinted.notify(notice.payload)

            bridge = asyncio.create_task(forward_notice())
            stream = hinted.stream(notified_run)
            assert "metadata" in await anext(stream)
            next_frame = asyncio.create_task(anext(stream))
            await asyncio.sleep(0.02)
            async with pool.connection() as conn, conn.transaction():
                await hinted.append_locked(
                    conn,
                    notified_run,
                    1,
                    [("values", {"notification": True}), ("end", {})],
                )
                await conn.execute(
                    "UPDATE runs SET internal_status='terminal' WHERE run_id=%s",
                    (notified_run,),
                )
            assert "notification" in await asyncio.wait_for(next_frame, 1)
            await asyncio.wait_for(bridge, 1)
            await stream.aclose()
            assert not hinted._subscriptions
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
