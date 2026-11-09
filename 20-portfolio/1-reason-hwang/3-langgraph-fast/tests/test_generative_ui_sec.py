import httpx
import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda

from domains.generative_ui.contracts import ActionError
from domains.tenk.sec_client import SecClient
from graph.primary_graphs.generative_ui.workflow import build_ui_graph
from graph.subgraphs.openui_output.workflow import GeneratedUI

CIK = '0000320193'
ACCESSION = '0000320193-25-000079'
QUOTE = 'The company provides cloud services to enterprise customers.'


class Model(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self
    def with_structured_output(self, schema, **kwargs):
        if schema is GeneratedUI:
            return RunnableLambda(lambda _: GeneratedUI(program='root = Col([Text("클라우드 사업 분석")]);'))
        return super().with_structured_output(schema, **kwargs)


def graph(failures):
    def handler(request):
        assert request.method == 'GET'
        if failures.get('path') == request.url.path:
            return httpx.Response(503, text='private diagnostics')
        if request.url.path.endswith('/content'):
            return httpx.Response(200, text=f'<h1>ITEM 1. BUSINESS</h1><p>{QUOTE}</p>')
        if request.url.path.endswith('/companies'):
            items = [{'cik': CIK, 'name': 'Fixture Company', 'ticker': 'DEMO'}]
        else:
            assert request.url.params['cik'] == CIK
            items = [{'cik': CIK, 'accessionNo': ACCESSION, 'formType': '10-K', 'filingDate': '2025-10-31', 'status': 'downloaded'}]
        return httpx.Response(200, json={'items': items, 'pagination': {'page': 1, 'totalItems': 1, 'hasNextPage': False}})
    claim = {'analysis': '클라우드 서비스를 제공합니다.', 'citations': [{'evidence_id': 'E1', 'quote': QUOTE}]}
    model = Model(responses=[AIMessage(content='', tool_calls=[{'name': 'FilingReport', 'id': 'report', 'args': {'summary': [claim], 'business': [], 'financials': [], 'risks': []}}])])
    async def validate(program):
        return []
    return build_ui_graph('sec', model, client=SecClient(transport=httpx.MockTransport(handler)), validator=validate)


async def act(workflow, state, name, **context):
    return await workflow.ainvoke({**state, 'question': '', 'action': {'name': name, 'revision': state['revision'], 'context': context}})


@pytest.mark.asyncio
async def test_search_select_report_change_and_stale_actions():
    workflow = graph({})
    search = await workflow.ainvoke({'question': 'DEMO', 'revision': 0})
    assert '공시 조회' in search['controls'] and not search['program']
    company = await act(workflow, search, 'sec_company', cik=CIK)
    assert '공시 필터 적용' in company['controls'] and '분석·요약 보고서 생성' not in company['controls']
    with pytest.raises(ActionError):
        await act(workflow, company, 'sec_company', cik=CIK)
    filing = await act(workflow, company, 'sec_filing', accession=ACCESSION)
    report = await act(workflow, filing, 'sec_report', request='')
    assert report['data']['report']['summary'][0]['citations'][0]['quote'] == QUOTE
    assert 'SHA-256' in report['controls'] and report['program']
    changed = await act(workflow, report, 'sec_filings_page', page=1)
    assert 'report' not in changed['data'] and 'filing' not in changed['data']
    with pytest.raises(ActionError):
        await act(workflow, changed, 'sec_report', request='')
    reset = await act(workflow, report, 'sec_search', query='DEMO', page=1)
    assert 'company' not in reset['data'] and 'report' not in reset['data']


@pytest.mark.asyncio
async def test_foreign_filing_and_bad_filter_rejected():
    workflow = graph({})
    state = await workflow.ainvoke({'question': 'DEMO', 'revision': 0})
    state = await act(workflow, state, 'sec_company', cik=CIK)
    with pytest.raises(ActionError):
        await act(workflow, state, 'sec_filing', accession='foreign')
    with pytest.raises(ActionError):
        await act(workflow, state, 'sec_filings_filter', status='', form='', since='not-a-date')
