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
    return ui.render()
