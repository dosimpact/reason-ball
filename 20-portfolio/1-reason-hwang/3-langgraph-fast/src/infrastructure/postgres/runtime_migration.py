"""Explicit deployment migration; application workers never call this module."""

import argparse
import asyncio
import os

from infrastructure.postgres.checkpointer import PostgresRuntime
from infrastructure.postgres.runtime_queue import migrate_runtime_queue
from settings import get_settings


async def migrate(bootstrap_base=False):
    settings = get_settings()
    if not settings.postgres_configured:
        raise RuntimeError("Configured PostgreSQL is required")
    runtime = PostgresRuntime(
        settings.postgres_conninfo(),
        profile="local",
        schema=settings.postgres_schema,
        initialize_schema=bootstrap_base,
    )
    try:
        await runtime.open()
        async with runtime.pool.connection() as connection:
            await migrate_runtime_queue(
                connection,
                namespace=os.getenv("LANGGRAPH_RUNTIME_NAMESPACE", "fastapi"),
                max_active=int(os.getenv("LANGGRAPH_MAX_ACTIVE", "10")),
                max_queued=int(os.getenv("LANGGRAPH_MAX_QUEUED", "10")),
            )
    finally:
        await runtime.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bootstrap-base",
        action="store_true",
        help="Explicitly create baseline application/saver schema on a new deployment",
    )
    asyncio.run(migrate(parser.parse_args().bootstrap_base))
