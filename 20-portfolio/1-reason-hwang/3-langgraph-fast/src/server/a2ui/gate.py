from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import HTTPException


class StreamGate:
    """Reserve a thread before queueing; hold capacity through stream cleanup."""

    def __init__(self, active: int = 10, queued: int = 10):
        self.capacity = active + queued
        self.threads: set[str] = set()
        self.semaphore = asyncio.Semaphore(active)

    @asynccontextmanager
    async def reserve(self, thread: str):
        # There is no await between checking and reserving on the server event loop.
        if thread in self.threads:
            raise HTTPException(409, "This demo thread already has an active run")
        if len(self.threads) >= self.capacity:
            raise HTTPException(429, "A2UI demo capacity exceeded", headers={"Retry-After": "1"})
        self.threads.add(thread)
        try:
            async with self.semaphore:
                yield
        finally:
            self.threads.remove(thread)
