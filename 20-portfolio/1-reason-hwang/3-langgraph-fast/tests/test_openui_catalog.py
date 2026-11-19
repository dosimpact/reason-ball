"""Capture the actual model boundary, including catalog refresh without re-import."""
from copy import deepcopy
from pathlib import Path

import pytest

from domains.technical_analysis.presentation import (
    canvas_item_errors,
    presentation_input,
)
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
    presentation = presentation_input(report_state(), 'saved-1') if canvas else None
    for revision in ('REVISION_A','REVISION_B'):
        path.write_text(original+'\n'+revision,encoding='utf-8')
        if canvas:
            await _compose_ui('선택 지표 설명', presentation['answer'], spy, validator=valid, presentation_context=presentation['presentation_context'])
        else:
            await _compose_ui('설명',{},spy,validator=valid)
    first,last=[messages[0].content for messages in spy.calls]
    assert 'REVISION_A' in first and 'REVISION_B' not in first
    assert 'REVISION_B' in last and 'REVISION_A' not in last
    for prompt in (first,last):
        assert 'IndicatorControls(' in prompt and 'technical_analysis_catalog' in prompt
        assert 'Grid(children: Node[], columns?: number, minChildWidth?: number, gap?: number)' in prompt
    if canvas:
        import json
        payload = json.loads(spy.calls[-1][1].content)
        assert payload["presentationContext"]["canvasItems"][0]["id"] == "saved-1:chart"
        assert "taLayout" not in last


def test_catalog_does_not_expand_canvas_identity_permissions():
    assert canvas_item_errors('root = CanvasItem("saved:chart", "Price", [])', {"saved:chart"}) == []
    assert canvas_item_errors('root = CanvasItem("foreign", "Price", [])', {"saved:chart"})
