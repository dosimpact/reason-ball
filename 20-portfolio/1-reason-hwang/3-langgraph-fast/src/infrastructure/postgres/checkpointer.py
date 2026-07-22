from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from infrastructure.postgres.migrations import prepare_schema


@dataclass
class PostgresRuntime:
    conninfo: str
    profile: str
    pool: Any = None
    checkpointer: Any = None

    async def open(self) -> "PostgresRuntime":
        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            from psycopg.rows import dict_row
            from psycopg_pool import AsyncConnectionPool
        except ImportError as exc:
            raise RuntimeError("PostgreSQL runtime dependencies are not installed") from exc

        self.pool = AsyncConnectionPool(
            conninfo=self.conninfo,
            kwargs={
                "autocommit": True,
                "prepare_threshold": 0,
                "row_factory": dict_row,
            },
            open=False,
        )
        await self.pool.open()
        async with self.pool.connection() as connection:
            await prepare_schema(connection, profile=self.profile)
        self.checkpointer = AsyncPostgresSaver(self.pool)
        if self.profile == "local":
            await self.checkpointer.setup()
        return self

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
            self.checkpointer = None
