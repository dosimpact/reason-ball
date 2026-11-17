"""Confirmed collection uses one scoped observable tool and no model decisions."""
import asyncio
import json
from unittest.mock import Mock

import httpx
import pytest
from pydantic import ValidationError

from domains.sec_tools.agent import collect_company_filings
from domains.sec_tools.tools import SecBffClient
from domains.tenk.sec_client import SecReadError

CIK = '0001045810'
COMPLETE = {'companiesProcessed': 1, 'filingsSynced': 31, 'downloaded': 0, 'failed': 0}


def bff(log, stream=None, status=200):
    def respond(request):
        log.append(request)
        return httpx.Response(status, text=stream if stream is not None else 'event: completed\ndata: ' + json.dumps(COMPLETE) + '\n\n')
    return SecBffClient(transport=httpx.MockTransport(respond))


@pytest.mark.asyncio
@pytest.mark.parametrize('since', [None, '2024-11-01'])
async def test_exact_confirmed_scope_one_write_no_model_and_real_activity(since):
    log, events, model = [], [], Mock()
    result = await collect_company_filings(CIK, 2, since, model, bff(log), events.append)
    assert model.mock_calls == []
    assert len(log) == 1
    assert log[0].method == 'POST'
    assert log[0].url.path == '/api/sec/company-filing-sync-jobs'
    expected = {'ciks': [CIK], 'tickers': [], 'years': 2, 'downloadDocuments': True, 'refreshArchive': False}
    if since is not None:
        expected['since'] = since
    assert json.loads(log[0].content) == expected
    assert result == {'cik': CIK, 'years': 2, 'since': since, **COMPLETE, 'checkedAt': result['checkedAt']}
    assert result['checkedAt']
    assert [event['status'] for event in events] == ['running', 'completed']
    assert events[0]['id'] == events[1]['id']
    assert {key: value for key, value in events[0]['arguments'].items() if value is not None} == expected
    assert events[0]['kind'] == 'tool'
    assert events[1]['result']['filingsSynced'] == 31


@pytest.mark.asyncio
@pytest.mark.parametrize('stream', [
    'event: progress\ndata: {}\n\n',
    'event: error\ndata: {"message":"private-error"}\n\n',
    'event: completed\ndata: {"companiesProcessed":1,"filingsSynced":1,"downloaded":0,"failed":1}\n\n',
])
async def test_incomplete_failed_sse_never_succeeds_or_retries(stream):
    log = []
    with pytest.raises(SecReadError):
        await collect_company_filings(CIK, 2, None, None, bff(log, stream))
    assert len(log) == 1


class Client:
    def __init__(self, result=None, failure=None):
        self.result = result
        self.failure = failure
        self.calls = 0

    async def request(self, *args, **kwargs):
        self.calls += 1
        if self.failure is not None:
            raise self.failure
        return self.result


@pytest.mark.asyncio
@pytest.mark.parametrize('changes', [
    {'companiesProcessed': 0}, {'companiesProcessed': 2}, {'companiesProcessed': True},
    {'filingsSynced': -1}, {'downloaded': False}, {'failed': 1}, {'checkedAt': ''}, {'checkedAt': None},
])
async def test_completion_counters_and_time_must_be_valid(changes):
    client = Client({**COMPLETE, 'checkedAt': '2026-11-17', **changes})
    with pytest.raises(SecReadError):
        await collect_company_filings(CIK, 2, None, None, client)
    assert client.calls == 1


@pytest.mark.asyncio
async def test_missing_counters_are_not_accepted():
    client = Client({'checkedAt': '2026-11-17'})
    with pytest.raises(SecReadError):
        await collect_company_filings(CIK, 2, None, None, client)
    assert client.calls == 1


@pytest.mark.asyncio
async def test_http_failure_has_no_retry():
    log = []
    with pytest.raises(SecReadError, match='503'):
        await collect_company_filings(CIK, 2, None, None, bff(log, status=503))
    assert len(log) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', [httpx.ConnectError('private-transport'), asyncio.CancelledError()])
async def test_transport_and_cancellation_propagate_with_activity(failure):
    client, events = Client(failure=failure), []
    with pytest.raises(type(failure)) as caught:
        await collect_company_filings(CIK, 2, None, None, client, events.append)
    assert caught.value is failure
    assert client.calls == 1
    assert events[-1]['status'] == ('cancelled' if isinstance(failure, asyncio.CancelledError) else 'failed')


@pytest.mark.asyncio
@pytest.mark.parametrize('cik,years', [('1045810', 2), (CIK, 0), (CIK, 31)])
async def test_invalid_scope_rejected_before_any_write(cik, years):
    client = Client(COMPLETE)
    with pytest.raises(ValidationError):
        await collect_company_filings(cik, years, None, None, client)
    assert client.calls == 0


@pytest.mark.asyncio
async def test_logs_do_not_contain_provider_payload_or_scope(caplog):
    client = Client(failure=RuntimeError('private-error-payload'))
    with pytest.raises(RuntimeError):
        await collect_company_filings(CIK, 2, None, None, client)
    assert 'exception=RuntimeError' in caplog.text
    assert 'private-' not in caplog.text
    assert CIK not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize('stream', [
    'event: progress\ndata: {}\n\n',
    'event: error\ndata: {"message":"private-error"}\n\n',
    'event: completed\ndata: {"companiesProcessed":1,"failed":1}\n\n',
    'event: completed\ndata: {"companiesProcessed":1,"failed":0}\n\n',
    'event: completed\ndata: {"companiesProcessed":0,"filingsSynced":0,"downloaded":0,"failed":0}\n\n',
    'event: completed\ndata: {"companiesProcessed":1,"filingsSynced":true,"downloaded":0,"failed":0}\n\n',
    'event: completed\ndata: {"companiesProcessed":1,"filingsSynced":0,"downloaded":-1,"failed":0}\n\n',
])
async def test_incomplete_or_invalid_sse_never_succeeds_or_retries(stream):
    log = []
    with pytest.raises(SecReadError):
        await collect_company_filings(CIK, 2, None, None, bff(log, stream=stream))
    assert len(log) == 1


@pytest.mark.asyncio
async def test_http_failure_is_not_retried():
    log = []
    with pytest.raises(SecReadError, match='503'):
        await collect_company_filings(CIK, 2, None, None, bff(log, status=503))
    assert len(log) == 1
