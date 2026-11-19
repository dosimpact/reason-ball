"""Production ResearchChat HTTP/graph/tools; only model and BFF are fixed."""

import json
from types import SimpleNamespace

import httpx
from fastapi import FastAPI
from langchain_core.messages import AIMessage, ToolMessage
from test_sec_intelligent_ui import FILING, HTML

from domains.sec_chat.answer import DraftAnswer, DraftFinding
from domains.sec_chat.follow_ups import FollowUps
from domains.sec_chat.source import prepare_source
from domains.sec_tools.tools import SecBffClient
from graph.primary_graphs.sec_intelligent_ui.workflow import Intent, build_graph
from graph.subgraphs.openui_output.workflow import GeneratedUI
from server.sec_chat import router as routes

FILING_ID = f"filing:{FILING['cik']}:{FILING['accessionNo']}"
TRACE = []


class Model:
    mode = "normal"
    draft_calls = 0

    def bind_tools(self, tools):
        async def invoke(messages):
            if not any(isinstance(m, ToolMessage) for m in messages):
                from langchain_core.messages import HumanMessage

                content = next(
                    m.content for m in messages if isinstance(m, HumanMessage)
                )
                try:
                    context = json.loads(content)
                except (ValueError, TypeError):
                    context = {}
                TRACE.append(
                    {
                        "kind": "tool-context",
                        "historyLength": len(context.get("history", [])),
                        "task": context.get("task"),
                    }
                )
            completed = [m for m in messages if isinstance(m, ToolMessage)]
            index = len(completed)
            sequence = [
                ("search_sec_evidence", {"query": "revenue", "filingIds": [FILING_ID]}),
                ("query_sec_xbrl_facts", {"filingIds": [FILING_ID]}),
                ("get_sec_evidence", {"evidenceId": "ev-001"}),
            ]
            if self.mode in ("empty", "failure") and index >= 2:
                return AIMessage(
                    content="Use original Item evidence, modeling is unavailable or empty."
                )
            if index >= len(sequence):
                return AIMessage(content="Evidence inspected.")
            name, args = sequence[index]
            if self.mode == "wrong-scope" and index == 0:
                args["filingIds"] = ["filing:0000000042:0000000042-26-000001"]
            return AIMessage(
                content="",
                tool_calls=[{"name": name, "args": args, "id": f"fixture-{index}"}],
            )

        return SimpleNamespace(ainvoke=invoke)

    def with_structured_output(self, schema):
        async def invoke(messages):
            data = json.loads(messages[-1].content)
            if schema is Intent:
                self.mode = data["question"].split()[0]
                TRACE.append(
                    {
                        "kind": "history",
                        "mode": self.mode,
                        "length": len(data.get("history", [])),
                    }
                )
                return Intent(items=["8"], task=data["question"])
            if schema is DraftAnswer:
                self.draft_calls += 1
                if "validationError" in data:
                    # Deliberately persist an invalid selected evidence ID to test
                    # both bounded repair failure and no history mutation.
                    selected = ["invented"]
                else:
                    rows = data.get("modelingEvidence", {}).get("sources", [])
                    selected = [r.get("evidenceId") or r["id"] for r in rows]
                    if self.mode == "unused":
                        selected = []
                    if self.mode == "invalid-id":
                        selected = ["invented"]
                return DraftAnswer(
                    title="Verified filing research",
                    findings=[
                        DraftFinding(
                            item="8",
                            heading="Revenue",
                            summary="원문 재무제표의 매출 근거를 확인했습니다.",
                            evidence_id="8:1",
                        )
                    ],
                    limitations="Fixture excerpt only.",
                    modeling_evidence_ids=selected,
                )
            if schema is FollowUps:
                return FollowUps(
                    questions=[
                        "회계 주석을 설명해 줘.",
                        "다음 기간과 비교해 줘.",
                        "사업 위험을 알려 줘.",
                    ]
                )
            if schema is GeneratedUI:
                return GeneratedUI(
                    program="root = Markdown("
                    + json.dumps(
                        data["answer"]["title"]
                        + "\n\n"
                        + data["answer"]["findings"][0]["summary"],
                        ensure_ascii=False,
                    )
                    + ")"
                )
            raise AssertionError(schema)

        return SimpleNamespace(ainvoke=invoke)


def client(model):
    def respond(request):
        body = json.loads(request.content) if request.content else None
        TRACE.append(
            {
                "kind": "bff",
                "mode": model.mode,
                "method": request.method,
                "path": request.url.path,
                "body": body,
            }
        )
        if model.mode == "failure":
            return httpx.Response(503, json={"error": "fixture unavailable"})
        if model.mode == "empty":
            return httpx.Response(200, json={"items": []})
        identity = (
            FILING_ID
            if model.mode != "cross-source"
            else "filing:0000000042:0000000042-26-000001"
        )
        common = {
            "filingId": identity,
            "generationId": "published-generation",
            "itemCode": "8",
            "isActive": True,
        }
        if request.url.path.endswith("/search"):
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            **common,
                            "id": "chunk-001",
                            "evidenceId": "ev-001",
                            "text": "Net sales were 100 million dollars in 2025.",
                        }
                    ]
                },
            )
        if request.url.path.endswith("/facts/query"):
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            **common,
                            "id": "fact-001",
                            "evidenceIds": ["ev-001"],
                            "conceptQName": "{fixture}Revenue",
                            "value": "100000000",
                            "unit": {"numerator": ["USD"], "denominator": []},
                            "period": {
                                "startDate": "2025-01-01",
                                "endDate": "2025-12-31",
                            },
                            "selectionReason": "published exact context",
                            "selectionPolicyVersion": "fixture-1",
                            "analysisCategory": "OPERATING_PERFORMANCE",
                        }
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                **common,
                "id": "ev-001",
                "evidenceId": "ev-001",
                "text": "Net sales were 100 million dollars in 2025.",
            },
        )

    return SecBffClient(
        base_url="http://fixture-bff", transport=httpx.MockTransport(respond)
    )


async def prepare(cik, refresh, model, activity=None):
    return prepare_source(HTML, FILING, None)


async def valid_ui(program):
    return []


def graph(activity=None):
    model = Model()
    return build_graph(
        model=model,
        activity=activity,
        ui_validator=valid_ui,
        modeling_client=client(model),
    )


routes.prepare_filing = prepare
routes.chat_model = lambda: object()
routes.build_graph = graph
app = FastAPI()
app.include_router(routes.router)


@app.get("/qa/trace")
async def trace():
    return {
        "events": TRACE,
        "sessions": {
            key: {"historyLength": len(s.history), "busy": s.busy}
            for key, s in routes.sessions.items()
        },
    }
