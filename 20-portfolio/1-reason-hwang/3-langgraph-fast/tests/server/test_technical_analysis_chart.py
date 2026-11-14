from fastapi.testclient import TestClient

from graph.shared.cache import CachedPriceData
from graph.subgraph.price_agent.tools.yahoo_finance import PriceProviderError
from server.technical_analysis.app import app
from tests.technical_analysis_fixtures import make_prices


def test_chart_uses_one_snapshot_and_excludes_partial(monkeypatch):
    from server.technical_analysis import router

    calls = []

    def fetch(*args):
        calls.append(args)
        return CachedPriceData(
            prices=make_prices(args[2]), cache_hit=True, cache_key="test"
        )

    monkeypatch.setattr(router, "fetch_historical_prices", fetch)
    with TestClient(app) as client:
        response = client.get(
            "/technical-analysis/chart",
            params={
                "ticker": "TEST",
                "count": 20,
                "indicators": "SMA",
                "sma_period": 60,
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert len(calls) == 1
    assert calls[0] == ("TEST", "1d", 321, True)
    assert len(data["bars"]) == 20
    assert data["parameters"] == {"sma_period": 60}
    assert data["indicators"] == ["SMA"]
    assert "rsi" not in data["bars"][-1]
    assert data["cache_hit"] is True
    assert response.headers["cache-control"] == "no-store"


def test_short_history_keeps_null_and_reports_warning(monkeypatch):
    from server.technical_analysis import router

    monkeypatch.setattr(
        router,
        "fetch_historical_prices",
        lambda *args: CachedPriceData(
            prices=make_prices(5), cache_hit=False, cache_key="short"
        ),
    )
    data = TestClient(app).get("/technical-analysis/chart?ticker=TEST").json()
    assert len(data["bars"]) == 5
    assert data["warnings"]
    assert all(bar["rsi"] is None for bar in data["bars"])


def test_provider_error_never_returns_stale_snapshot(monkeypatch):
    from server.technical_analysis import router

    def fail(*args):
        raise PriceProviderError("provider_timeout", "Provider timed out")

    monkeypatch.setattr(router, "fetch_historical_prices", fail)
    response = TestClient(app).get("/technical-analysis/chart?ticker=TEST")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "provider_timeout"
    assert "bars" not in response.json()
