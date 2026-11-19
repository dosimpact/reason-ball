import asyncio
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest

from infrastructure.postgres import fenced_saver as module


class Connection:
    def __init__(self):
        self.events = []

    @asynccontextmanager
    async def transaction(self):
        self.events.append("begin")
        try:
            yield
        except BaseException:
            self.events.append("rollback")
            raise
        else:
            self.events.append("commit")


class Pool:
    def __init__(self, connection):
        self.conn = connection

    @asynccontextmanager
    async def connection(self):
        yield self.conn


@pytest.mark.asyncio
async def test_same_connection_transaction_and_context_propagate(monkeypatch):
    conn = Connection()
    calls = []

    class Saver:
        def __init__(self, connection, **kwargs):
            assert connection is conn

        async def aput(self, *args):
            conn.events.append("checkpoint")
            return "saved"

        async def aput_writes(self, *args):
            conn.events.append("writes")

    saver = module.FencedAsyncPostgresSaver(Pool(conn), AsyncMock())

    async def guard(connection, thread, authority):
        assert connection is conn and thread == "thread"
        assert authority.run_id == "run"
        calls.append(authority)
        conn.events.append("guard")

    saver._guard = guard
    monkeypatch.setattr(module, "AsyncPostgresSaver", Saver)
    config = {"configurable": {"thread_id": "thread"}}
    with module.checkpoint_authority(
        module.CheckpointAuthority("thread", "run", "owner", 3)
    ):
        assert await asyncio.create_task(saver.aput(config, {}, {}, {})) == "saved"
        await asyncio.create_task(saver.aput_writes(config, [], "task"))
    assert conn.events == [
        "begin",
        "guard",
        "checkpoint",
        "guard",
        "commit",
        "begin",
        "guard",
        "writes",
        "guard",
        "commit",
    ]
    assert len(calls) == 4
    with pytest.raises(module.CheckpointOwnershipLost):
        await saver.aput(config, {}, {}, {})


@pytest.mark.asyncio
async def test_post_write_expiry_rolls_back_and_client_config_cannot_authorize(
    monkeypatch,
):
    conn = Connection()
    guard = AsyncMock(side_effect=[None, module.CheckpointOwnershipLost("expired")])
    saver = module.FencedAsyncPostgresSaver(Pool(conn), guard)

    class Saver:
        def __init__(self, *args, **kwargs):
            pass

        async def aput_writes(self, *args):
            conn.events.append("writes")

    monkeypatch.setattr(module, "AsyncPostgresSaver", Saver)
    config = {
        "configurable": {
            "thread_id": "thread",
            "owner_id": "forged",
            "fencing_token": 99,
        }
    }
    with pytest.raises(module.CheckpointOwnershipLost):
        await saver.aput_writes(config, [], "task")
    assert conn.events == []
    with (
        module.checkpoint_authority(
            module.CheckpointAuthority("thread", "run", "owner", 1)
        ),
        pytest.raises(module.CheckpointOwnershipLost, match="expired"),
    ):
        await saver.aput_writes(config, [], "task")
    assert conn.events == ["begin", "writes", "rollback"]


@pytest.mark.asyncio
async def test_delete_requires_control_and_thread_binding():
    guard = AsyncMock()
    saver = module.FencedAsyncPostgresSaver(Pool(Connection()), guard)
    with (
        module.checkpoint_authority(
            module.CheckpointAuthority("thread", "run", "owner", 1)
        ),
        pytest.raises(module.CheckpointOwnershipLost),
    ):
        await saver.adelete_thread("thread")
    with (
        module.checkpoint_authority(module.CheckpointAuthority("other", control=True)),
        pytest.raises(module.CheckpointOwnershipLost),
    ):
        await saver.adelete_thread("thread")
    guard.assert_not_called()


@pytest.mark.asyncio
async def test_control_reads_and_writes_share_callers_connection(monkeypatch):
    conn = Connection()
    pool = Pool(Connection())
    guard = AsyncMock()
    saver = module.FencedAsyncPostgresSaver(pool, guard)

    class Saver:
        def __init__(self, connection, **kwargs):
            assert connection is conn

        async def aget_tuple(self, config):
            return "current"

        async def adelete_thread(self, thread):
            conn.events.append("delete")

    monkeypatch.setattr(module, "AsyncPostgresSaver", Saver)
    authority = module.CheckpointAuthority("thread", control=True, connection=conn)
    with module.checkpoint_authority(authority):
        assert (
            await saver.aget_tuple({"configurable": {"thread_id": "thread"}})
            == "current"
        )
        await saver.adelete_thread("thread")
    assert conn.events == ["begin", "commit", "begin", "delete", "commit"]
    assert pool.conn.events == []
    assert guard.await_count == 4
