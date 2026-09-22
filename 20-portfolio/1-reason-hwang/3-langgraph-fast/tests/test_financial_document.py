from decimal import Decimal
from pathlib import Path

import pytest

from domains.tenk.financial_document import FinancialError, parse_document, parse_number
from domains.tenk.financial_extraction import verify_observation
from domains.tenk.financial_models import CellObservation

RAW = (Path(__file__).parent / "fixtures/financial/statements.html").read_text()


def test_table_spans_and_toc_preserve_original_coordinates():
    document = parse_document(RAW)
    table = document.tables['table-0']
    assert document.index_method == 'toc'
    assert table['grid'][0] == ['r0c0', 'r0c1', 'r0c1']
    assert table['grid'][1] == ['r0c0', 'r1c1', 'r1c2']
    assert table['cells']['r2c1']['text'] == '1,250'
    assert 'USD in millions' in table['context']
    assert document.read(['table-0'], 5) == ([], ['table-0'])


@pytest.mark.parametrize('text,expected', [('( 20 )', Decimal(-20)), ('1,250', Decimal(1250)), ('—', None), ('0', Decimal(0))])
def test_numeric_source_values(text, expected):
    assert parse_number(text) == expected


def test_unexplained_footnote_is_not_silently_removed():
    with pytest.raises(FinancialError):
        parse_number('125(1)')


def mapping(**overrides):
    return CellObservation.model_validate(dict(metric_id='revenue', label='매출', statement='income', scope='consolidated',
        period={"id": 'fy2025', "label": '2025', "kind": 'duration', "start": '2025-01-01', "end": '2025-12-31', "duration_class": 'annual'},
        table_id='table-0', value_cell='r2c1', label_cells=['r2c0'], period_cells=['r0c1', 'r1c1'],
        unit_text='USD in millions', dimension='money', currency='USD', scale='1000000', **overrides))


def test_verified_value_is_read_from_source_cell_and_scaled():
    metric, observation, source = verify_observation(parse_document(RAW), mapping(), {'table-0'})
    assert observation['exactValue'] == '1250000000'
    assert source['valueText'] == '1,250'
    assert metric['originalLabel'] == 'Revenue'


def test_unread_table_cannot_supply_evidence():
    with pytest.raises(FinancialError, match='읽지 않은'):
        verify_observation(parse_document(RAW), mapping(), set())


def test_plain_text_does_not_invent_a_table():
    with pytest.raises(FinancialError, match='재무 표'):
        parse_document('Revenue 2025 1250')


def test_period_header_must_cover_the_value_column():
    wrong = mapping().model_copy(update={'period_cells': ['r1c2']})
    with pytest.raises(FinancialError, match='기간 헤더'):
        verify_observation(parse_document(RAW), wrong, {'table-0'})


def test_row_chunks_repeat_headers_and_expose_continuation():
    raw = '<table><tr><th>Metric</th><th>2025</th></tr>' + ''.join(f'<tr><td>Metric {i}</td><td>{i}</td></tr>' for i in range(50)) + '</table>'
    document = parse_document(raw)
    first, omitted = document.read(['table-0'], 1500)
    assert omitted == ['table-0']
    assert first[0]['nextRow'] is not None
    second, _ = document.read(['table-0'], 1500, {'table-0': first[0]['nextRow']})
    assert 'r0c0' in second[0]['cells']
    assert any(key not in first[0]['cells'] for key in second[0]['cells'])
