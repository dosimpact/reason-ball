"""Owned HTTP fixture: real SEC router, no external SEC or model calls."""
from fastapi import FastAPI

from server.sec_chat import router as module


async def prepare(cik, refresh, model, activity=None):
    return {'cik': cik, 'sections': {'Item 1': 'Saved fixture document'}, 'fixtureRefresh': refresh}


module.prepare_filing = prepare
module.chat_model = lambda: object()
app = FastAPI()
app.include_router(module.router)
