"""Isolated real HTTP chart API with deterministic market data for Bruno."""

from fastapi import FastAPI

from server.technical_analysis import router as chart_module
from tests.test_technical_analysis_agent import fixture_fetcher

chart_module.fetch_historical_prices = fixture_fetcher
app = FastAPI()
app.include_router(chart_module.router)
