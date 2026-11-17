"""Production collection HTTP/tools with isolated BFF SSE and no model initialization."""
import json

import httpx
from fastapi import FastAPI

from domains.sec_tools import tools as sec_tools
from server.sec_chat import router as routes

TRACE = []


def respond(request):
    payload = json.loads(request.content)
    TRACE.append({"method": request.method, "path": request.url.path, "body": payload})
    assert request.method == "POST" and request.url.path == "/api/sec/company-filing-sync-jobs"
    assert payload["ciks"] == ["0001045810"] and payload["downloadDocuments"] is True
    years = payload["years"]
    if years == 3:
        text = 'event: progress\ndata: {"companiesProcessed":0}\n\n'
    elif years == 6:
        return httpx.Response(503, json={"error": "fixture unavailable"})
    elif years == 8:
        text = 'event: error\ndata: {"message":"private upstream payload"}\n\n'
    else:
        result = {"companiesProcessed": 1, "filingsSynced": 4, "downloaded": 3, "failed": 0}
        if years == 4:
            result["failed"] = 1
        if years == 5:
            result["companiesProcessed"] = 0
        if years == 7:
            result["downloaded"] = True
        text = "event: completed\ndata: " + json.dumps(result) + "\n\n"
    return httpx.Response(200, text=text, headers={"content-type": "text/event-stream"})


def client_init(self, base_url=None, transport=None):
    self.base_url = "http://collection-bff.fixture"
    self.transport = httpx.MockTransport(respond)


def forbidden_model():
    raise AssertionError("confirmed collection must not initialize a model")


sec_tools.SecBffClient.__init__ = client_init
routes.chat_model = forbidden_model
app = FastAPI()
app.include_router(routes.router)


@app.get("/qa/trace")
async def trace():
    return {"requests": TRACE, "sessionCount": len(routes.sessions)}
