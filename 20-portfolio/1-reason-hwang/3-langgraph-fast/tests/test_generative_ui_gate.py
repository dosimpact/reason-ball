import asyncio
import pytest
from fastapi import HTTPException
from server.generative_ui.gate import StreamGate

@pytest.mark.asyncio
async def test_gate_reserves_queued_threads_and_releases_on_cancellation():
    gate = StreamGate(active=1, queued=1)
    async with gate.reserve("active"):
        waiting = asyncio.Event()

        async def wait():
            waiting.set()
            async with gate.reserve("queued"):
                pass

        task = asyncio.create_task(wait())
        await waiting.wait()
        for name, status in [("queued", 409), ("overflow", 429)]:
            with pytest.raises(HTTPException) as error:
                async with gate.reserve(name):
                    pass
            assert error.value.status_code == status
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert gate.threads == {"active"}
    assert not gate.threads
    async with gate.reserve("next"):
        pass

