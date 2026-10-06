import { isPlainObject, isString } from "remeda";
import { z } from "zod";

export type WeatherResult = {
  city?: string;
  temperature?: number | string;
  humidity?: number | string;
  windSpeed?: number | string;
  wind_speed?: number | string;
  conditions?: string;
};

export function normalizeWeatherResult(result: unknown): WeatherResult {
  if (isString(result)) {
    try {
      const parsed: unknown = JSON.parse(result);
      return normalizeWeatherResult(parsed);
    } catch {
      return {};
    }
  }

  if (isPlainObject(result)) {
    return result as WeatherResult;
  }

  return {};
}

export const getWeatherParameters = z.object({
  location: z.string(),
});
