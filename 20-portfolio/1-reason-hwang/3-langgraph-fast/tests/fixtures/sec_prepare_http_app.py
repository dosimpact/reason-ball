"""Production prepare HTTP/tools/parser with an isolated BFF and no model dependency."""
import httpx
from fastapi import FastAPI

from domains.sec_tools.agent import prepare_filing
from domains.sec_tools.tools import SecBffClient
from server.sec_chat import router as routes
from tests.test_sec_intelligent_ui import FILING, HTML

TRACE = []
SAVED = "0000000001"
PENDING = "0000000002"
EMPTY = "0000000003"
UNAVAILABLE = "0000000004"
MALFORMED = "0000000005"


def respond(request):
    TRACE.append({"method": request.method, "path": request.url.path, "params": dict(request.url.params)})
    cik = request.url.params.get("cik")
    if request.method == "POST":
        return httpx.Response(200, text='event: completed\ndata: {"companiesProcessed":1,"filingsSynced":1,"downloaded":1,"failed":0}\n\n')
    if request.url.path.endswith("/content"):
        return httpx.Response(200, text=HTML)
    if cik == UNAVAILABLE:
        return httpx.Response(503, json={"error": "fixture outage"})
    if cik == MALFORMED:
        return httpx.Response(200, json={"items": "invalid"})
    rows = [] if cik == EMPTY else [{**FILING, "cik": cik, "accessionNo": f"{cik}-26-000001"}]
    if cik == PENDING:
        rows.insert(0, {**FILING, "cik": cik, "accessionNo": "0000000002-26-999999", "filingDate": "2026-11-17", "status": "pending"})
    return httpx.Response(200, json={"items": rows, "pagination": {"page": 1, "hasNextPage": False}})


async def prepare(cik, refresh, model, activity=None):
    return await prepare_filing(cik, refresh, model, client=SecBffClient(transport=httpx.MockTransport(respond)), activity=activity)


def forbidden_model():
    raise AssertionError("prepare must not initialize a model")


routes.prepare_filing = prepare
routes.chat_model = forbidden_model
app = FastAPI()
app.include_router(routes.router)


@app.get("/qa/trace")
async def trace():
    return {"requests": TRACE, "sessionCount": len(routes.sessions)}
