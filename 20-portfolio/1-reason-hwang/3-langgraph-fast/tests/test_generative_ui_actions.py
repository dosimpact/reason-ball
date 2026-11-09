import pytest

from domains.generative_ui.actions import apply_demo_action, apply_sec_action, fixed_data
from domains.generative_ui.contracts import ActionError, UIAction
from domains.generative_ui.data import sales_summary


def action(name, context, revision=1):
    return UIAction(name=name, revision=revision, context=context)


def test_sales_recomputed_from_server_snapshot():
    result = apply_demo_action('dynamic', sales_summary(), action('search_sales', {'region': 'seoul'}), 1)
    assert result['revenue'] == '$360,000' and result['accounts'] == '3'
    with pytest.raises(ActionError):
        apply_demo_action('dynamic', result, action('search_sales', {'region': 'seoul', 'revenue': 1}), 1)


@pytest.mark.parametrize('ui_type,selection', [('meal', {'meal': 'vegetarian'}), ('seat', {'seat': '14C'}), ('both', {'meal': 'kids', 'seat': '12A'})])
def test_cabin_confirm_once(ui_type, selection):
    data = fixed_data('demo-icn-nrt', ui_type)
    request = action('confirm_cabin', {'flightId': data['flightId'], **selection})
    result = apply_demo_action('fixed', data, request, 1)
    assert result['confirmed'] and not data['confirmed']
    assert all(result[key] == value for key, value in selection.items())
    with pytest.raises(ActionError):
        apply_demo_action('fixed', result, request, 1)


def test_stale_and_foreign_flight_actions_rejected():
    data = fixed_data('demo-icn-nrt')
    with pytest.raises(ActionError):
        apply_demo_action('fixed', data, action('select_flight', {'flightId': 'demo-nrt-icn'}), 1)
    with pytest.raises(ActionError):
        apply_demo_action('fixed', data, action('select_flight', {'flightId': 'demo-icn-nrt'}), 2)
    assert apply_demo_action('fixed', data, action('select_flight', {'flightId': 'demo-icn-nrt'}), 1)['selected']


@pytest.mark.asyncio
async def test_sec_selection_uses_server_results():
    class Client:
        async def companies(self, query, page):
            return {'items': [{'cik': '123', 'name': 'Demo'}]}
        async def filings(self, cik):
            return {'items': []}
    client = Client()
    state = await apply_sec_action({}, action('sec_search', {'query': 'Demo', 'page': 1}), 1, client)
    with pytest.raises(ActionError):
        await apply_sec_action(state, action('sec_company', {'cik': 'foreign'}), 1, client)
    selected = await apply_sec_action(state, action('sec_company', {'cik': '123'}), 1, client)
    assert selected['company']['cik'] == '123'
    with pytest.raises(ActionError):
        await apply_sec_action(selected, action('sec_report', {'request': ''}), 1, client)
