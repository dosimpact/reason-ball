from copy import deepcopy

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

from graph.primary_graphs.sec_a2ui import agent_tools
from tests.test_financial_chart_plan import dataset, plan
from tests.test_sec_a2ui_workflow import ACCESSION, CIK, graph
from tests.test_sec_agent import call


def selected():
    return {'company': {'cik': CIK, 'name': 'Fixture', 'ticker': 'DEMO'},
            'filing': {'cik': CIK, 'accessionNo': ACCESSION, 'formType': '10-K', 'status': 'downloaded'}}


def verified():
    return dataset() | {'datasetId': 'verified-fixture', 'schemaVersion': 1, 'filing': selected()['filing'], 'status': 'complete',
                        'source': {'sourceHash': 'fixture-hash', 'retrievedAt': '2026-09-23T00:00:00Z'},
                        'coverage': {'request': '매출', 'missing': [], 'warnings': [], 'tableIds': ['table-0'], 'unreadTableCount': 0, 'includedCharacters': 500, 'indexMethod': 'toc'}}


@pytest.mark.asyncio
@pytest.mark.parametrize('target', ['inline', 'canvas'])
async def test_extract_then_render_and_presentation_reuses_dataset(monkeypatch, target):
    extractions = []
    async def extract(*args):
        extractions.append(True)
        return verified()
    monkeypatch.setattr(agent_tools, 'extract_dataset', extract)
    workflow = graph(agent_responses=[call('extract_financial_data', request='매출'),
        call('render_financial_charts', dataset_id='verified-fixture', plan=plan().model_dump()), AIMessage(content='표시했습니다.'),
        call('render_financial_charts', dataset_id='verified-fixture', plan=plan(type='table').model_dump()), AIMessage(content='변경했습니다.')])
    config: RunnableConfig = {'configurable': {'thread_id': f'financial-{target}'}}
    first = await workflow.ainvoke({'sec': selected(), 'messages': [HumanMessage(content='매출 차트')], 'output_target': target}, config)
    old = deepcopy(first['sec'])
    surface_id = next(iter(first['surfaces']))
    assert any(c['component'] == 'FinancialChart' for c in first['surfaces'][surface_id]['components'].values())
    second = await workflow.ainvoke({'messages': [HumanMessage(content='표로 바꿔줘')]}, config)
    assert len(extractions) == 1
    assert second['sec']['financial_dataset'] == old['financial_dataset']
    assert (surface_id in second['surfaces']) == (target == 'canvas')


@pytest.mark.asyncio
async def test_invalid_dataset_id_cannot_render_another_threads_data():
    workflow = graph(agent_responses=[call('render_financial_charts', dataset_id='another-thread', plan=plan().model_dump()), AIMessage(content='데이터가 없습니다.')])
    result = await workflow.ainvoke({'sec': selected(), 'messages': [HumanMessage(content='차트')]}, {'configurable': {'thread_id': 'isolated'}})
    assert not result.get('surfaces')
    assert any('DATASET_SCOPE_MISMATCH' in str(m.content) for m in result['messages'])


@pytest.mark.asyncio
async def test_failed_chart_does_not_commit_extracted_working_state(monkeypatch):
    async def extract(*args):
        return verified()
    monkeypatch.setattr(agent_tools, 'extract_dataset', extract)
    workflow = graph(agent_responses=[call('extract_financial_data', request='매출'),
        call('render_financial_charts', dataset_id='verified-fixture', plan=plan(kind='donut', category='metric').model_dump()), AIMessage(content='구성 근거가 없습니다.')])
    before = selected()
    result = await workflow.ainvoke({'sec': before, 'messages': [HumanMessage(content='도넛')]}, {'configurable': {'thread_id': 'invalid-plan'}})
    assert result['sec'] == before
    assert not result.get('surfaces')
    assert any('INVALID_CHART_PLAN' in str(m.content) for m in result['messages'])


@pytest.mark.asyncio
async def test_same_actual_period_is_canonicalized_across_model_aliases():
    from domains.tenk.financial_document import parse_document
    from domains.tenk.financial_extraction import extract_dataset
    from tests.test_financial_document import RAW, mapping
    from tests.test_sec_a2ui_workflow import ReportModel
    section_id = parse_document(RAW).sections[0]['id']
    first = mapping().model_dump()
    second = deepcopy(first)
    second.update(metric_id='income', label='이익', value_cell='r3c1', label_cells=['r3c0'])
    second['period']['id'] = 'a-different-spelling-of-2025'
    model = ReportModel(responses=[call('SectionSelection', section_ids=[section_id]), call('TableSelection', table_ids=['table-0']),
                                  call('ExtractionProposal', observations=[first, second], missing=[], additional_table_ids=[])])
    result = await extract_dataset(model, RAW, selected()['filing'], '매출과 이익')
    assert len(result['periods']) == 1
    assert len(result['metrics']) == 2
    assert {o['exactValue'] for o in result['observations']} == {'1250000000', '-20000000'}


class RecordingExtractionModel:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def bind_tools(self, *args, **kwargs):
        return self

    async def ainvoke(self, messages, **kwargs):
        self.calls.append(messages)
        return next(self.responses)


@pytest.mark.asyncio
@pytest.mark.parametrize('empty', [False, True])
async def test_unverified_mapping_is_repaired_once_using_read_sources(empty):
    from domains.tenk.financial_document import parse_document
    from domains.tenk.financial_extraction import extract_dataset
    from tests.test_financial_document import RAW, mapping
    valid = mapping().model_dump()
    wrong = deepcopy(valid)
    wrong['period_cells'] = ['r1c2']  # 2024 header above the 2025 value.
    model = RecordingExtractionModel(responses=[
        call('SectionSelection', section_ids=[parse_document(RAW).sections[0]['id']]),
        call('TableSelection', table_ids=['table-0']),
        call('ExtractionProposal', observations=[] if empty else [wrong], missing=['매출'], additional_table_ids=[]),
        call('ExtractionProposal', observations=[valid], missing=[], additional_table_ids=[]),
    ])
    result = await extract_dataset(model, RAW, selected()['filing'], '매출')
    assert result['observations'][0]['exactValue'] == '1250000000'
    assert result['status'] == 'complete'
    assert result['coverage']['tableIds'] == ['table-0']
    assert len(model.calls) == 4
    repair = str(model.calls[-1])
    assert 'rejections' in repair
    assert ('기간 헤더' in repair) if not empty else ('매출' in repair)


@pytest.mark.asyncio
async def test_failed_repair_reports_reason_without_weakening_source_checks():
    from domains.tenk.financial_document import FinancialError, parse_document
    from domains.tenk.financial_extraction import extract_dataset
    from tests.test_financial_document import RAW, mapping
    wrong = mapping().model_dump()
    wrong['value_cell'] = 'r999c1'
    proposal = {'observations': [wrong], 'missing': [], 'additional_table_ids': []}
    model = RecordingExtractionModel(responses=[
        call('SectionSelection', section_ids=[parse_document(RAW).sections[0]['id']]),
        call('TableSelection', table_ids=['table-0']),
        call('ExtractionProposal', **proposal), call('ExtractionProposal', **proposal),
    ])
    with pytest.raises(FinancialError, match='읽지 않은 셀') as error:
        await extract_dataset(model, RAW, selected()['filing'], '매출')
    assert error.value.code == 'NO_VERIFIED_DATA'
    assert len(model.calls) == 4
