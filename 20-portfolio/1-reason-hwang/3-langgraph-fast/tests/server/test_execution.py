import asyncio

import pytest
from fastapi import HTTPException

from server.execution import ExecutionGate


@pytest.mark.asyncio
async def test_execution_gate_returns_result() -> None:
    gate = ExecutionGate(max_active=1, max_queued=1)

    async def operation() -> str:
        return "ok"

    assert await gate.run(operation(), thread_id="t-1") == "ok"
    assert gate.active == 0
    assert gate.queued == 0


@pytest.mark.asyncio
async def test_execution_gate_rejects_same_active_thread() -> None:
    gate = ExecutionGate(max_active=2, max_queued=1)
    started = asyncio.Event()
    release = asyncio.Event()

    async def slow() -> None:
        started.set()
        await release.wait()

    first = asyncio.create_task(gate.run(slow(), thread_id="same"))
    await started.wait()

    async def second() -> None:
        return None

    with pytest.raises(HTTPException) as error:
        await gate.run(second(), thread_id="same")
    assert error.value.status_code == 409
    release.set()
    await first


@pytest.mark.asyncio
async def test_execution_gate_rejects_queue_overflow() -> None:
    gate = ExecutionGate(max_active=1, max_queued=1)
    release = asyncio.Event()
    started = asyncio.Event()

    async def slow() -> None:
        started.set()
        await release.wait()

    first = asyncio.create_task(gate.run(slow(), thread_id="one"))
    await started.wait()
    second = asyncio.create_task(gate.run(slow(), thread_id="two"))
    await asyncio.sleep(0)

    async def overflow() -> None:
        return None

    with pytest.raises(HTTPException) as error:
        await gate.run(overflow(), thread_id="three")
    assert error.value.status_code == 429
    assert error.value.headers == {"Retry-After": "1"}
    release.set()
    await first
    await second
