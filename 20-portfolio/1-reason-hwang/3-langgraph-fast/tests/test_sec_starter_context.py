"""Representative answers use server provenance and actual service capabilities."""
import json
from copy import deepcopy
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage

from domains.sec_chat.answer import DraftAnswer, DraftFinding
from domains.sec_chat.conversation import (
    ConversationIntent,
    ConversationRequest,
    resolve_conversation,
)
from domains.sec_chat.follow_ups import FollowUps
from domains.sec_chat.source import prepare_source
from graph.primary_graphs.sec_intelligent_ui.workflow import Intent, build_graph
from graph.subgraphs.openui_output.workflow import GeneratedUI, _compose_ui
from tests.test_sec_intelligent_ui import FILING, HTML, valid_ui


class Model:
    def __init__(self):
        self.calls = {}

    def bind_tools(self, _tools):
        async def invoke(_messages):
            return AIMessage(content="No published evidence selected.")
        return SimpleNamespace(ainvoke=invoke)

    def with_structured_output(self, schema):
        async def invoke(messages):
            self.calls.setdefault(schema, []).append(deepcopy(messages))
            if schema is Intent:
                return Intent(items=["1"], task="공시 제출일과 접수번호 및 SEC 최신성")
            if schema is DraftAnswer:
                data = json.loads(messages[-1].content)
                date = data["filingContext"]["filing"]["filingDate"]
                return DraftAnswer(title="공시 출처", findings=[DraftFinding(item="1", heading="저장 공시의 사업 원문", summary=f"제출일 {date}의 공시에서 사업 내용을 읽을 수 있습니다.", evidence_id="1:1")], limitations="SEC 최신성은 checkedAt에 따릅니다.")
            if schema is FollowUps:
                return FollowUps(questions=["사업 내용은?", "위험요인은?", "재무제표는?"])
            if schema is ConversationIntent:
                return ConversationIntent(action="reply", company_queries=[], question="", reply="게시 모델링은 추출된 공시와 XBRL 근거입니다.")
            assert schema is GeneratedUI
            return GeneratedUI(program='root = Text("공시 출처")')
        return SimpleNamespace(ainvoke=invoke)


@pytest.mark.asyncio
@pytest.mark.parametrize("checked_at", [None, "2026-11-17T10:00:00Z"])
async def test_provenance_reaches_both_answer_and_ui_without_private_fields(checked_at):
    source = prepare_source(HTML, FILING, checked_at)
    source["database_url"] = "private-connection"
    source["filing"]["document_content"] = "private-body"
    model = Model()
    result = await build_graph(model, ui_validator=valid_ui).ainvoke({
        "source": source, "question": "제출일과 접수번호, SEC 최신성 확인 여부", "history": [],
        "intent": {}, "evidence": {}, "answer": {}, "program": "",
    })
    answer_messages = model.calls[DraftAnswer][0]
    context = json.loads(answer_messages[-1].content)["filingContext"]
    assert context["filing"]["filingDate"] == FILING["filingDate"]
    assert context["filing"]["accessionNo"] == FILING["accessionNo"]
    assert context["sourceUrl"] == source["sourceUrl"]
    assert context["checkedAt"] == checked_at
    assert "private-" not in json.dumps(context)
    assert "do not substitute the audit date" in answer_messages[0].content
    assert "checkedAt=null" in answer_messages[0].content
    ui_messages = model.calls[GeneratedUI][0]
    assert json.loads(ui_messages[-1].content)["answer"]["filingContext"] == context
    assert result["provenance"]["filing"]["filingDate"] == FILING["filingDate"]
    assert result["provenance"]["checkedAt"] == checked_at


@pytest.mark.asyncio
async def test_capability_prompt_distinguishes_published_evidence_and_explain_only_collection():
    model = Model()
    await resolve_conversation(ConversationRequest(message="이 채팅에서 게시 모델링 근거로 무엇을 물을 수 있나요?"), None, model)
    prompt = model.calls[ConversationIntent][0][0].content
    assert "search_sec_evidence, query_sec_xbrl_facts and get_sec_evidence" in prompt
    assert "NOT a stored DCF/valuation model" in prompt
    assert "지금은 실행하지 마" in prompt
    assert "10-K, 10-Q, 8-K and their amendments" in prompt
    assert "do not return collect" in prompt


@pytest.mark.asyncio
@pytest.mark.parametrize("host_evidence", [True, False])
async def test_generated_quotes_are_reserved_for_host_verified_evidence(host_evidence):
    model = Model()
    await _compose_ui("사업 요약", {"findings": [{"quote": "Verified original text."}]}, model, validator=valid_ui, host_evidence=host_evidence)
    prompt = model.calls[GeneratedUI][0][0].content
    assert ("SEC HOST EVIDENCE" in prompt) == host_evidence
    if host_evidence:
        assert "Do not generate Quote components or Markdown blockquotes" in prompt


@pytest.mark.asyncio
async def test_sec_composition_repairs_quote_constructor_but_allows_quoted_text():
    class QuoteModel:
        def __init__(self):
            self.calls = 0

        def with_structured_output(self, _schema):
            return self

        async def ainvoke(self, messages):
            self.calls += 1
            if self.calls == 1:
                return GeneratedUI(program='root = Quote("Paraphrased and unverified")')
            assert "host renders verified original quotations" in messages[-1].content
            return GeneratedUI(program='root = Text("Quote( is a component name, not a quotation here.")')

    model = QuoteModel()
    result = await _compose_ui("사업 요약", {"findings": [{"quote": "Verified original text."}]}, model, validator=valid_ui)
    assert model.calls == 2
    assert result.startswith("root = Text")


@pytest.mark.asyncio
async def test_non_sec_composition_can_still_use_quote_components():
    class QuoteModel:
        def with_structured_output(self, _schema):
            return self

        async def ainvoke(self, _messages):
            return GeneratedUI(program='root = Quote("A conceptual example")')

    result = await _compose_ui("예시", {}, QuoteModel(), validator=valid_ui)
    assert "Quote(" in result
