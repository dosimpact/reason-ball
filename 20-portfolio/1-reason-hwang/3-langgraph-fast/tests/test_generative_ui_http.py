import json

import pytest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.generative_ui import router as module


def events(response):
    return [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]


def test_session_isolation_failed_output_and_stale_actions(monkeypatch):
    class Graph:
        async def ainvoke(self, state):
            if state['question'] == 'fail':
                raise ValueError('private provider details')
            return {**state, 'data': {'flightId': 'demo-icn-nrt', 'selected': bool(state.get('action'))}, 'revision': state.get('revision', 0) + 1, 'program': '', 'controls': 'root = Col([Text("ok")]);'}
    monkeypatch.setattr(module, 'create_graph', lambda mode: Graph())
    monkeypatch.setattr(module, 'sessions', {})
    app = FastAPI()
    app.include_router(module.router)
    with TestClient(app) as client:
        initial = client.post('/api/generative-ui/fixed', json={'thread_id': 'one', 'message': 'flight'})
        assert events(initial)[-1]['type'] == 'RUN_FINISHED'
        failed = client.post('/api/generative-ui/fixed', json={'thread_id': 'one', 'message': 'fail'})
        assert events(failed)[-1]['type'] == 'RUN_ERROR'
        assert 'private provider' not in failed.text
        assert module.sessions['fixed:one']['state']['revision'] == 1
        action = {'name': 'select_flight', 'revision': 1, 'context': {'flightId': 'demo-icn-nrt'}}
        for mode, thread in [('dynamic', 'one'), ('fixed', 'foreign')]:
            assert client.post(f'/api/generative-ui/{mode}', json={'thread_id': thread, 'action': action}).status_code == 422
        selected = client.post('/api/generative-ui/fixed', json={'thread_id': 'one', 'action': action})
        assert events(selected)[-1]['type'] == 'RUN_FINISHED'
        assert client.post('/api/generative-ui/fixed', json={'thread_id': 'one', 'action': action}).status_code == 422
        assert not module.gate.threads


@pytest.mark.asyncio
async def test_cancelled_output_releases_thread_without_committing(monkeypatch):
    import asyncio
    from domains.generative_ui.contracts import UIRequest
    from server.generative_ui.gate import StreamGate

    started, cancelled = asyncio.Event(), asyncio.Event()

    class Graph:
        async def ainvoke(self, state):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()

    monkeypatch.setattr(module, 'create_graph', lambda mode: Graph())
    monkeypatch.setattr(module, 'sessions', {})
    monkeypatch.setattr(module, 'gate', StreamGate())
    response = await module.run('fixed', UIRequest(thread_id='cancel', message='flight'))
    iterator = response.body_iterator
    await anext(iterator)  # RUN_STARTED
    await anext(iterator)  # activity from the running operation
    await started.wait()
    await iterator.aclose()
    assert cancelled.is_set()
    assert not module.sessions
    assert not module.gate.threads
    # The same thread can reserve another run after disconnecting.
    async with module.gate.reserve('fixed:cancel'):
        pass


@pytest.mark.asyncio
async def test_capacity_counts_uncommitted_sessions(monkeypatch):
    import time
    from fastapi import HTTPException
    from domains.generative_ui.contracts import UIRequest
    from server.generative_ui.gate import StreamGate

    monkeypatch.setattr(module, 'gate', StreamGate())
    monkeypatch.setattr(module, 'sessions', {
        f'fixed:{i}': {'state': {}, 'touched': time.monotonic()} for i in range(199)
    })
    async with module.gate.reserve('fixed:pending'):
        with pytest.raises(HTTPException) as error:
            await module.run('fixed', UIRequest(thread_id='overflow', message='flight'))
        assert error.value.status_code == 429
        assert module.gate.threads == {'fixed:pending'}
