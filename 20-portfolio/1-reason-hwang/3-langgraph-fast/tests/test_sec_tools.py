"""SEC-DEEP-001/002/003: actual ToolNode dispatch against an isolated BFF transport."""
import asyncio

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, HumanMessage

from domains.sec_tools.agent import (
    artifacts,
    build_tool_graph,
    collect_company_filings,
    prepare_filing,
    search_companies,
)
from domains.sec_tools.tools import SecBffClient, build_sec_tools
from domains.tenk.sec_client import SecReadError
from graph.primary_graphs.sec_deep_agent.workflow import build_sec_deep_agent
from tests.test_sec_intelligent_ui import FILING, HTML


class ToolModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def call(name, **args):
    return AIMessage(content='', tool_calls=[{'name': name, 'args': args, 'id': name, 'type': 'tool_call'}])


def client_with(log, *, stream='event: completed\ndata: {"companiesProcessed":1,"filingsSynced":1,"downloaded":1,"failed":0}\n\n', rows=None):
    def respond(request):
        log.append(request)
        path = request.url.path
        if path.endswith('/content'):
            return httpx.Response(200, text=HTML)
        if request.method == 'POST':
            if path.endswith('/company-sync-jobs'):
                return httpx.Response(201, json={'syncedCount': 1})
            return httpx.Response(200, text=stream, headers={'content-type': 'text/event-stream'})
        items = [{'cik': FILING['cik'], 'ticker': 'AAPL', 'name': 'Apple'}] if path.endswith('/companies') else (rows if rows is not None else [FILING])
        return httpx.Response(200, json={'items': items, 'pagination': {'page': 1, 'hasNextPage': False}})
    return SecBffClient(transport=httpx.MockTransport(respond))


@pytest.mark.asyncio
async def test_all_six_endpoints_dispatched_by_model_tool_calls():
    log, events = [], []
    client = client_with(log)
    calls = [call('search_sec_companies', ticker='AAPL'), call('list_sec_filings', cik=FILING['cik'], formType='10-K', includeContent=True),
             call('get_sec_filing_content', cik=FILING['cik'], accessionNo=FILING['accessionNo']),
             call('sync_sec_companies'), call('sync_sec_company_filings', ciks=[FILING['cik']], years=2),
             call('sync_all_sec_company_filings', years=1, downloadDocuments=False)]
    result = await build_tool_graph(ToolModel(responses=[*calls, AIMessage(content='done')]), build_sec_tools(client, events.append), 'test').ainvoke({'messages': [HumanMessage(content='test')]})
    records = artifacts(result)
    assert len(records) == 6
    assert len(log) == 6
    assert [request.method for request in log] == ['GET', 'GET', 'GET', 'POST', 'POST', 'POST']
    assert log[1].url.params['includeContent'] == 'true'
    assert records[2]['result'] == HTML
    assert records[4]['result']['checkedAt']
    assert [event['status'] for event in events] == ['running', 'completed'] * 6
    assert result['messages'][-1].content == 'done'


@pytest.mark.asyncio
@pytest.mark.parametrize('stream', ['event: progress\ndata: {}\n\n', 'event: completed\ndata: {"failed":1}\n\n', 'event: error\ndata: {"message":"secret"}\n\n'])
async def test_sync_rejects_incomplete_and_failed_sse(stream):
    tool = build_sec_tools(client_with([], stream=stream))[4]
    with pytest.raises(SecReadError):
        await tool.ainvoke({'ciks': [FILING['cik']]})


@pytest.mark.asyncio
async def test_scope_and_no_sync_are_enforced_before_http():
    log = []
    tools = build_sec_tools(client_with(log), allowed_ciks={FILING['cik']}, allow_sync=False)
    with pytest.raises(SecReadError):
        await tools[1].ainvoke({'cik': '0000000001'})
    with pytest.raises(SecReadError):
        await tools[4].ainvoke({'ciks': [FILING['cik']]})
    assert not log


@pytest.mark.asyncio
async def test_search_uses_real_tool_and_ignores_model_only_claims():
    from unittest.mock import Mock
    for responses in [[AIMessage(content='invented')], []]:
        log = []
        model = Mock(wraps=ToolModel(responses=responses))
        assert (await search_companies('AAPL', model, client_with(log)))['items'][0]['cik'] == FILING['cik']
        assert len(log) == 1
        assert log[0].url.params['ticker'] == 'AAPL'
        assert model.mock_calls == []


@pytest.mark.asyncio
async def test_collection_calls_only_selected_company_sync_and_checks_completed_event():
    log = []
    model = ToolModel(responses=[call('sync_sec_company_filings', ciks=[FILING['cik']], years=3), AIMessage(content='done')])
    result = await collect_company_filings(FILING['cik'], 3, None, model, client_with(log))
    assert result['cik'] == FILING['cik']
    assert result['filingsSynced'] == 1 and result['downloaded'] == 1
    assert len(log) == 1 and log[0].method == 'POST'
    assert log[0].url.path == '/api/sec/company-filing-sync-jobs'
    assert log[0].read().decode() == f'{{"years":3,"downloadDocuments":true,"refreshArchive":false,"ciks":["{FILING["cik"]}"],"tickers":[]}}'


@pytest.mark.asyncio
async def test_collection_ignores_wrong_arguments_and_model_only_claims():
    from unittest.mock import Mock
    for responses in ([call('sync_sec_company_filings', ciks=['0000000001'], years=20)], [AIMessage(content='downloaded')], []):
        log = []
        model = Mock(wraps=ToolModel(responses=responses))
        result = await collect_company_filings(FILING['cik'], 3, None, model, client_with(log))
        assert result['failed'] == 0
        assert len(log) == 1
        import json
        assert json.loads(log[0].content)['ciks'] == [FILING['cik']]
        assert json.loads(log[0].content)['years'] == 3
        assert model.mock_calls == []


@pytest.mark.asyncio
async def test_collection_calls_selected_sync_only_once_even_if_model_repeats():
    from unittest.mock import Mock
    log = []
    sync = call('sync_sec_company_filings', ciks=[FILING['cik']], years=2)
    model = Mock(wraps=ToolModel(responses=[sync, sync, AIMessage(content='done')]))
    result = await collect_company_filings(FILING['cik'], 2, None, model, client_with(log))
    assert result['companiesProcessed'] == 1
    assert len(log) == 1
    assert model.mock_calls == []


def test_collect_api_sse_uses_selected_bff_post_and_does_not_report_failure_as_success(monkeypatch):
    from domains.sec_tools import tools as sec_tools
    from server.sec_chat import router as sec_router

    captured = []
    stream = 'event: completed\ndata: {"companiesProcessed":1,"filingsSynced":4,"downloaded":3,"failed":0}\n\n'

    def respond(request):
        captured.append(request)
        return httpx.Response(200, text=stream, headers={'content-type': 'text/event-stream'})

    def init(self, base_url=None, transport=None):
        self.base_url = 'http://sec-bff.test'
        self.transport = httpx.MockTransport(respond)

    monkeypatch.setattr(sec_tools.SecBffClient, '__init__', init)
    monkeypatch.setattr(sec_router, 'chat_model', lambda: ToolModel(responses=[call('sync_sec_company_filings', ciks=[FILING['cik']], years=2), AIMessage(content='done')]))
    app = FastAPI()
    app.include_router(sec_router.router)
    with TestClient(app) as client:
        assert client.post('/api/sec-chat/collect', json={'cik': FILING['cik'], 'years': 2, 'since': '2026-99-99'}).status_code == 422
        response = client.post('/api/sec-chat/collect', json={'cik': FILING['cik'], 'years': 2}, headers={'Accept': 'text/event-stream'})
        assert response.status_code == 200
        assert 'RUN_FINISHED' in response.text and '메타데이터 4건' in response.text
        assert len(captured) == 1 and captured[0].url.path == '/api/sec/company-filing-sync-jobs'
        stream = 'event: completed\ndata: {"companiesProcessed":1,"filingsSynced":4,"downloaded":2,"failed":1}\n\n'
        response = client.post('/api/sec-chat/collect', json={'cik': FILING['cik'], 'years': 2}, headers={'Accept': 'text/event-stream'})
        assert 'RUN_ERROR' in response.text and 'RUN_FINISHED' not in response.text


@pytest.mark.asyncio
@pytest.mark.parametrize('refresh', [False, True])
async def test_prepare_preserves_verified_source_and_requires_tool_chain(refresh):
    log = []
    calls = ([call('sync_sec_company_filings', ciks=[FILING['cik']], years=2)] if refresh else [])
    calls += [call('list_sec_filings', cik=FILING['cik'], formType='10-K'), call('get_sec_filing_content', cik=FILING['cik'], accessionNo=FILING['accessionNo']), AIMessage(content='ready')]
    result = await prepare_filing(FILING['cik'], refresh, ToolModel(responses=calls), client_with(log))
    assert result['filing']['accessionNo'] == FILING['accessionNo']
    assert bool(result['checkedAt']) == refresh
    assert result['sections']['8']
    assert len(log) == (3 if refresh else 2)


@pytest.mark.asyncio
async def test_prepare_does_not_replace_latest_pending_with_old_downloaded():
    newer = {**FILING, 'accessionNo': '0000320193-26-999999', 'filingDate': '2026-10-22', 'status': 'pending'}
    model = ToolModel(responses=[call('list_sec_filings', cik=FILING['cik'], formType='10-K'), call('get_sec_filing_content', cik=FILING['cik'], accessionNo=FILING['accessionNo']), AIMessage(content='ready')])
    with pytest.raises(SecReadError):
        await prepare_filing(FILING['cik'], False, model, client_with([], rows=[newer, FILING]))


@pytest.mark.asyncio
async def test_independent_deep_agent_uses_sec_tools_and_returns_report():
    log = []
    model = ToolModel(responses=[call('search_sec_companies', ticker='AAPL'), call('list_sec_filings', cik=FILING['cik'], formType='10-K'), call('get_sec_filing_content', cik=FILING['cik'], accessionNo=FILING['accessionNo']), AIMessage(content='# SEC Report\nEvidence-backed fixture report')])
    result = await build_sec_deep_agent(model, client_with(log)).ainvoke({'messages': [HumanMessage(content='Report')]})
    assert len(artifacts(result)) == 3
    assert result['messages'][-1].text.startswith('# SEC Report')
    assert len(log) == 3


@pytest.mark.asyncio
async def test_tool_cancellation_propagates():
    class Client:
        async def request(self, *args, **kwargs):
            raise asyncio.CancelledError()
    events = []
    with pytest.raises(asyncio.CancelledError):
        await build_sec_tools(Client(), events.append)[0].ainvoke({'q': 'Apple'})
    assert events[-1]['status'] == 'cancelled'


@pytest.mark.asyncio
async def test_excerpt_next_offset_is_absolute_even_with_query():
    tool = build_sec_tools(client_with([]))[2]
    args = {'cik': FILING['cik'], 'accessionNo': FILING['accessionNo'], 'query': 'Item', 'limit': 100}
    first = await tool.ainvoke({'name': tool.name, 'id': 'first', 'args': args, 'type': 'tool_call'})
    import json
    data = json.loads(first.content)
    assert data['nextOffset']
    second = await tool.ainvoke({'name': tool.name, 'id': 'second', 'args': {**args, 'offset': data['nextOffset']}, 'type': 'tool_call'})
    assert json.loads(second.content)['offset'] == data['nextOffset']


@pytest.mark.asyncio
async def test_predecessor_is_only_used_after_empty_requested_filing_list():
    requested = '0002115436'
    predecessor = '0000034088'
    former_filing = {**FILING, 'cik': predecessor}
    log = []
    def respond(request):
        log.append(request)
        if request.url.path.endswith('/content'):
            return httpx.Response(200, text=HTML)
        rows = [former_filing] if request.url.params.get('cik') == predecessor else []
        return httpx.Response(200, json={'items': rows, 'pagination': {'page': 1}})
    model = ToolModel(responses=[call('list_sec_filings', cik=requested, formType='10-K'), call('list_sec_filings', cik=predecessor, formType='10-K', includeFormerRegistrants=True), call('get_sec_filing_content', cik=predecessor, accessionNo=FILING['accessionNo']), AIMessage(content='ready')])
    source = await prepare_filing(requested, False, model, SecBffClient(transport=httpx.MockTransport(respond)))
    assert source['requestedCik'] == requested
    assert source['filing']['cik'] == predecessor
    assert predecessor in source['issuerNote']


@pytest.mark.asyncio
async def test_sec_chat_tool_events_include_arguments_and_result():
    events = []
    model = ToolModel(responses=[call('search_sec_companies', ticker='AAPL'), AIMessage(content='done')])
    result = await search_companies('AAPL', model, client_with([]), events.append)
    assert result['items'][0]['ticker'] == 'AAPL'
    assert [item['status'] for item in events] == ['running', 'completed']
    assert all(item['kind'] == 'tool' and item['arguments']['ticker'] == 'AAPL' for item in events)
    assert events[1]['result']['items'][0]['ticker'] == 'AAPL'
