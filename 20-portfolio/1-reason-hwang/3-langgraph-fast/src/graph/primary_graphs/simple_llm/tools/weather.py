from __future__ import annotations

from typing import Any

import httpx
from langchain_core.tools import tool

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_LABELS = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "depositing rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    61: "slight rain",
    63: "moderate rain",
    65: "heavy rain",
    71: "slight snow",
    73: "moderate snow",
    75: "heavy snow",
    80: "slight rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    95: "thunderstorm",
}


def _first_result(payload: dict[str, Any]) -> dict[str, Any] | None:
    results = payload.get("results")
    if not isinstance(results, list) or not results:
        return None
    first = results[0]
    return first if isinstance(first, dict) else None


def fetch_weather_summary(location: str) -> str:
    query = location.strip()
    if not query:
        return "Please provide a location for the weather lookup."

    try:
        with httpx.Client(timeout=10) as client:
            geocoding_response = client.get(
                GEOCODING_URL,
                params={"name": query, "count": 1, "language": "en", "format": "json"},
            )
            geocoding_response.raise_for_status()
            place = _first_result(geocoding_response.json())
            if place is None:
                return f"Could not find weather coordinates for '{query}'."

            forecast_response = client.get(
                FORECAST_URL,
                params={
                    "latitude": place["latitude"],
                    "longitude": place["longitude"],
                    "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
                    "timezone": "auto",
                },
            )
            forecast_response.raise_for_status()
            forecast = forecast_response.json()
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        return f"Weather lookup failed for '{query}': {exc}"

    current = forecast.get("current", {})
    units = forecast.get("current_units", {})
    place_name = place.get("name", query)
    country = place.get("country")
    display_name = f"{place_name}, {country}" if country else str(place_name)
    code = current.get("weather_code")
    condition = WEATHER_LABELS.get(code, f"weather code {code}")

    return (
        f"Current weather in {display_name}: {condition}, "
        f"temperature {current.get('temperature_2m')} {units.get('temperature_2m', 'C')}, "
        f"humidity {current.get('relative_humidity_2m')} {units.get('relative_humidity_2m', '%')}, "
        f"wind {current.get('wind_speed_10m')} {units.get('wind_speed_10m', 'km/h')}."
    )


@tool
def get_weather(location: str) -> str:
    """Return current weather information for a city or place name."""

    return fetch_weather_summary(location)
