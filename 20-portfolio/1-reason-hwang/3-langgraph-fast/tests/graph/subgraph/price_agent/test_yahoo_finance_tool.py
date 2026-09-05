from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from graph.subgraph.price_agent.tools import yahoo_finance

FIXED_EXCHANGE_NOW = datetime(
    2026,
    8,
    28,
    12,
    tzinfo=ZoneInfo("America/New_York"),
)


class FakeTicker:
    history_calls = 0

    def __init__(self, symbol: str) -> None:
        self.symbol = symbol
        now = FIXED_EXCHANGE_NOW
        dates = pd.date_range(end=now.date(), periods=12, freq="B", tz=now.tzinfo)
        self.frame = pd.DataFrame(
            {
                "Open": [10.0 + index for index in range(12)],
                "High": [11.0 + index for index in range(12)],
                "Low": [9.0 + index for index in range(12)],
                "Close": [10.5 + index for index in range(12)],
                "Adj Close": [100.5 + index for index in range(12)],
                "Volume": [1000 + index for index in range(12)],
            },
            index=dates,
        )
        self.metadata = {
            "currency": "USD",
            "fullExchangeName": "NYSE",
            "exchangeTimezoneName": "America/New_York",
            "currentTradingPeriod": {
                "regular": {
                    "start": now - timedelta(hours=1),
                    "end": now + timedelta(hours=1),
                }
            },
        }

    def history(self, **kwargs):
        FakeTicker.history_calls += 1
        assert kwargs["interval"] == "1d"
        assert kwargs["auto_adjust"] is False
        return self.frame

    def get_history_metadata(self):
        return self.metadata


def test_yahoo_adapter_returns_latest_ten_close_bars(monkeypatch) -> None:
    monkeypatch.setattr(yahoo_finance.yf, "Ticker", FakeTicker)
    is_partial_bar = yahoo_finance._is_partial_bar
    monkeypatch.setattr(
        yahoo_finance,
        "_is_partial_bar",
        lambda trading_date, metadata: is_partial_bar(
            trading_date,
            metadata,
            now=FIXED_EXCHANGE_NOW,
        ),
    )

    prices = yahoo_finance._fetch_historical_prices_uncached("cpng", "1d", 10, False)

    assert len(prices) == 10
    assert prices == tuple(sorted(prices, key=lambda item: item.trading_date))
    assert prices[-1].symbol == "CPNG"
    assert prices[-1].close != prices[-1].adjusted_close
    assert prices[-1].is_partial is True


def test_tool_returns_typed_artifact_and_cache_hit(monkeypatch) -> None:
    FakeTicker.history_calls = 0
    monkeypatch.setattr(yahoo_finance.yf, "Ticker", FakeTicker)
    yahoo_finance.clear_price_cache()

    first_content, first_artifact = yahoo_finance._get_historical_prices("CPNG", "1d", 10)
    second_content, second_artifact = yahoo_finance._get_historical_prices("CPNG", "1d", 10)

    assert '"symbol": "CPNG"' in first_content
    assert len(first_artifact.prices) == 10
    assert first_artifact.cache_hit is False
    assert second_artifact.cache_hit is True
    assert second_content
    assert FakeTicker.history_calls == 1


def test_invalid_symbol_returns_structured_error() -> None:
    content, artifact = yahoo_finance._get_historical_prices("UNKNOWN", "1d", 10)

    assert artifact.error_code == "invalid_request"
    assert artifact.prices == ()
    assert "invalid_request" in content


def test_timeout_returns_structured_provider_error(monkeypatch) -> None:
    class TimeoutTicker:
        def __init__(self, symbol: str) -> None:
            self.symbol = symbol

        def history(self, **kwargs):
            raise TimeoutError("request timed out")

    monkeypatch.setattr(yahoo_finance.yf, "Ticker", TimeoutTicker)
    yahoo_finance.clear_price_cache()

    content, artifact = yahoo_finance._get_historical_prices("CPNG", "1d", 10)

    assert artifact.error_code == "provider_timeout"
    assert artifact.prices == ()
    assert "provider_timeout" in content


def test_rate_limit_returns_structured_provider_error(monkeypatch) -> None:
    class RateLimitedTicker:
        def __init__(self, symbol: str) -> None:
            self.symbol = symbol

        def history(self, **kwargs):
            raise RuntimeError("Too Many Requests")

    monkeypatch.setattr(yahoo_finance.yf, "Ticker", RateLimitedTicker)
    yahoo_finance.clear_price_cache()

    content, artifact = yahoo_finance._get_historical_prices("CPNG", "1d", 10)

    assert artifact.error_code == "provider_rate_limited"
    assert artifact.prices == ()
    assert "provider_rate_limited" in content


def test_invalid_provider_schema_returns_structured_error(monkeypatch) -> None:
    class InvalidSchemaTicker(FakeTicker):
        def __init__(self, symbol: str) -> None:
            super().__init__(symbol)
            self.frame.loc[self.frame.index[-1], "High"] = 1.0
            self.frame.loc[self.frame.index[-1], "Low"] = 2.0

    monkeypatch.setattr(yahoo_finance.yf, "Ticker", InvalidSchemaTicker)
    yahoo_finance.clear_price_cache()

    content, artifact = yahoo_finance._get_historical_prices("CPNG", "1d", 10)

    assert artifact.error_code == "invalid_provider_data"
    assert artifact.prices == ()
    assert "invalid_provider_data" in content
