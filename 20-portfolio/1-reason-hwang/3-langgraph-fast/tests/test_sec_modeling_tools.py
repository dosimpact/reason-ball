import asyncio

from domains.sec_tools.modeling import build_sec_modeling_tools


class Client:
    def __init__(self):
        self.calls = []

    async def request(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        return {"items": []}


def test_analysis_tools_use_published_bff_endpoints():
    client = Client()
    tools = {tool.name: tool for tool in build_sec_modeling_tools(client)}
    scope = ["filing:0000320193:0000320193-26-000001"]
    asyncio.run(tools["search_sec_evidence"].ainvoke({"query": "risk", "filingIds": scope}))
    asyncio.run(tools["query_sec_xbrl_facts"].ainvoke({"filingIds": scope, "conceptQName": "{gaap}Revenue"}))
    asyncio.run(tools["get_sec_evidence"].ainvoke({"evidenceId": "chunk/a?b"}))
    assert [call[:2] for call in client.calls] == [("POST", "modeling/search"), ("POST", "modeling/facts/query"), ("GET", "modeling/evidence/chunk%2Fa%3Fb")]
    assert client.calls[0][2]["body"]["filingIds"] == scope
