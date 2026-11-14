import asyncio
import hashlib
import json
import threading

from domains.sec_modeling.store import GraphStore, RunAlreadyExecuting

_tasks = {}
_cancel = {}
_lock = threading.Lock()


async def execute(stage, request, queue):
    store = GraphStore()
    generation = hashlib.sha256(
        (request.runId + request.executionToken).encode()
    ).hexdigest()
    flag = threading.Event()
    _cancel[request.runId] = (request.executionToken, flag)
    loop = asyncio.get_running_loop()

    def progress(**data):
        loop.call_soon_threadsafe(
            queue.put_nowait, {"type": "progress", "runId": request.runId, **data}
        )

    try:
        store.initialize()
        existing = store.run_state(request.runId)
        if (
            existing.get("executionToken")
            and existing["executionToken"] != request.executionToken
        ):
            raise ValueError("Run id belongs to another execution token")
        if existing["status"] == "SUCCEEDED":
            await queue.put(
                {
                    "type": "completed",
                    "runId": request.runId,
                    "generationId": existing["generationId"],
                    "counts": existing.get("counts", {}),
                }
            )
            return
        store.claim(request.runId, request.executionToken)
        if stage in (1, 3):
            if not request.sourceHtml:
                raise ValueError("sourceHtml required")
            actual = hashlib.sha256(request.sourceHtml.encode()).hexdigest()
            if request.sourceHash and request.sourceHash != actual:
                raise ValueError("sourceHash mismatch")
            request.sourceHash = actual
        config_hash = hashlib.sha256(
            json.dumps(
                {
                    "stage": stage,
                    "version": "sec-modeling/2",
                    "chunkerVersion": "sec-chunker/2",
                    "model": request.extractionModel,
                    "embedding": "text-embedding-3-small/1536",
                },
                sort_keys=True,
            ).encode()
        ).hexdigest()

        def work():
            # Toolkit configuration is process-global. Serialize all modeling to avoid model cross-talk.
            with _lock:
                if flag.is_set():
                    raise InterruptedError("Execution cancelled")
                if stage == 1:
                    from domains.sec_modeling.model1 import build_document

                    return build_document(request, generation, store)
                if stage == 2:
                    from domains.sec_modeling.model2 import build_lexical

                    return build_lexical(
                        request,
                        generation,
                        store,
                        progress,
                        lambda: (
                            flag.is_set()
                            or store.run_state(request.runId)["status"] == "CANCELLED"
                        ),
                    )
                from domains.sec_modeling.model3 import build_xbrl

                return build_xbrl(request, generation, store)

        counts = await asyncio.to_thread(work)
        if flag.is_set():
            raise InterruptedError("Execution cancelled")
        store.publish(request, stage, generation, counts, config_hash)
        await queue.put(
            {
                "type": "completed",
                "runId": request.runId,
                "generationId": generation,
                "counts": counts,
            }
        )
    except Exception as error:  # noqa: BLE001 - worker boundary persists all terminal failures
        status = "CANCELLED" if isinstance(error, InterruptedError) else "FAILED"
        if not isinstance(error, RunAlreadyExecuting):
            store.finish_failed(
                request.runId, request.executionToken, status, type(error).__name__
            )
        # Do not forward provider errors (may include endpoints, headers, credentials).
        message = (
            str(error)
            if isinstance(error, (ValueError, InterruptedError))
            else f"Modeling failed: {type(error).__name__}"
        )
        await queue.put(
            {
                "type": "error",
                "runId": request.runId,
                "code": status,
                "message": message,
            }
        )
    finally:
        store.close()
        _cancel.pop(request.runId, None)
        await queue.put(None)


def launch(stage, request):
    if request.runId in _tasks and not _tasks[request.runId].done():
        raise ValueError("Run already executing")
    queue = asyncio.Queue()
    task = asyncio.create_task(execute(stage, request, queue))
    _tasks[request.runId] = task
    task.add_done_callback(lambda completed: _tasks.pop(request.runId, None))
    return queue


def cancel(run_id, token):
    pair = _cancel.get(run_id)
    graph = GraphStore()
    try:
        graph.cancel(run_id, token)
    finally:
        graph.close()
    if pair:
        if pair[0] != token:
            raise ValueError("Execution token mismatch")
        pair[1].set()
