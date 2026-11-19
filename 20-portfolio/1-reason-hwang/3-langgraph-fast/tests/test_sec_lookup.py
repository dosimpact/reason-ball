"""Deterministic lookup preserves company identity, ambiguity and real activities."""
import asyncio
from unittest.mock import Mock

import httpx
import pytest

from domains.sec_tools.agent import search_companies
from domains.sec_tools.tools import SecBffClient
from domains.tenk.sec_client import SecReadError


def row(cik='0001326801', name='Meta Platforms, Inc.', ticker='METAM'):
    return {'cik': cik, 'name': name, 'ticker': ticker}


def client_for(log, handler):
    def respond(request):
        log.append(request)
        return httpx.Response(200, json=handler(request.url.params))
    return SecBffClient(transport=httpx.MockTransport(respond))


@pytest.mark.asyncio
async def test_exact_ticker_first_no_model_and_real_activity():
    log, events, model = [], [], Mock()
    client = client_for(log, lambda params: {'items': [row(ticker='META')], 'pagination': {'hasNextPage': False}})
    result = await search_companies(' meta ', model, client, events.append)
    assert result['items'][0]['cik'] == '0001326801'
    assert len(log) == 1
    assert log[0].url.params['ticker'] == 'META'
    assert not log[0].url.params.get('q')
    assert model.mock_calls == []
    assert [event['status'] for event in events] == ['running', 'completed']
    assert events[-1]['result']['items'][0]['name'] == 'Meta Platforms, Inc.'


@pytest.mark.asyncio
async def test_meta_after_ten_metals_selected_by_whole_leading_word():
    log = []
    metals = [row(f'{index:010}', f'COMMERCIAL METALS {index}', 'CMC') for index in range(11)]
    def handler(params):
        if params.get('ticker'):
            return {'items': [], 'pagination': {'hasNextPage': False}}
        assert params['q'] == 'META' and params['pageSize'] == '100'
        return {'items': [*metals, row('0000000111', 'Metavesco, Inc.', 'MVCO'), row()], 'pagination': {'hasNextPage': False}}
    result = await search_companies('META', Mock(), client_for(log, handler))
    assert result['items'] == [row()]
    assert len(log) == 2


@pytest.mark.asyncio
async def test_genuine_leading_name_ambiguity_remains_choices():
    log = []
    rows = [row(), row('0000000111', 'Meta Holdings Limited', 'OTHER')]
    result = await search_companies('Meta ', None, client_for(log, lambda params: {
        'items': [] if params.get('ticker') else rows, 'pagination': {'hasNextPage': False},
    }))
    assert result['items'] == rows


@pytest.mark.asyncio
async def test_name_query_is_not_altered_and_skips_ticker():
    log = []
    client = client_for(log, lambda params: {'items': [row()], 'pagination': {'hasNextPage': False}})
    result = await search_companies('Meta Platforms', Mock(), client)
    assert result['items'] == [row()]
    assert len(log) == 1
    assert log[0].url.params['q'] == 'Meta Platforms'
    assert not log[0].url.params.get('ticker')


@pytest.mark.asyncio
async def test_pagination_finds_leading_match_without_unbounded_reads():
    log = []
    def handler(params):
        page = int(params['page'])
        return {'items': [row()] if page == 2 else [row('0000000111', 'Metals Corporation', 'M')], 'pagination': {'hasNextPage': page < 2}}
    result = await search_companies('Meta Platforms', None, client_for(log, handler))
    assert result['items'] == [row()]
    assert [request.url.params['page'] for request in log] == ['1', '2']


@pytest.mark.asyncio
async def test_bounded_broad_results_keep_remaining_page_evidence():
    log = []
    client = client_for(log, lambda params: {'items': [row(f"{int(params['page']):010}", 'Some Metaverse Company', 'M')], 'pagination': {'hasNextPage': True}})
    result = await search_companies('Meta Platforms', None, client)
    assert len(log) == 5
    assert len(result['items']) == 5
    assert result['pagination']['hasNextPage'] is True


@pytest.mark.asyncio
@pytest.mark.parametrize('query', ['', ' ', 'x' * 151, None])
async def test_invalid_query_never_calls_tools(query):
    log = []
    with pytest.raises(SecReadError):
        await search_companies(query, Mock(), client_for(log, lambda _: {}))
    assert log == []


@pytest.mark.asyncio
@pytest.mark.parametrize('value', [None, {}, {'items': None}, {'items': ['bad']}, {'items': [{'name': 'bad'}]}, {'items': [], 'pagination': {'hasNextPage': 'true'}}])
async def test_malformed_results_fail(value):
    log = []
    with pytest.raises(SecReadError):
        await search_companies('Meta Platforms', None, client_for(log, lambda _: value))
    assert len(log) == 1


@pytest.mark.asyncio
async def test_ticker_result_scope_must_match():
    log = []
    with pytest.raises(SecReadError, match='티커 검색 범위'):
        await search_companies('META', None, client_for(log, lambda _: {'items': [row(ticker='OTHER')]}))
    assert len(log) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('error', [RuntimeError('private-error'), asyncio.CancelledError()])
async def test_error_and_cancellation_propagate(error, caplog):
    class Client:
        async def request(self, *args, **kwargs):
            raise error
    events = []
    with pytest.raises(type(error)) as caught:
        await search_companies('private-query', Mock(), Client(), events.append)
    assert caught.value is error
    assert events[-1]['status'] == ('cancelled' if isinstance(error, asyncio.CancelledError) else 'failed')
    assert 'private-' not in caplog.text


@pytest.mark.asyncio
async def test_http_failure_is_not_retried():
    log = []
    def respond(request):
        log.append(request)
        return httpx.Response(503)
    with pytest.raises(SecReadError, match='503'):
        await search_companies('META', None, SecBffClient(transport=httpx.MockTransport(respond)))
    assert len(log) == 1
