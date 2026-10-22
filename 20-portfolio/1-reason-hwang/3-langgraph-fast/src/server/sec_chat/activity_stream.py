"""Forward live node status with heartbeats and task cleanup on disconnection."""
from __future__ import annotations

import asyncio


async def activity_stream(operation):
    queue: asyncio.Queue = asyncio.Queue()

    async def run():
        try:
            result = await operation(lambda activity: queue.put_nowait(("activity", activity)))
            queue.put_nowait(("result", result))
        finally:
            queue.put_nowait(("end", None))

    task = asyncio.create_task(run())
    try:
        while True:
            try:
                kind, payload = await asyncio.wait_for(queue.get(), timeout=10)
            except TimeoutError:
                yield "heartbeat", None
                continue
            if kind == "end":
                await task  # Propagate failure after already queued failure events.
                break
            yield kind, payload
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)
