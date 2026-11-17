"""Bounded schema/DSL repair without retrying infrastructure failures."""
import asyncio
from unittest.mock import AsyncMock

import httpx
import pytest
from langchain_core.exceptions import OutputParserException
from pydantic import ValidationError

from graph.subgraphs.openui_output.workflow import GeneratedUI, _compose_ui

PROGRAM = 'root = Text("private-program")'


class Model:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = 0
        self.messages = []

    def with_structured_output(self, schema):
        assert schema is GeneratedUI
        return self

    async def ainvoke(self, messages):
        self.calls += 1
        self.messages.append(list(messages))
        response = next(self.responses)
        if isinstance(response, BaseException):
            raise response
        return response


def schema_error():
    with pytest.raises(ValidationError) as caught:
        GeneratedUI(program='')
    return caught.value


@pytest.mark.asyncio
@pytest.mark.parametrize('invalid', [OutputParserException('private-output'), schema_error(), None, {}, {'program': 12}])
async def test_recovers_schema_response_once(invalid):
    model = Model([invalid, {'program': PROGRAM}])
    validator = AsyncMock(return_value=[])
    assert await _compose_ui('private-question', {}, model, validator=validator) == PROGRAM
    assert model.calls == 2
    validator.assert_awaited_once_with(PROGRAM)
    assert 'GeneratedUI JSON object' in model.messages[0][0].content
    assert 'program' in model.messages[1][-1].content
    assert 'private-output' not in model.messages[1][-1].content


@pytest.mark.asyncio
async def test_exhausted_schema_retains_cause():
    failure = OutputParserException('private-output')
    model = Model([None, failure])
    validator = AsyncMock(return_value=[])
    with pytest.raises(ValueError, match='응답 형식 검증') as caught:
        await _compose_ui('question', {}, model, validator=validator)
    assert caught.value.__cause__ is failure
    assert model.calls == 2
    validator.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('schema_first', [True, False])
async def test_schema_and_dsl_share_two_attempt_budget(schema_first):
    model = Model([None, GeneratedUI(program=PROGRAM)] if schema_first else [GeneratedUI(program=PROGRAM), None])
    validator = AsyncMock(return_value=['private-parser-error'])
    with pytest.raises(ValueError, match='검증'):
        await _compose_ui('question', {}, model, validator=validator)
    assert model.calls == 2
    validator.assert_awaited_once_with(PROGRAM)
    if not schema_first:
        assert 'parserErrors' in model.messages[1][-1].content


@pytest.mark.asyncio
async def test_dsl_repair_preserves_feedback():
    model = Model([GeneratedUI(program=PROGRAM), GeneratedUI(program=PROGRAM)])
    validator = AsyncMock(side_effect=[['private-parser-error'], []])
    assert await _compose_ui('question', {}, model, validator=validator) == PROGRAM
    assert 'private-parser-error' in model.messages[1][-1].content
    assert validator.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', [RuntimeError('private-provider'), asyncio.CancelledError()])
async def test_provider_failure_and_cancellation_propagate(failure):
    model = Model([failure])
    validator = AsyncMock(return_value=[])
    with pytest.raises(type(failure)) as caught:
        await _compose_ui('question', {}, model, validator=validator)
    assert caught.value is failure
    assert model.calls == 1
    validator.assert_not_awaited()


@pytest.mark.asyncio
async def test_validator_transport_does_not_retry():
    model = Model([GeneratedUI(program=PROGRAM)])
    failure = httpx.ConnectError('private-validator')
    validator = AsyncMock(side_effect=failure)
    with pytest.raises(httpx.ConnectError) as caught:
        await _compose_ui('question', {}, model, validator=validator)
    assert caught.value is failure
    assert model.calls == 1
    validator.assert_awaited_once_with(PROGRAM)


@pytest.mark.asyncio
async def test_stage_logging_never_contains_payloads(caplog):
    model = Model([OutputParserException('private-output'), GeneratedUI(program=PROGRAM)])
    validator = AsyncMock(return_value=['private-parser-error'])
    with pytest.raises(ValueError):
        await _compose_ui('private-question', {'secret': 'private-answer'}, model, validator=validator)
    provider = Model([RuntimeError('private-provider')])
    with pytest.raises(RuntimeError):
        await _compose_ui('private-question', {}, provider, validator=validator)
    validator.side_effect = httpx.ConnectError('private-validator')
    with pytest.raises(httpx.ConnectError):
        await _compose_ui('private-question', {}, Model([GeneratedUI(program=PROGRAM)]), validator=validator)
    assert 'schema failure' in caplog.text
    assert 'DSL failure' in caplog.text
    assert 'compose failure' in caplog.text
    assert 'validator failure' in caplog.text
    assert 'error_count=1' in caplog.text
    assert 'private-' not in caplog.text


@pytest.mark.asyncio
async def test_output_graph_forwards_trusted_context_through_repair():
    import json

    from graph.subgraphs.openui_output.workflow import build_output_graph

    model = Model([GeneratedUI(program=PROGRAM), GeneratedUI(program=PROGRAM)])
    validator = AsyncMock(side_effect=[["Missing server-owned CanvasItem ID"], []])
    context = {"kind": "technical_analysis", "canvasItems": [{"id": "report:chart"}]}
    result = await build_output_graph(model, validator=validator).ainvoke({
        "question": "주봉 비교", "answer": {"symbol": "AAPL"},
        "presentation_context": context, "host_evidence": False,
    })
    assert result["program"] == PROGRAM
    assert model.calls == 2
    for messages in model.messages:
        assert json.loads(messages[1].content)["presentationContext"] == context
        assert "server-supplied presentationContext" in messages[0].content
    assert "Missing server-owned CanvasItem ID" in model.messages[1][-1].content
