from __future__ import annotations

import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from typing import Any, cast
from uuid import uuid4

import pytest

from settings import AppSettings


class SingleConnectionPool:
    def __init__(self, connection):
        self._connection = connection

    @asynccontextmanager
    async def connection(self):
        yield self._connection


@asynccontextmanager
async def isolated_connection() -> AsyncIterator[Any]:
    if os.getenv("RUN_POSTGRES_TESTS") != "1":
        pytest.skip("set RUN_POSTGRES_TESTS=1")
    from psycopg import AsyncConnection, sql
    from psycopg.rows import dict_row

    settings = AppSettings.from_env()
    connection = cast(
        Any,
        await AsyncConnection.connect(
            settings.postgres_conninfo(),
            autocommit=True,
            row_factory=cast(Any, dict_row),
        ),
    )
    schema = f"test_normalized_{uuid4().hex}"
    await connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    await connection.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
    try:
        yield connection
    finally:
        await connection.execute("SET search_path TO public")
        await connection.execute(
            sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
        )
        await connection.close()
