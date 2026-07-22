from __future__ import annotations

import asyncio
from collections.abc import Awaitable
from typing import TypeVar

from fastapi import HTTPException

T = TypeVar("T")


class ExecutionGate:
    """Bound graph execution without relying on a licensed queue service."""

    def __init__(self, max_active: int = 10, max_queued: int = 10) -> None:
        if max_active < 1 or max_queued < 0:
            raise ValueError("execution limits must be non-negative and max_active must be positive")
        self.max_active = max_active
        self.max_queued = max_queued
        self._semaphore = asyncio.Semaphore(max_active)
        self._lock = asyncio.Lock()
        self._active_threads: set[str] = set()
        self._active = 0
        self._queued = 0

    @property
    def active(self) -> int:
        return self._active

    @property
    def queued(self) -> int:
        return self._queued

    async def run(self, operation: Awaitable[T], *, thread_id: str | None = None) -> T:
        queued = False
        acquired = False
        registered_thread = False
        try:
            async with self._lock:
                if thread_id and thread_id in self._active_threads:
                    raise HTTPException(status_code=409, detail="thread already has an active run")
                if self._active >= self.max_active:
                    if self._queued >= self.max_queued:
                        raise HTTPException(
                            status_code=429,
                            detail="execution capacity exceeded",
                            headers={"Retry-After": "1"},
                        )
                    self._queued += 1
                    queued = True

            await self._semaphore.acquire()
            acquired = True
            async with self._lock:
                if queued:
                    self._queued -= 1
                    queued = False
                self._active += 1
                if thread_id:
                    self._active_threads.add(thread_id)
                    registered_thread = True
            return await operation
        except BaseException:
            if hasattr(operation, "close"):
                operation.close()  # type: ignore[attr-defined]
            raise
        finally:
            release = False
            async with self._lock:
                if queued:
                    self._queued -= 1
                if acquired and self._active > 0:
                    self._active -= 1
                    release = True
                if registered_thread and thread_id:
                    self._active_threads.discard(thread_id)
            if release:
                self._semaphore.release()


execution_gate = ExecutionGate()
