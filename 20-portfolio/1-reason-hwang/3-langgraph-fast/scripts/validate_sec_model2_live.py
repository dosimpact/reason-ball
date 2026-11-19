"""Explicit real-model execution; never supplies fixture embeddings/extractions."""

import asyncio
import json
from pathlib import Path
from uuid import uuid4

from domains.sec_modeling.contracts import ModelingRequest
from domains.sec_modeling.runtime import execute
from domains.sec_modeling.store import GraphStore


async def main():
    execution_id = uuid4().hex
    out = Path(".tmp/sec-modeling-live")
    out.mkdir(parents=True, exist_ok=True)
    for cik, acc in [
        ("0000320193", "0000320193-26-000026"),
        ("0001834584", "0001834584-26-000024"),
        ("0001045810", "0001045810-26-000021"),
    ]:
        store = GraphStore()
        try:
            active = store.active(f"filing:{cik}:{acc}", 1)
        finally:
            store.close()
        if not active:
            raise ValueError("Published model1 required")
        request = ModelingRequest(
            runId=f"live-model2-{cik}-{execution_id}",
            executionToken=execution_id,
            cik=cik,
            accessionNo=acc,
            inputGenerationId=active["id"],
            sourceHash=active["sourceHash"],
        )
        queue = asyncio.Queue()
        task = asyncio.create_task(execute(2, request, queue))
        failure = None
        with (out / f"{cik}.ndjson").open("a") as log:
            while True:
                event = await queue.get()
                if event is None:
                    break
                if event.get("type") == "error":
                    failure = event.get("message", "Modeling execution failed")
                line = json.dumps(event)
                log.write(line + "\n")
                log.flush()
                print(line, flush=True)
        await task
        if failure:
            raise RuntimeError(failure)


if __name__ == "__main__":
    asyncio.run(main())
