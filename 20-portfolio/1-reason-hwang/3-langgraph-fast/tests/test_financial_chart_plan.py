import pytest

from domains.tenk.financial_chart_plan import resolve_plan
from domains.tenk.financial_document import FinancialError, parse_document
from domains.tenk.financial_extraction import verify_observation
from domains.tenk.financial_models import FinancialChartPlan
from tests.test_financial_document import RAW, mapping


def dataset():
    m, o, s = verify_observation(parse_document(RAW), mapping(), {'table-0'})
    return {'metrics': [m], 'periods': [mapping().period.model_dump()], 'observations': [o], 'sources': [s]}


def plan(**kwargs):
    return FinancialChartPlan.model_validate({'title':'매출', 'blocks':[{'type': 'chart', 'kind': 'bar', 'metric_ids': ['revenue'], 'period_ids': ['fy2025']} | kwargs]})


def test_chart_uses_server_value_and_source_units():
    block = resolve_plan(dataset(), plan())[0]
    assert block['data'] == [{'label': '2025', 's0': 1250.0}]
    assert block['unitLabel'] == 'USD 백만'
    assert '1,250' in block['sources']


@pytest.mark.parametrize('changes', [{'metric_ids': ['unknown']}, {'kind': 'donut', 'category': 'metric'}, {'kind': 'line'}, {'metric_ids': ['revenue','revenue']}])
def test_invalid_charts_are_rejected(changes):
    with pytest.raises(FinancialError):
        resolve_plan(dataset(), plan(**changes))


def test_missing_value_not_zero_filled():
    d = dataset()
    d['periods'].append(dict(d['periods'][0], id='fy2024', label='2024', start='2024-01-01', end='2024-12-31'))
    result = resolve_plan(d, plan(kind='line', period_ids=['fy2025','fy2024']))[0]
    assert result['data'][0] == {'label':'2024','s0':None}


def test_negative_area_rejected():
    d = dataset()
    d['observations'][0]['exactValue'] = '-100'
    d['periods'].append(dict(d['periods'][0], id='fy2024', label='2024', start='2024-01-01', end='2024-12-31'))
    with pytest.raises(FinancialError, match='음수'):
        resolve_plan(d, plan(kind='area', period_ids=['fy2025','fy2024']))


def composition_dataset():
    from copy import deepcopy
    d = dataset()
    base_metric, base_value, base_source = d['metrics'][0], d['observations'][0], d['sources'][0]
    d['metrics'], d['observations'], d['sources'] = [], [], []
    for key, amount, total in [('a', '20', False), ('b', '30', False), ('total', '50', True)]:
        d['metrics'].append(deepcopy(base_metric) | {'id': key, 'composition': 'products', 'isTotal': total})
        d['observations'].append(base_value | {'metricId': key, 'exactValue': amount, 'sourceIds': [key]})
        d['sources'].append(base_source | {'id': key})
    return d


@pytest.mark.parametrize('kind,category', [('donut', 'metric'), ('stacked_bar', 'period'), ('grouped_bar', 'period')])
def test_composition_chart_uses_complete_positive_source_parts(kind, category):
    result = resolve_plan(composition_dataset(), plan(kind=kind, category=category, metric_ids=['a', 'b']))
    assert result[0]['kind'] == kind


def test_incomplete_composition_is_not_a_whole():
    d = composition_dataset()
    d['observations'][1]['exactValue'] = '29'
    with pytest.raises(FinancialError, match='합'):
        resolve_plan(d, plan(kind='donut', category='metric', metric_ids=['a', 'b']))


def test_quarter_and_ytd_are_not_silently_mixed():
    d = dataset()
    d['periods'].append(d['periods'][0] | {'id': 'ytd', 'duration_class': 'ytd'})
    with pytest.raises(FinancialError, match='혼합'):
        resolve_plan(d, plan(period_ids=['fy2025', 'ytd']))
