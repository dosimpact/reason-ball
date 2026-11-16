"""Deferred process-local protocol routes must not fake durable success."""
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.runs.runtime import runtime
from server.streaming.router import router as protocol_router
from server.threads.router import router as threads_router


def test_postgres_mode_explicitly_rejects_legacy_thread_protocols():
    runtime.reset()
    runtime.manager=SimpleNamespace(durable=True)
    app=FastAPI()
    app.include_router(protocol_router)
    app.include_router(threads_router)
    try:
        client=TestClient(app)
        assert client.get('/threads/thread/stream').status_code==501
        assert client.post('/threads/thread/stream/events',json={'channels':['values']}).status_code==501
        assert client.post('/threads/thread/commands',json={'id':'1','method':'run.start'}).status_code==501
    finally:
        runtime.reset()
