"""Small custom app mounted by LangGraph development runtime."""

from fastapi import FastAPI

from server.technical_analysis.router import router

app = FastAPI()
app.include_router(router)
