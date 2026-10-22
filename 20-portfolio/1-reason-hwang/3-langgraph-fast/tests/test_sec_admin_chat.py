import importlib
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

module = importlib.import_module('server.sec_deep_agent.router')


def client():
    app = FastAPI()
    app.include_router(module.router)
    return TestClient(app)


def test_openui_stream_preserves_tool_lifecycle_and_history(monkeypatch):
    async def research(body, sink):
        assert body.message == 'AAPL'
        assert body.history[0].text == 'Earlier answer'
        for status in ('running', 'completed'):
            sink({'id': 'tool1', 'label': 'SEC 도구 · search_sec_companies', 'status': status})
        return {'report': 'Apple', 'sources': []}

    async def compose(question, answer, model, **kwargs):
        assert kwargs['host_evidence'] is False
        return 'root = Markdown("Apple");'

    monkeypatch.setattr(module, 'research', research)
    monkeypatch.setattr(module, 'compose_ui', compose)
    monkeypatch.setattr(module, 'chat_model', lambda: None)
    response = client().post('/api/sec-deep-agent/chat', json={
        'threadId': 'thread', 'runId': 'run', 'messages': [
            {'role': 'assistant', 'content': 'Earlier answer'}, {'role': 'user', 'content': 'AAPL'}]})
    events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
    assert [e['type'] for e in events] == ['RUN_STARTED', 'TOOL_CALL_START', 'TOOL_CALL_ARGS', 'TOOL_CALL_END', 'TOOL_CALL_RESULT', 'TEXT_MESSAGE_START', 'TEXT_MESSAGE_CONTENT', 'TEXT_MESSAGE_END', 'RUN_FINISHED']
    assert events[1]['toolCallName'] == 'search_sec_companies'
    assert events[6]['delta'] == 'root = Markdown("Apple");'


def test_invalid_message_and_sanitized_failure(monkeypatch):
    body = {'threadId': 't', 'runId': 'r', 'messages': [{'role': 'assistant', 'content': 'hi'}]}
    assert client().post('/api/sec-deep-agent/chat', json=body).status_code == 422
    async def fail(*args):
        raise RuntimeError('private upstream detail')
    monkeypatch.setattr(module, 'research', fail)
    body['messages'] = [{'role': 'user', 'content': 'hello'}]
    response = client().post('/api/sec-deep-agent/chat', json=body)
    assert 'RUN_ERROR' in response.text
    assert 'private upstream detail' not in response.text
    assert 'RUN_FINISHED' not in response.text
