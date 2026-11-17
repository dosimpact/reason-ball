"""Owned HTTP fixture for selected-company collection Bruno checks."""
import json

import httpx
from fastapi import FastAPI
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from domains.sec_tools import tools as sec_tools
from server.sec_chat import router as sec_router


class CollectionToolModel:
    def bind_tools(self, tools, **kwargs):
        return self

    async def ainvoke(self, messages):
        if any(isinstance(message, ToolMessage) for message in messages):
            return AIMessage(content='done')
        request = next(json.loads(message.content) for message in messages if isinstance(message, HumanMessage))
        args = {'ciks': [request['cik']], 'years': request['years']}
        if request.get('since'):
            args['since'] = request['since']
        return AIMessage(content='', tool_calls=[{'name': 'sync_sec_company_filings', 'args': args,
                                                  'id': 'selected-sync', 'type': 'tool_call'}])


def bff_response(request):
    assert request.method == 'POST' and request.url.path == '/api/sec/company-filing-sync-jobs'
    payload = json.loads(request.content)
    assert payload['ciks'] == ['0000320193'] and payload['downloadDocuments'] is True
    if payload['years'] == 3:
        body = 'event: completed\ndata: {"companiesProcessed":1,"filingsSynced":4,"downloaded":2,"failed":1}\n\n'
    else:
        body = 'event: completed\ndata: {"companiesProcessed":1,"filingsSynced":4,"downloaded":3,"failed":0}\n\n'
    return httpx.Response(200, text=body, headers={'content-type': 'text/event-stream'})


def bff_init(self, base_url=None, transport=None):
    self.base_url = 'http://sec-bff.fixture'
    self.transport = httpx.MockTransport(bff_response)


sec_tools.SecBffClient.__init__ = bff_init
sec_router.chat_model = CollectionToolModel
app = FastAPI()
app.include_router(sec_router.router)
