import json

import pytest
from langchain_core.messages import AIMessage

from domains.sec_chat.modeling import research_modeling

FILING = {"cik": "0000320193", "accessionNo": "0000320193-25-000079"}
FID = "filing:0000320193:0000320193-25-000079"


class Model:
    def __init__(self, calls):
        self.calls = iter(calls)
        self.messages = []

    def bind_tools(self, tools):
        self.names = [tool.name for tool in tools]
        return self

    async def ainvoke(self, messages):
        self.messages = list(messages)
        return AIMessage(content="", tool_calls=next(self.calls, []))


def call(name, args):
    return {"name": name, "args": args, "id": name}


class Client:
    def __init__(self, wrong=False, fail=False):
        self.calls = []
        self.wrong = wrong
        self.fail = fail

    async def request(self, method, path, body=None):
        self.calls.append((method, path, body))
        if self.fail:
            raise RuntimeError("SECRET upstream details")
        row = {
            "id": "row1",
            "evidenceId": "row1",
            "filingId": "other" if self.wrong else FID,
            "text": "Evidence content " + "x" * 4000,
            "displayHtml": "SECRET_HTML",
        }
        return row if method == "GET" else {"items": [row]}


@pytest.mark.asyncio
async def test_all_three_read_tools_execute_and_preserve_scoped_compact_provenance():
    client = Client()
    model = Model(
        [
            [call("search_sec_evidence", {"query": "revenue", "filingIds": [FID]})],
            [call("query_sec_xbrl_facts", {"filingIds": [FID]})],
            [call("get_sec_evidence", {"evidenceId": "row1"})],
        ]
    )
    result = await research_modeling(model, {"filing": FILING}, "sales", client=client)
    assert result["status"] == "available"
    assert len(client.calls) == 3 and len(model.names) == 3
    assert result["sources"][0]["filingId"] == FID
    assert len(result["sources"][0]["text"]) == 3000
    assert "SECRET_HTML" not in json.dumps(result)
    assert result["sources"][0]["sourceTool"] == "get_sec_evidence"


@pytest.mark.asyncio
async def test_cross_filing_requests_and_unguessed_evidence_are_rejected_before_io():
    client = Client()
    model = Model(
        [
            [call("search_sec_evidence", {"query": "x", "filingIds": ["other"]})],
            [call("get_sec_evidence", {"evidenceId": "guessed"})],
        ]
    )
    result = await research_modeling(model, {"filing": FILING}, "sales", client=client)
    assert client.calls == [] and result["status"] == "unavailable"
    assert result["sources"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("wrong,fail", [(True, False), (False, True)])
async def test_bad_response_or_outage_falls_back_without_sources_or_secret(wrong, fail):
    client = Client(wrong, fail)
    result = await research_modeling(
        Model([[call("query_sec_xbrl_facts", {"filingIds": [FID]})]]),
        {"filing": FILING},
        "sales",
        client=client,
    )
    assert result["status"] == "unavailable" and result["sources"] == []
    assert "SECRET" not in json.dumps(result)
    assert result["limitations"]


@pytest.mark.asyncio
async def test_empty_results_are_not_absence_of_filing():
    class Empty(Client):
        async def request(self, *args, **kwargs):
            return {"items": []}

    result = await research_modeling(
        Model([[call("query_sec_xbrl_facts", {"filingIds": [FID]})]]),
        {"filing": FILING},
        "sales",
        client=Empty(),
    )
    assert result["status"] == "empty"
    assert "없다는 의미는 아닙니다" in result["limitations"][0]


@pytest.mark.asyncio
async def test_followup_includes_bounded_history_and_resolved_task():
    model = Model([])
    await research_modeling(
        model,
        {"filing": FILING},
        "그중 매출은?",
        client=Client(),
        history=[{"role": "assistant", "content": "제품별 매출"}],
        task="제품별 매출 비교",
    )
    prompt = json.loads(model.messages[1].content)
    assert prompt["history"][0]["content"] == "제품별 매출"
    assert prompt["task"] == "제품별 매출 비교"


@pytest.mark.asyncio
async def test_invalid_identity_skips_optional_reads_and_preserves_fallback():
    client = Client()
    result = await research_modeling(
        Model([]), {"filing": {"cik": "bad"}}, "sales", client=client
    )
    assert result["status"] == "unavailable" and client.calls == []
