"""Publish resolved financial views through the existing SEC surface lifecycle."""
from domains.tenk.financial_chart_plan import resolve_plan
from domains.tenk.financial_models import FinancialChartPlan


def add_financial_surface(ui, state: dict, visible: list, data: dict):
    dataset = state['financial_dataset']
    plan = FinancialChartPlan.model_validate(state['financial_plan'])
    blocks = resolve_plan(dataset, plan)
    visible.append('financial-result')
    children = ['financial-title', 'financial-document', 'financial-coverage']
    ui.add('financial-result', 'Column', children=children)
    ui.add('financial-title', 'Text', text=plan.title, variant='heading')
    filing = dataset['filing']
    ui.add('financial-document', 'Text', text=f"{filing['formType']} · {filing['accessionNo']} · 보고기간 {filing.get('reportDate') or '-'}", variant='caption')
    coverage = dataset['coverage']
    summary = f"{'일부 추출' if dataset['status'] == 'partial' else '요청 지표 추출'} · 표 {len(coverage['tableIds'])}개 확인 · {coverage['unreadTableCount']}개 표 미열람"
    if coverage['missing']:
        summary += ' · 확인하지 못한 지표: ' + ', '.join(coverage['missing'])
    ui.add('financial-coverage', 'Text', text=summary, variant='caption')
    data['financial'] = {'charts': {}}
    layout_children = []
    children.append('financial-layout')
    ui.add('financial-layout', 'Column', children=layout_children)
    for index, block in enumerate(blocks):
        block_id = f'financial-block-{index}'
        if plan.columns == 2:
            row_id = f'financial-row-{index // 2}'
            if index % 2 == 0:
                layout_children.append(row_id)
                ui.add(row_id, 'Row', children=[block_id])
            else:
                next(c for c in ui.components if c['id'] == row_id)['children'].append(block_id)
        else:
            layout_children.append(block_id)
        if block['type'] == 'chart':
            data['financial']['charts'][str(index)] = {'rows': block['data'], 'sources': block['sources']}
            ui.add(block_id, 'FinancialChart', title=block['title'], kind=block['kind'], unitLabel=block['unitLabel'], series=block['series'],
                   data={'path': f'/financial/charts/{index}/rows'}, sources={'path': f'/financial/charts/{index}/sources'})
        else:
            inner_id = block_id + '-content'
            source_id = block_id + '-source'
            ui.add(block_id, 'Column', children=[inner_id, source_id])
            if block['type'] == 'metric':
                ui.add(inner_id, 'Metric', label=block['label'], value=block['value'])
            else:
                ui.add(inner_id, 'Table', title=block['title'], columns=block['columns'], rows=block['rows'])
            ui.add(source_id, 'Accordion', items=[{'title': '출처 보기', 'text': block['sources']}])
    children.append('financial-provenance')
    ui.add('financial-provenance', 'Accordion', items=[{'title': '추출 범위와 원문 정보', 'text':
        f"원문 조회 {dataset['source']['retrievedAt']}\nSHA-256 {dataset['source']['sourceHash']}\n"
        f"선택 읽기 {coverage['includedCharacters']}자 · 색인 {coverage['indexMethod']}\n" + '\n'.join(coverage['warnings'])}])
