"""Preparation is ordered, scoped and independent of model tool selection."""
import asyncio
import hashlib
from unittest.mock import Mock

import httpx
import pytest

from domains.sec_tools.agent import prepare_filing
from domains.sec_tools.tools import SecBffClient
from domains.tenk.sec_client import SecReadError
from tests.test_sec_intelligent_ui import FILING, HTML


class Client:
    def __init__(self, listings=None, content=HTML, failure=None, sync=None):
        self.listings = listings or {FILING['cik']: {'items': [FILING]}}
        self.content = content
        self.failure = failure
        self.sync = sync or {'companiesProcessed': 1, 'filingsSynced': 1, 'downloaded': 1, 'failed': 0, 'checkedAt': '2026-11-17'}
        self.calls = []

    async def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        if self.failure is not None:
            raise self.failure
        if method == 'POST':
            return self.sync
        if path == 'filings':
            return self.listings[kwargs['params']['cik']]
        return self.content


@pytest.mark.asyncio
@pytest.mark.parametrize('refresh', [False, True])
async def test_exact_tool_arguments_events_and_no_model(refresh):
    client, events, model = Client(), [], Mock()
    result = await prepare_filing(FILING['cik'], refresh, model, client, events.append)
    model.assert_not_called()
    assert model.mock_calls == []
    assert result['filing']['accessionNo'] == FILING['accessionNo']
    assert bool(result['checkedAt']) == refresh
    assert [e['status'] for e in events] == ['running', 'completed'] * (3 if refresh else 2)
    assert all(e['kind'] == 'tool' for e in events)
    listing = next(call for call in client.calls if call[1] == 'filings')
    assert listing[2]['params'] == {
        'cik': FILING['cik'], 'formType': '10-K', 'page': 1, 'pageSize': 10,
        'includeContent': False, 'includeAmendments': False, 'includeFormerRegistrants': False,
    }
    assert client.calls[-1][1] == f"filings/{FILING['cik']}/{FILING['accessionNo']}/content"
    if refresh:
        assert client.calls[0][2]['body'] == {'ciks': [FILING['cik']], 'tickers': [], 'years': 2, 'downloadDocuments': True, 'refreshArchive': False}


@pytest.mark.asyncio
@pytest.mark.parametrize('status', ['pending', 'failed'])
async def test_newest_not_downloaded_never_reads_older(status):
    newest = {**FILING, 'filingDate': '2026-11-01', 'accessionNo': '0000320193-26-000001', 'status': status}
    client = Client({FILING['cik']: {'items': [FILING, newest]}})
    with pytest.raises(SecReadError, match='다운로드'):
        await prepare_filing(FILING['cik'], False, None, client)
    assert len(client.calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('refresh', [False, True])
async def test_predecessor_after_empty_own_listing(refresh):
    requested, former = '0002115436', '0000034088'
    client = Client({requested: {'items': []}, former: {'items': [{**FILING, 'cik': former}]}})
    result = await prepare_filing(requested, refresh, None, client)
    assert result['requestedCik'] == requested
    assert result['filing']['cik'] == former
    expected = ['company-filing-sync-jobs', 'filings'] * 2 if refresh else ['filings'] * 2
    assert [call[1] for call in client.calls[:-1]] == expected
    listings = [call[2]['params'] for call in client.calls if call[1] == 'filings']
    assert [row['cik'] for row in listings] == [requested, former]
    assert [row['includeFormerRegistrants'] for row in listings] == [False, True]
    if refresh:
        assert [call[2]['body']['ciks'] for call in client.calls if call[0] == 'POST'] == [[requested], [former]]


@pytest.mark.asyncio
async def test_own_filing_prevents_predecessor_lookup():
    requested = '0002115436'
    client = Client({requested: {'items': [{**FILING, 'cik': requested}]}})
    result = await prepare_filing(requested, False, None, client)
    assert 'requestedCik' not in result
    assert len(client.calls) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('listing', [None, {}, {'items': None}, {'items': []}, {'items': ['bad']}, {'items': [{**FILING, 'cik': '0000000001'}]}, {'items': [{**FILING, 'formType': '10-Q'}]}, {'items': [{**FILING, 'accessionNo': None}]}])
async def test_invalid_or_empty_listing_stops_before_content(listing):
    client = Client({FILING['cik']: listing})
    with pytest.raises(SecReadError):
        await prepare_filing(FILING['cik'], False, None, client)
    assert len(client.calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', [httpx.ConnectError('private-network'), asyncio.CancelledError()])
async def test_transport_and_cancellation_propagate(failure):
    events = []
    client = Client(failure=failure)
    with pytest.raises(type(failure)) as caught:
        await prepare_filing(FILING['cik'], False, None, client, events.append)
    assert caught.value is failure
    assert len(client.calls) == 1
    assert events[-1]['status'] == ('cancelled' if isinstance(failure, asyncio.CancelledError) else 'failed')


@pytest.mark.asyncio
async def test_http_error_from_real_client_propagates():
    client = SecBffClient(transport=httpx.MockTransport(lambda _: httpx.Response(503)))
    with pytest.raises(SecReadError, match='503'):
        await prepare_filing(FILING['cik'], False, None, client)


@pytest.mark.asyncio
@pytest.mark.parametrize('changes', [{'failed': 1}, {'companiesProcessed': 0}, {'downloaded': True}, {'checkedAt': ''}])
async def test_incomplete_sync_stops_before_listing(changes):
    client = Client()
    client.sync.update(changes)
    with pytest.raises(SecReadError, match='동기화'):
        await prepare_filing(FILING['cik'], True, None, client)
    assert len(client.calls) == 1


@pytest.mark.asyncio
async def test_full_content_artifact_used_despite_excerpt_limit():
    content = HTML + ' private-long-content ' * 5000
    client, events = Client(content=content), []
    source = await prepare_filing(FILING['cik'], False, None, client, events.append)
    assert source['sha256'] == hashlib.sha256(content.encode()).hexdigest()
    visible = events[-1]['result']
    assert len(visible['text']) == 20000
    assert visible['nextOffset'] == 20000
    assert visible['totalCharacters'] > 60000


@pytest.mark.asyncio
async def test_logs_do_not_include_payloads(caplog):
    client = Client(failure=RuntimeError('private-provider-payload'))
    with pytest.raises(RuntimeError):
        await prepare_filing(FILING['cik'], False, None, client)
    assert 'stage=list_sec_filings exception=RuntimeError' in caplog.text
    assert 'private-' not in caplog.text
    assert FILING['cik'] not in caplog.text
