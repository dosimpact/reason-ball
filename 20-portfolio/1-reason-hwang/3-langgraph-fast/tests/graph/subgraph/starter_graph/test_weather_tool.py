from graph.subgraph.starter_graph.tools.weather import fetch_weather_summary


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self.payload


class FakeClient:
    def __init__(self, timeout: int):
        self.timeout = timeout
        self.calls = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None

    def get(self, url, params):
        self.calls += 1
        if self.calls == 1:
            return FakeResponse(
                {
                    "results": [
                        {
                            "name": "Seoul",
                            "country": "South Korea",
                            "latitude": 37.566,
                            "longitude": 126.978,
                        }
                    ]
                }
            )
        return FakeResponse(
            {
                "current": {
                    "temperature_2m": 24.1,
                    "relative_humidity_2m": 60,
                    "wind_speed_10m": 8.2,
                    "weather_code": 2,
                },
                "current_units": {
                    "temperature_2m": "C",
                    "relative_humidity_2m": "%",
                    "wind_speed_10m": "km/h",
                },
            }
        )


class EmptyGeocodingClient(FakeClient):
    def get(self, url, params):
        return FakeResponse({"results": []})


def test_fetch_weather_summary_returns_current_weather(monkeypatch) -> None:
    monkeypatch.setattr("graph.subgraph.starter_graph.tools.weather.httpx.Client", FakeClient)

    summary = fetch_weather_summary("Seoul")

    assert "Current weather in Seoul, South Korea" in summary
    assert "partly cloudy" in summary
    assert "24.1 C" in summary


def test_fetch_weather_summary_handles_missing_location(monkeypatch) -> None:
    monkeypatch.setattr("graph.subgraph.starter_graph.tools.weather.httpx.Client", EmptyGeocodingClient)

    summary = fetch_weather_summary("Missing Place")

    assert "Could not find weather coordinates" in summary
