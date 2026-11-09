import pytest
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage
from pydantic import ValidationError

from domains.tenk.a2ui_report import ReportError, generate_report, prepare_report_source
from domains.tenk.a2ui_report_plan import ReportPlan, plan_report
QUOTE = "The company provides cloud services to enterprise customers."


class Model(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def tool_result(name, value):
    return AIMessage(content="", tool_calls=[{"id": name, "name": name, "args": value}])


@pytest.mark.parametrize("value", [
    {"sections": []},
    {"sections": [{"section": "risks", "presentation": "chart"}]},
    {"sections": [{"section": "other", "presentation": "cards"}]},
    {"sections": [{"section": "risks", "presentation": "cards"}] * 2},
])
def test_plan_rejects_unbounded_or_unsupported_ui(value):
    with pytest.raises(ValidationError):
        ReportPlan.model_validate(value)


@pytest.mark.asyncio
async def test_plan_retries_invalid_output_then_accepts_requested_table():
    value = {"sections": [{"section": "risks", "presentation": "table"}]}
    model = Model(responses=[tool_result("ReportPlan", {"sections": []}), tool_result("ReportPlan", value)])
    assert (await plan_report(model, "위험만 표로")).model_dump() == value
    with pytest.raises(ReportError):
        await plan_report(Model(responses=[tool_result("ReportPlan", {"sections": []})]), "위험만")


@pytest.mark.asyncio
async def test_focused_report_rejects_unrequested_claims_and_keeps_citation_checks():
    source = prepare_report_source("ITEM 1. BUSINESS\n" + QUOTE, "10-K")
    claim = {"analysis": "클라우드 사업입니다.", "citations": [{"evidence_id": "E1", "quote": QUOTE}]}
    full = {"summary": [claim], "business": [], "financials": [], "risks": []}
    empty = {key: [] for key in full}
    model = Model(responses=[tool_result("FilingReport", full), tool_result("FilingReport", empty)])
    result = await generate_report(model, source, request="위험만", sections=["risks"])
    assert result.model_dump() == empty  # No supported risk evidence is a visible empty result.
    bad = {**empty, "risks": [{"analysis": "위험", "citations": [{"evidence_id": "E1", "quote": "This invented quote must never be displayed."}]}]}
    with pytest.raises(ReportError):
        await generate_report(Model(responses=[tool_result("FilingReport", bad)]), source, request="위험만", sections=["risks"])
