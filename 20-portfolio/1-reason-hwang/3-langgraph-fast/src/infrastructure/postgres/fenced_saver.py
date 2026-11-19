"""Transaction-bound checkpoint writes guarded by server-owned execution context.

The guard MUST lock the same thread/run rows used by claim/revoke, and validate
ownership against database time. It runs before and after the actual saver write;
raising at either point rolls back checkpoint blobs and pending writes together.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable, Iterator
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


class CheckpointOwnershipLost(RuntimeError):
    """No valid server-side authority exists for this checkpoint mutation."""


@dataclass(frozen=True)
class CheckpointAuthority:
    thread_id: str
    run_id: str | None = None
    owner_id: str | None = None
    fencing_token: int | None = None
    control: bool = False
    connection: Any = None


_authority: ContextVar[CheckpointAuthority | None] = ContextVar(
    "checkpoint_authority", default=None
)
Guard = Callable[[Any, str, CheckpointAuthority], Awaitable[None]]


@contextmanager
def checkpoint_authority(authority: CheckpointAuthority) -> Iterator[None]:
    """Set by the server, never derived from client configurable fields."""
    token = _authority.set(authority)
    try:
        yield
    finally:
        _authority.reset(token)


class FencedAsyncPostgresSaver(AsyncPostgresSaver):
    def __init__(self, pool: Any, guard: Guard) -> None:
        super().__init__(pool)
        self._fence_pool = pool
        self._guard = guard

    @asynccontextmanager
    async def _connection(self, authority: CheckpointAuthority) -> AsyncIterator[Any]:
        if authority.connection is not None:
            if not authority.control:
                raise CheckpointOwnershipLost(
                    "Bound connection requires control authority"
                )
            yield authority.connection
        else:
            async with self._fence_pool.connection() as connection:
                yield connection

    @asynccontextmanager
    async def _write_saver(self, thread_id: str) -> AsyncIterator[AsyncPostgresSaver]:
        authority = _authority.get()
        if authority is None or authority.thread_id != thread_id:
            raise CheckpointOwnershipLost(
                "Checkpoint mutation requires thread authority"
            )
        if not authority.control and (
            not authority.run_id
            or not authority.owner_id
            or authority.fencing_token is None
        ):
            raise CheckpointOwnershipLost("Checkpoint mutation requires run ownership")
        async with (
            self._connection(authority) as connection,
            connection.transaction(),
        ):
            await self._guard(connection, thread_id, authority)
            # Bind to THIS connection, not the pool. Upstream's pipeline is
            # flushed before returning, inside our outer transaction.
            yield AsyncPostgresSaver(connection, serde=self.serde)
            await self._guard(connection, thread_id, authority)

    async def aput(
        self, config: Any, checkpoint: Any, metadata: Any, new_versions: Any
    ) -> Any:
        async with self._write_saver(str(config["configurable"]["thread_id"])) as saver:
            return await saver.aput(config, checkpoint, metadata, new_versions)

    async def aput_writes(
        self, config: Any, writes: Any, task_id: str, task_path: str = ""
    ) -> None:
        async with self._write_saver(str(config["configurable"]["thread_id"])) as saver:
            await saver.aput_writes(config, writes, task_id, task_path)

    async def adelete_thread(self, thread_id: str) -> None:
        authority = _authority.get()
        if authority is None or not authority.control:
            raise CheckpointOwnershipLost(
                "Checkpoint deletion requires control authority"
            )
        async with self._write_saver(str(thread_id)) as saver:
            await saver.adelete_thread(thread_id)

    async def aget_tuple(self, config: Any) -> Any:
        authority = _authority.get()
        if authority is not None and authority.connection is not None:
            thread_id = str(config["configurable"]["thread_id"])
            async with self._write_saver(thread_id) as saver:
                return await saver.aget_tuple(config)
        return await super().aget_tuple(config)

    async def alist(self, config: Any, **kwargs: Any) -> AsyncIterator[Any]:
        authority = _authority.get()
        if authority is not None and authority.connection is not None:
            if config is None:
                raise CheckpointOwnershipLost("Control reads require a thread")
            async with self._write_saver(
                str(config["configurable"]["thread_id"])
            ) as saver:
                async for item in saver.alist(config, **kwargs):
                    yield item
        else:
            async for item in super().alist(config, **kwargs):
                yield item

    async def aget_delta_channel_history(self, config: Any, **kwargs: Any) -> Any:
        authority = _authority.get()
        if authority is not None and authority.connection is not None:
            async with self._write_saver(
                str(config["configurable"]["thread_id"])
            ) as saver:
                return await saver.aget_delta_channel_history(config=config, **kwargs)
        return await super().aget_delta_channel_history(config=config, **kwargs)
