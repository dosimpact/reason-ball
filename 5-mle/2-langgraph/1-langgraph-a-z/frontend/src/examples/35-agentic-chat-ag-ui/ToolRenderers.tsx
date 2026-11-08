import { z } from "zod";
import { getWeatherParameters, normalizeWeatherResult } from "./model";

export function GetWeatherRenderer({ parameters, result, status }: { parameters: Partial<z.infer<typeof getWeatherParameters>>; result: unknown; status: string }) {
  if (status !== "complete") {
    return <div data-testid="weather-info-loading">Loading weather...</div>;
  }

  const parsed = normalizeWeatherResult(result);

  return (
    <div className="agentic-weather-card" data-testid="weather-info">
      <strong>Weather in {parsed.city ?? parameters.location}</strong>
      <div>Temperature: {parsed.temperature ?? "n/a"}&deg;C</div>
      <div>Humidity: {parsed.humidity ?? "n/a"}%</div>
      <div>Wind Speed: {parsed.windSpeed ?? parsed.wind_speed ?? "n/a"} mph</div>
      <div>Conditions: {parsed.conditions ?? "n/a"}</div>
    </div>
  );
}
