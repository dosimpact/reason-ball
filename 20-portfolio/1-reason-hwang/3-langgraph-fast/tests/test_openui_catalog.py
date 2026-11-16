"""Capture the actual model boundary, including catalog refresh without re-import."""
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import pytest

from domains.technical_analysis.canvas import compose_canvas, layout_errors
from graph.subgraphs.openui_output import catalog
from graph.subgraphs.openui_output.workflow import GeneratedUI, _compose_ui
from tests.test_technical_analysis_agent import report_state


class ComposerSpy:
    def __init__(self):
        self.calls=[]

    def with_structured_output(self, schema):
        assert schema is GeneratedUI
        return self

    async def ainvoke(self, messages):
        self.calls.append(deepcopy(messages))
        return GeneratedUI(program='root = Col([Text("검증")], 4)')

    async def astream(self, messages, **kwargs):
        self.calls.append(deepcopy(messages))
        yield SimpleNamespace(content='taLayout = Grid([taPanel, Markdown("설명"), taSignals], 2, 320, 4)')


async def valid(_program):
    return []


def test_packaged_catalog_matches_current_frontend_artifact():
    frontend=Path(__file__).resolve().parents[2]/'1-fe-host/src/shared/config/openui/system-prompt.txt'
    assert catalog.CATALOG_PATH.read_bytes()==frontend.read_bytes()
    text=catalog.load_openui_catalog()
    assert 'IndicatorControls(' in text
    assert 'QueryPanel(' in text and 'FinancialChart(' in text
    assert 'technical_analysis_catalog' in text and 'schema_version' in text
    assert 'Grid(children: Node[], columns?: number, minChildWidth?: number, gap?: number)' in text


@pytest.mark.asyncio
@pytest.mark.parametrize('canvas',[False,True])
async def test_actual_model_prompt_contains_catalog_and_rereads_updates(tmp_path,monkeypatch,canvas):
    original=catalog.load_openui_catalog()
    path=tmp_path/'system-prompt.txt'
    monkeypatch.setattr(catalog,'CATALOG_PATH',path)
    spy=ComposerSpy()
    report=report_state()['analysis_result'] if canvas else None
    for revision in ('REVISION_A','REVISION_B'):
        path.write_text(original+'\n'+revision,encoding='utf-8')
        if canvas:
            await compose_canvas(spy,report,'선택 지표 설명',lambda *_:None,valid)
        else:
            await _compose_ui('설명',{},spy,validator=valid)
    first,last=[messages[0].content for messages in spy.calls]
    assert 'REVISION_A' in first and 'REVISION_B' not in first
    assert 'REVISION_B' in last and 'REVISION_A' not in last
    for prompt in (first,last):
        assert 'IndicatorControls(' in prompt and 'technical_analysis_catalog' in prompt
        assert 'Grid(children: Node[], columns?: number, minChildWidth?: number, gap?: number)' in prompt
    if canvas:
        assert 'TA CANVAS SCOPE' in last
        assert 'server owns the prefix, Query, IndicatorControls, data and final root' in last
        assert 'Use only Col/Row/Grid/Text/Title/Markdown' in last
        assert 'requested TA20 indicator instances' in last
        assert 'price/volume/SMA/RSI/MACD' not in last


def test_catalog_does_not_expand_canvas_execution_permissions():
    assert layout_errors('taLayout = Col([taPanel, taSignals], 4)')==[]
    assert layout_errors('taLayout = Col([taPanel, Query("x",{}), taSignals], 4)')
    assert layout_errors('taLayout = Col([taPanel, taSignals], 4)\nsnapshot = {}')
    assert layout_errors('taLayout = Col([taPanel, FinancialChart({}), taSignals], 4)')
