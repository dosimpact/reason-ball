"""Business first, OpenUI last. State is committed only after presentation succeeds."""
from __future__ import annotations

import json
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from domains.generative_ui.actions import apply_demo_action, apply_sec_action, fixed_data
from domains.generative_ui.contracts import Mode, UIAction
from domains.generative_ui.data import FLIGHTS, sales_summary
from domains.generative_ui.sec import execute_action
from domains.tenk.sec_client import SecClient
from graph.subgraphs.openui_output.workflow import build_output_graph


class FlightIntent(BaseModel):
    flight_id: str | None = Field(description='Exact available flight ID; null for unsupported routes or clarification.')
    ui_type: Literal['flight', 'meal', 'seat', 'both']
    notice: str = Field(max_length=1000, description='Short Korean reply; explicitly distinguish fictional examples from real flights.')


class UIState(TypedDict, total=False):
    question: str
    action: dict | None
    data: dict
    revision: int
    answer: dict
    mode: str
    host_evidence: bool
    program: str
    controls: str


def build_ui_graph(mode: Mode, model, *, client=None, validator=None):
    client = client or SecClient()
    output = build_output_graph(model, validator=validator)

    async def business(state: UIState):
        previous = state.get('data', {})
        request = state.get('action')
        question = state.get('question', '')
        if request:
            action = UIAction.model_validate(request)
            if mode == 'sec':
                data = await apply_sec_action(previous, action, state.get('revision', 0), client, model)
            else:
                data = apply_demo_action(mode, previous, action, state.get('revision', 0))
        elif mode == 'dynamic':
            data = sales_summary(previous.get('filters', {}).get('region', 'all'))
        elif mode == 'fixed':
            intent = await model.with_structured_output(FlightIntent).ainvoke([
                SystemMessage(content='Select a fictional flight and fixed UI. Never book or claim real availability. Preserve requested direction. For unsupported routes return flight_id=null. Meal only -> meal, seat only -> seat, both -> both. If unspecified use the previous flight, otherwise explicitly label the ICN-NRT demo. Available flights: ' + json.dumps(FLIGHTS)),
                HumanMessage(content=json.dumps({'question': question, 'previous': previous}, ensure_ascii=False)),
            ])
            data = fixed_data(intent.flight_id, intent.ui_type) if intent.flight_id else {}
            data['notice'] = intent.notice
        elif question.strip():
            name = 'sec_report' if previous.get('filing') else 'sec_search'
            context = {'request': question.strip()} if name == 'sec_report' else {'query': question.strip(), 'page': 1}
            data = await execute_action(previous, name, context, client, model)
        else:
            data = previous
        return {'answer': data, 'mode': mode, 'host_evidence': False}

    def commit(state: UIState):
        return {'data': state['answer'], 'revision': state.get('revision', 0) + 1, 'action': None}

    graph = StateGraph(UIState)
    graph.add_node('business', business)
    graph.add_node('openui_output', output)
    graph.add_node('commit', commit)
    graph.add_edge(START, 'business')
    graph.add_edge('business', 'openui_output')
    graph.add_edge('openui_output', 'commit')
    graph.add_edge('commit', END)
    return graph.compile()
