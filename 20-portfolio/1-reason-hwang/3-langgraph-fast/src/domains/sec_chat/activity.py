"""Public execution status only: no prompts, model reasoning or provider payloads."""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from uuid import uuid4

ActivitySink = Callable[[dict], None]
logger = logging.getLogger(__name__)


def tracked_node(label: str, node, sink: ActivitySink | None = None):
    async def run(state):
        identity = uuid4().hex

        def emit(status: str):
            if sink:
                sink({"id": identity, "label": label, "status": status, "kind": "node"})

        emit("running")
        try:
            result = await node(state)
            unavailable = result.get("followUpsStatus") == "unavailable" or result.get("response", {}).get("followUpsStatus") == "unavailable"
            emit("unavailable" if unavailable else "completed")
            return result
        except asyncio.CancelledError:
            emit("cancelled")
            raise
        except Exception as error:
            logger.warning("SEC node failed stage=%s exception=%s", label, type(error).__name__)
            emit("failed")
            raise

    return run
