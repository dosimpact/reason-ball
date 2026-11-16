"""Owned HTTP fixture: real catalog tool/Yahoo adapter with deterministic provider rows."""

import pandas as pd
from fastapi import FastAPI, HTTPException

from graph.primary_graphs.talib_agent.tools import build_tools
from graph.subgraph.price_agent.tools import yahoo_finance

app = FastAPI()


class FixtureTicker:
    def __init__(self, symbol):
        self.symbol = symbol

    def history(self, **kwargs):
        self.frame = pd.DataFrame(
            {
                "Open": [100.0] * 700,
                "High": [110.0] * 700,
                "Low": [90.0] * 700,
                "Close": [105.0] * 700,
                "Volume": [1000] * 700,
            },
            index=pd.date_range("2010-01-01", periods=700, freq="W", tz="Asia/Seoul"),
        )
        self.frame.iloc[0, self.frame.columns.get_loc("Close")] = -1
        if self.symbol == "BAD.KS":
            self.frame.iloc[-1, self.frame.columns.get_loc("Close")] = -1
        return self.frame

    def get_history_metadata(self):
        return {"currency": "KRW", "exchangeTimezoneName": "Asia/Seoul"}


yahoo_finance.yf.Ticker = FixtureTicker


@app.get("/catalog")
def catalog(group: str | None = None, search: str | None = None):
    tool = next(t for t in build_tools() if t.name == "list_talib_functions")
    return tool.invoke({"group": group, "search": search})


@app.get("/prices")
def prices(ticker: str = "000660.KS"):
    try:
        rows = yahoo_finance._fetch_historical_prices_uncached(ticker, "1wk", 600, True)
        return {
            "count": len(rows),
            "first": rows[0].to_json_dict(),
            "last": rows[-1].to_json_dict(),
        }
    except yahoo_finance.PriceProviderError as exc:
        raise HTTPException(
            502, {"code": exc.code, "message": exc.safe_message}
        ) from exc
