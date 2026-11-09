import pytest
from graph.primary_graphs.generative_ui.workflow import FlightIntent, build_ui_graph
from graph.subgraphs.openui_output.workflow import GeneratedUI


class Model:
    def with_structured_output(self, schema):
        self.schema = schema
        return self

    async def ainvoke(self, messages):
        if self.schema is FlightIntent:
            return FlightIntent(flight_id='demo-icn-nrt', ui_type='both', notice='가상 항공편입니다.')
        return GeneratedUI(program='root = Col([Text("매출 분석")]);')


async def valid(program):
    return []


@pytest.mark.asyncio
async def test_fixed_graph_final_output_and_action_roundtrip():
    graph = build_ui_graph('fixed', Model(), validator=valid)
    initial = await graph.ainvoke({'question': '기내식과 좌석', 'revision': 0})
    assert initial['revision'] == 1 and '@BusinessAction(' in initial['controls']
    assert initial['program'] == ''
    result = await graph.ainvoke({**initial, 'action': {'name': 'confirm_cabin', 'revision': 1, 'context': {'flightId': 'demo-icn-nrt', 'meal': 'kids', 'seat': '14C'}}})
    assert result['revision'] == 2 and result['data']['confirmed']
    assert '@BusinessAction(' not in result['controls']
    assert initial['data']['confirmed'] is False


@pytest.mark.asyncio
async def test_failed_presentation_does_not_mutate_business_snapshot():
    state = {'question': '매출', 'data': {}, 'revision': 0}
    async def invalid(program):
        return ['invalid']
    with pytest.raises(ValueError):
        await build_ui_graph('dynamic', Model(), validator=invalid).ainvoke(state)
    assert state['data'] == {} and state['revision'] == 0


@pytest.mark.asyncio
async def test_dynamic_graph_uses_filtered_server_data():
    graph = build_ui_graph('dynamic', Model(), validator=valid)
    initial = await graph.ainvoke({'question': '매출 요약', 'revision': 0})
    assert initial['data']['revenue'] == '$680,000'
    result = await graph.ainvoke({**initial, 'action': {'name': 'search_sales', 'revision': 1, 'context': {'region': 'busan'}}})
    assert result['data']['revenue'] == '$320,000' and result['program']
