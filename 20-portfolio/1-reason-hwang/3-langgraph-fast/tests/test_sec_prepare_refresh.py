"""Prepare uses saved filings unless refresh is explicitly requested."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from server.sec_chat import router as module


@pytest.mark.parametrize(('body', 'expected'), [
    ({'cik': '0000320193'}, False),
    ({'cik': '0000320193', 'refresh': False}, False),
    ({'cik': '0000320193', 'refresh': True}, True),
])
def test_prepare_refresh_default_and_explicit_override(monkeypatch, body, expected):
    calls = []

    async def prepare(cik, refresh, model, activity=None):
        calls.append((cik, refresh))
        return {'sections': {'Item 1': 'Saved fixture document'}, 'fixtureRefresh': refresh}

    monkeypatch.setattr(module, 'prepare_filing', prepare)
    monkeypatch.setattr(module, 'chat_model', lambda: object())
    monkeypatch.setattr(module, 'sessions', {})
    app = FastAPI()
    app.include_router(module.router)
    with TestClient(app) as client:
        response = client.post('/api/sec-chat/prepare', json=body)
    assert response.status_code == 200
    assert response.json()['fixtureRefresh'] is expected
    assert response.json()['items'] == ['Item 1']
    assert calls == [('0000320193', expected)]
