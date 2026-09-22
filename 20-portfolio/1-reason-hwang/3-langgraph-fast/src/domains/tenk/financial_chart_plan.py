"""Resolve presentation references to immutable, source-backed chart properties."""
import math
from decimal import Decimal
from typing import NoReturn

from .financial_document import FinancialError
from .financial_models import FinancialChartPlan


def fail(message) -> NoReturn:
    raise FinancialError("INVALID_CHART_PLAN", message)


def resolve_plan(dataset: dict, plan: FinancialChartPlan) -> list[dict]:
    metrics = {m['id']: m for m in dataset['metrics']}
    periods = {p['id']: p for p in dataset['periods']}
    values = {(o['metricId'], o['periodId']): o for o in dataset['observations']}
    sources = {s['id']: s for s in dataset['sources']}
    if sum(b.type == 'chart' for b in plan.blocks) > 4:
        fail('차트는 최대 4개까지 표시할 수 있습니다.')
    resolved = []
    for block in plan.blocks:
        if len(set(block.metric_ids)) != len(block.metric_ids) or len(set(block.period_ids)) != len(block.period_ids):
            fail('지표와 기간 ID는 중복될 수 없습니다.')
        if any(i not in metrics for i in block.metric_ids) or any(i not in periods for i in block.period_ids):
            fail('추출 결과에 없는 지표 또는 기간입니다.')
        ms = [metrics[i] for i in block.metric_ids]
        ps = sorted([periods[i] for i in block.period_ids], key=lambda p: p['end'])
        selected = [values.get((m['id'], p['id'])) for m in ms for p in ps]
        if not any(o and o['exactValue'] is not None for o in selected):
            fail('표시할 검증된 값이 없습니다.')
        source_ids = list(dict.fromkeys(s for o in selected if o for s in o['sourceIds']))
        source_text = '\n'.join(f"{sources[s]['sectionTitle']} · {sources[s]['tableId']} · 행 {sources[s]['row'] + 1}/열 {sources[s]['column'] + 1}: {sources[s]['labelText']} | {sources[s]['periodText']} | {sources[s]['valueText']} | {sources[s]['unitText']}" for s in source_ids)
        unit = lambda m: ' '.join(filter(None, [m.get('currency'), {'money': '', 'shares': '주', 'money_per_share': '/주', 'percent': '%', 'count': '개'}[m['dimension']]]))
        def exact(m, p, unit=unit):
            o = values.get((m['id'], p['id']))
            return '자료 없음' if not o or o['exactValue'] is None else f"{Decimal(o['exactValue']):,} {unit(m)}"
        table_rows = [{'metric': m['label'], **{p['id']: exact(m, p) for p in ps}} for m in ms]
        item = {'type': block.type, 'title': block.title or plan.title, 'sources': source_text,
                'columns': [{'key': 'metric', 'label': '지표'}, *[{'key': p['id'], 'label': p['label']} for p in ps]], 'rows': table_rows}
        if block.type == 'metric':
            if len(ms) != 1 or len(ps) != 1:
                fail('지표 카드에는 지표 하나와 기간 하나가 필요합니다.')
            item.update(label=f"{ms[0]['label']} · {ps[0]['label']}", value=exact(ms[0], ps[0]))
        if block.type == 'chart':
            if block.kind is None:
                fail('차트 종류를 지정해 주세요.')
            if len({(m['dimension'], m['currency'], m['scope']) for m in ms}) != 1:
                fail('같은 단위·통화·회계 범위만 한 차트로 비교할 수 있습니다.')
            if len({(p['kind'], p['duration_class']) for p in ps}) != 1:
                fail('시점·기간 또는 연간·분기·누적 기간을 혼합할 수 없습니다.')
            if block.kind in {'line', 'area'} and (len(ps) < 2 or block.category != 'period'):
                fail('추이 차트에는 같은 종류의 기간이 최소 2개 필요합니다.')
            if block.kind in {'bar', 'area'} and block.category == 'period' and len(ms) != 1:
                fail('단일 막대/영역은 지표 하나를 사용하세요. 복수 지표는 그룹 막대를 사용하세요.')
            if block.category == 'metric' and len(ps) != 1:
                fail('지표별 비교에는 기간 하나를 선택해 주세요.')
            if block.kind in {'stacked_bar', 'donut'}:
                groups = {m.get('composition') for m in ms}
                if len(ms) < 2 or len(groups) != 1 or None in groups or any(m['isTotal'] for m in ms):
                    fail('겹치지 않는 구성 항목만 누적/도넛으로 표현할 수 있습니다.')
                group = next(iter(groups))
                totals = [m for m in metrics.values() if m.get('composition') == group and m['isTotal']]
                for p in ps:
                    parts = [values.get((m['id'], p['id'])) for m in ms]
                    total = next((values.get((m['id'], p['id'])) for m in totals if values.get((m['id'], p['id']))), None)
                    if not total or total['exactValue'] is None or any(not o or o['exactValue'] is None for o in parts):
                        fail('구성 항목과 총계의 원문 근거가 필요합니다.')
                    parts = [o for o in parts if o is not None]
                    if sum(Decimal(o['exactValue']) for o in parts) != Decimal(total['exactValue']):
                        fail('선택한 구성 항목의 합이 원문 총계와 다릅니다.')
                    # Composition must refer to the same source table as its total.
                    if len({sources[s]['tableId'] for o in [*parts, total] for s in o['sourceIds']}) != 1:
                        fail('구성 항목과 총계가 같은 원문 표에 있어야 합니다.')
            if block.kind == 'donut' and (block.category != 'metric' or len(ps) != 1):
                fail('도넛은 한 기간의 지표별 구성에만 사용할 수 있습니다.')
            numbers = [Decimal(o['exactValue']) for o in selected if o and o['exactValue'] is not None]
            if block.kind in {'area', 'stacked_bar', 'donut'} and any(v < 0 for v in numbers):
                fail('음수는 영역·누적·도넛 차트로 표현하지 않습니다.')
            if block.kind == 'donut' and sum(numbers) <= 0:
                fail('도넛의 합계는 0보다 커야 합니다.')
            scale = Decimal(ms[0]['scale'])
            scale_name = {'1': '', '1000': '천', '1000000': '백만', '1000000000': '십억'}[str(scale)]
            def number(m, p, scale=scale):
                o = values.get((m['id'], p['id']))
                if not o or o['exactValue'] is None:
                    return None
                decimal = Decimal(o['exactValue']) / scale
                result = float(decimal)
                if not math.isfinite(result) or Decimal(str(result)) != decimal:
                    fail('차트 숫자의 정밀도 범위를 초과했습니다. 표로 요청해 주세요.')
                return result
            if block.category == 'period':
                series = [{'key': f's{i}', 'label': m['label']} for i, m in enumerate(ms)]
                rows = [{'label': p['label'], **{f's{i}': number(m, p) for i, m in enumerate(ms)}} for p in ps]
            else:
                series = [{'key': 's0', 'label': ps[0]['label']}]
                rows = [{'label': m['label'], 's0': number(m, ps[0])} for m in ms]
            if len(series) > 6 or len(rows) > 24:
                fail('차트는 최대 6개 시리즈와 24개 포인트를 지원합니다.')
            item.update(kind=block.kind, series=series, data=rows, unitLabel=f'{unit(ms[0])} {scale_name}'.strip())
        resolved.append(item)
    return resolved
