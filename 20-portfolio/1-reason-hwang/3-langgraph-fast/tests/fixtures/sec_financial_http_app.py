"""Production SEC HTTP/research/UI path with deterministic model and filing tools."""

import json
from copy import deepcopy
from types import SimpleNamespace

from fastapi import FastAPI
from langchain_core.messages import AIMessage, ToolMessage
from test_sec_financial_verification import SOURCE, SOURCE_ID, payload

import server.sec_deep_agent.router as routes
from domains.sec_tools.financial_verification import FinancialEvidence
from graph.subgraphs.openui_output.workflow import GeneratedUI


class Agent:
    async def ainvoke(self, state, config):
        mode = state["messages"][-1].content
        report = f"{mode}\n\n회사 개요: Founded in 1976. 100 shares.\n\n원금 부채 USD 80111000000, 비율1.71배."
        if mode == "nonfinancial":
            report = "Founded in 1976. There are 100 shares."
        cik, accession = SOURCE_ID.split(":")
        records = [
            {
                "tool": "list_sec_filings",
                "args": {},
                "result": {
                    "items": [
                        {
                            "cik": cik,
                            "accessionNo": accession,
                            "filingDate": "2026-10-01",
                            "formType": "10-K",
                            "filingUrl": "https://www.sec.gov/Archives/fixture",
                        }
                    ]
                },
            },
            {
                "tool": "get_sec_filing_content",
                "args": {
                    "cik": cik,
                    "accessionNo": accession,
                    "offset": 0,
                    "query": "",
                    "limit": 12000,
                },
                "result": SOURCE,
            },
        ]
        return {
            "messages": [
                ToolMessage(content="fixture", tool_call_id=str(i), artifact=r)
                for i, r in enumerate(records)
            ]
            + [AIMessage(content=report)]
        }


class Model:
    def with_structured_output(self, schema):
        async def invoke(messages):
            content = json.loads(messages[-1].content)
            if schema is GeneratedUI:
                return GeneratedUI(
                    program="root = Markdown("
                    + json.dumps(content["answer"]["report"])
                    + ")"
                )
            assert schema is FinancialEvidence
            mode = content["report"].splitlines()[0]
            if mode == "extraction-failure":
                raise ValueError("fixture malformed model response")
            data = deepcopy(payload())
            if mode == "mixed":
                data["calculations"][0]["inputs"] = ["book", "cp"]
            elif mode == "source":
                data["facts"][0]["sourceId"] = "invented"
            elif mode == "unit":
                data["facts"][0]["scale"] = "billions"
            elif mode == "date":
                data["facts"][0]["asOf"] = "2025-09-26"
            elif mode == "no-evidence":
                data = {
                    "facts": [],
                    "calculations": [],
                    "limitations": ["원문에서 계산 기준을 확인하지 못함"],
                }
            return FinancialEvidence.model_validate(data)

        return SimpleNamespace(ainvoke=invoke)


routes.build_sec_deep_agent = lambda **kwargs: Agent()
routes.chat_model = Model
app = FastAPI()
app.include_router(routes.router)
