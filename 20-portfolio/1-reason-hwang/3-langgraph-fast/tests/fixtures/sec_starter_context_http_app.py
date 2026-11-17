"""Real SEC routes/lookup/graph/parser with controlled company data and model outputs."""
import json
from types import SimpleNamespace

import httpx
from fastapi import FastAPI
from langchain_core.messages import AIMessage

from domains.sec_chat.answer import DraftAnswer, DraftFinding
from domains.sec_chat.conversation import ConversationIntent
from domains.sec_chat.follow_ups import FollowUps
from domains.sec_tools import tools as sec_tools
from graph.primary_graphs.sec_intelligent_ui.conversation import build_conversation_graph
from graph.primary_graphs.sec_intelligent_ui.workflow import Intent, build_graph
from graph.subgraphs.openui_output.workflow import GeneratedUI
from server.sec_chat import router as routes
from tests.test_sec_intelligent_ui import HTML

CIK = "0001326801"
FILING = {"cik": CIK, "accessionNo": CIK + "-26-000001", "filingDate": "2026-01-29", "formType": "10-K", "status": "downloaded"}
TRACE = {"requests": [], "contexts": []}


def respond(request):
    TRACE["requests"].append({"method": request.method, "path": request.url.path, "params": dict(request.url.params)})
    if request.url.path.endswith("/companies"):
        if request.url.params.get("ticker"):
            rows = []
        else:
            rows = [{"cik": str(i + 1).zfill(10), "name": f"Metals Company {i}", "ticker": f"M{i}"} for i in range(11)]
            rows.append({"cik": CIK, "name": "Meta Platforms, Inc.", "ticker": "METAM"})
        return httpx.Response(200, json={"items": rows, "pagination": {"hasNextPage": False}})
    if request.url.path.endswith("/content"):
        return httpx.Response(200, text=HTML)
    return httpx.Response(200, json={"items": [FILING], "pagination": {"hasNextPage": False}})


def client_init(self, base_url=None, transport=None):
    self.base_url = "http://starter-bff.fixture"
    self.transport = httpx.MockTransport(respond)


class Model:
    def bind_tools(self, _tools):
        async def invoke(_messages):
            return AIMessage(content="No published facts selected.")
        return SimpleNamespace(ainvoke=invoke)

    def with_structured_output(self, schema):
        async def invoke(messages):
            data = json.loads(messages[-1].content)
            if schema is ConversationIntent:
                if "실행하지" in data["message"]:
                    return ConversationIntent(action="reply", company_queries=[], question="", reply="10-K·10-Q·8-K와 정정 공시를 포함합니다. 지금 수집을 실행하지 않았습니다.")
                return ConversationIntent(action="research", company_queries=["META"], question=data["message"], reply="")
            if schema is Intent:
                return Intent(items=["1"], task="공시 메타데이터 확인")
            if schema is DraftAnswer:
                TRACE["contexts"].append({"boundary": "answer", "context": data["filingContext"]})
                return DraftAnswer(title="저장 공시", findings=[DraftFinding(item="1", heading="사업 원문", summary="공시의 사업 내용을 확인할 수 있습니다.", evidence_id="1:1")], limitations="SEC 최신성 미확인")
            if schema is FollowUps:
                return FollowUps(questions=["사업은?", "위험은?", "재무제표는?"])
            assert schema is GeneratedUI
            answer = data["answer"]
            if "filingContext" in answer:
                context = answer["filingContext"]
                TRACE["contexts"].append({"boundary": "ui", "context": context})
                text = f"제출일 {context['filing']['filingDate']}, 접수번호 {context['filing']['accessionNo']}, SEC 최신성 미확인"
            else:
                text = answer["reply"]
            return GeneratedUI(program="root = Markdown(" + json.dumps(text, ensure_ascii=False) + ")")
        return SimpleNamespace(ainvoke=invoke)


sec_tools.SecBffClient.__init__ = client_init
routes.chat_model = Model
routes.build_conversation_graph = lambda activity=None: build_conversation_graph(model=Model(), activity=activity)
routes.build_graph = lambda activity=None: build_graph(model=Model(), activity=activity)
app = FastAPI()
app.include_router(routes.router)


@app.get("/qa/trace")
async def trace():
    return TRACE
