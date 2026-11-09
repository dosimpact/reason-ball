"""Fixed OpenUI programs for server-owned business actions."""
from __future__ import annotations

import json

from domains.generative_ui.actions import CABIN_FIELDS, MEALS, SEATS, allowed_actions


def literal(value) -> str:
    return json.dumps(value, ensure_ascii=False)


class Program:
    def __init__(self):
        self.statements = []
        self.nodes = []

    def add(self, expression):
        name = f'control{len(self.nodes)}'
        self.statements.append(f'{name} = {expression};')
        self.nodes.append(name)

    def text(self, text):
        self.add(f'Text({literal(text)})')

    def input(self, key, value, label):
        self.statements.append(f'${key} = {literal(value)};')
        self.add(f'Input(${key}, {literal(label)})')

    def select(self, key, value, options, label):
        self.statements.append(f'${key} = {literal(value)};')
        self.add(f'Select(${key}, {literal(options)}, {literal(label)})')

    def button(self, label, name, context):
        self.add(f'Button({literal(label)}, @BusinessAction({literal(name)}, {context}))')

    def render(self):
        return '\n'.join([f'root = Col([{", ".join(self.nodes)}]);', *self.statements])


def controls_program(mode: str, data: dict) -> str:
    ui = Program()
    actions = allowed_actions(mode, data)
    if mode == 'dynamic':
        ui.text('가상 매출 데이터 · USD · 2026-07~2026-09')
        ui.select('region', data.get('filters', {}).get('region', 'all'), [{'value': key, 'label': label} for key, label in [('all', '전체'), ('seoul', '서울'), ('busan', '부산')]], '지역')
        ui.button('매출 조회', 'search_sales', '{region: $region}')
        ui.text(f"조회 매출 {data.get('revenue', '')} · 거래처 {data.get('accounts', '')}개")
    elif mode == 'fixed':
        ui.text(data.get('notice', '가상 항공편 선택'))
        if data.get('flightId'):
            ui.text(f"{data['origin']} → {data['destination']} · {data['airline']} · {data['price']}")
            fields = CABIN_FIELDS.get(data.get('uiType'), set())
            for key in sorted(fields):
                choices = MEALS if key == 'meal' else SEATS
                if data.get('confirmed'):
                    ui.text(choices[data[key]])
                else:
                    ui.select(key, data[key], [{'value': k, 'label': v} for k, v in choices.items()], '기내식' if key == 'meal' else '좌석')
            context = '{flightId: ' + literal(data['flightId'])
            context += ''.join(f', {key}: ${key}' for key in sorted(fields)) + '}'
            if 'confirm_cabin' in actions:
                ui.button('선택 확정', 'confirm_cabin', context)
            if 'select_flight' in actions:
                ui.button('항공편 선택', 'select_flight', context)
    else:
        sec_controls(ui, data, actions)
    return ui.render()


def sec_controls(ui: Program, data: dict, actions: set[str]):
    ui.text(data.get('notice', '회사를 검색하고 공시를 선택해 주세요.'))
    ui.input('query', data.get('query', ''), '회사명 또는 티커')
    ui.button('회사 검색', 'sec_search', '{query: $query, page: 1}')
    company = data.get('company')
    if 'sec_company' in actions:
        rows = data['companies']['items']
        ui.select('cik', rows[0]['cik'], [{'value': row['cik'], 'label': f"{row['name']} ({row.get('ticker') or '-'})"} for row in rows], '조회할 회사')
        ui.button('공시 조회', 'sec_company', '{cik: $cik}')
        pagination(ui, data.get('companies', {}), 'sec_search', {'query': data.get('query', '')}, '회사')
    if not company:
        return
    ui.text(f"선택 회사: {company['name']} · CIK {company['cik']}")
    filing = data.get('filing')
    if filing:
        ui.text(f"선택: {filing['accessionNo']} · {filing['formType']} · 원본: {(filing.get('original') or {}).get('accessionNo', '없음')} · 수정본: {', '.join(row.get('accessionNo', '') for row in filing.get('amendments', [])) or '없음'} · 선택 문서 한 건만 분석합니다.")
        if 'sec_report' in actions:
            ui.input('request', data.get('report_request', ''), '어떤 내용을 분석할까요?')
            ui.button('분석·요약 보고서 생성', 'sec_report', '{request: $request}')
        ui.button('공시 다시 선택', 'sec_filings_page', '{page: 1}')
    else:
        filters = data.get('filters', {})
        for key, choices, label in [('status', ['', 'downloaded', 'pending', 'failed'], '원문 저장 상태'), ('form', ['', '10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A'], '공시 종류')]:
            ui.select(key, filters.get(key, ''), [{'value': item, 'label': item or '전체'} for item in choices], label)
        ui.input('since', filters.get('since', ''), '제출 시작일 (YYYY-MM-DD)')
        ui.button('공시 필터 적용', 'sec_filings_filter', '{status: $status, form: $form, since: $since}')
        rows = data.get('filings', {}).get('items', [])
        if not rows:
            ui.text('조건에 맞는 공시가 없습니다. 필터를 변경해 주세요.')
        if rows:
            ui.add(f'Table({literal(["종류", "제출일", "보고기간", "접수번호", "원문 상태"])}, {literal([[row.get(key) or "" for key in ("formType", "filingDate", "reportDate", "accessionNo", "status")] for row in rows])})')
            ui.select('accession', rows[0]['accessionNo'], [{'value': row['accessionNo'], 'label': f"{row['formType']} · {row.get('filingDate', '')} · {row['accessionNo']}"} for row in rows], '분석할 공시')
            ui.button('공시 선택', 'sec_filing', '{accession: $accession}')
        pagination(ui, data.get('filings', {}), 'sec_filings_page', {}, '공시')
    if data.get('report_source_label'):
        ui.text(data['report_source_label'])
    # Verified quotations are rendered from the business result, independently
    # of the presentation model, so it cannot rewrite or omit source evidence.
    for section, claims in data.get('report', {}).items():
        if not isinstance(claims, list):
            continue
        for claim in claims:
            if not isinstance(claim, dict):
                continue
            for citation in claim.get('citations', []):
                ui.text(f"{section} · [{citation['evidence_id']}] {citation['quote']}")


def pagination(ui, result, action, extra, label):
    page = result.get('pagination', {})
    current = page.get('page', 1)
    ui.text(f"{page.get('totalItems', 0)}개 {label} · {current}페이지")
    if current > 1:
        ui.button(f'{label} 이전 페이지', action, literal({**extra, 'page': current - 1}))
    if page.get('hasNextPage'):
        ui.button(f'{label} 다음 페이지', action, literal({**extra, 'page': current + 1}))
