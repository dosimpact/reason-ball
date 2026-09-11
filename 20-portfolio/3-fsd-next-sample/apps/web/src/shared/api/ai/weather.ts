import { request as httpsRequest } from "node:https";
import { z } from "zod";

const placeSchema = z.object({ name: z.string().min(1), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), country: z.string().optional() });
const geocodingSchema = z.object({ results: z.array(placeSchema).optional() });
const weatherSchema = z.object({ current: z.object({ temperature_2m: z.number().finite(), weather_code: z.number().int(), time: z.string().min(1) }) });
const conditions: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "rime fog",
  51: "light drizzle", 53: "drizzle", 55: "dense drizzle", 56: "freezing drizzle", 57: "dense freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "heavy freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains", 80: "rain showers", 81: "rain showers", 82: "violent rain showers",
  85: "snow showers", 86: "heavy snow showers", 95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
};

type WeatherFetch = (url: URL, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

// This deployment has no IPv6 route. Limit IPv4 selection to the two weather
// requests; retain TLS hostname verification and the shared deadline/abort.
const weatherFetch: WeatherFetch = (url, init) => new Promise((resolve, reject) => {
  const request = httpsRequest(url, { family: 4, signal: init?.signal ?? undefined,
    headers: { Accept: "application/json" } }, response => {
    const chunks: Buffer[] = [];
    let size = 0;
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 512 * 1024) {
        response.destroy(new Error("날씨 응답 크기 제한을 초과했어요."));
        return;
      }
      chunks.push(chunk);
    });
    response.on("error", reject);
    response.on("end", () => {
      const status = response.statusCode ?? 502;
      resolve({ status, ok: status >= 200 && status < 300,
        json: async () => JSON.parse(Buffer.concat(chunks).toString("utf8")) });
    });
  });
  request.on("error", reject);
  request.end();
});

// Open-Meteo current conditions are model-derived, not a direct station reading.
// Fixed endpoints and validated coordinates prevent caller-controlled fetch URLs.
export async function getCurrentWeather(location: string, signal?: AbortSignal, fetcher: WeatherFetch = weatherFetch) {
  const name = z.string().trim().min(2).max(80).parse(location);
  const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
  async function request(url: URL) {
    const response = await fetcher(url, { signal: bounded, cache: "no-store", redirect: "error" });
    if (response.status === 429) throw new Error("날씨 서비스 요청이 많아요. 잠시 후 다시 시도해 주세요.");
    if (!response.ok) throw new Error("날씨 서비스에 연결하지 못했어요. 다시 시도해 주세요.");
    return response.json();
  }
  try {
    const geocoding = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocoding.search = new URLSearchParams({ name, count: "1", language: "en", format: "json" }).toString();
    const place = geocodingSchema.parse(await request(geocoding)).results?.[0];
    if (!place) throw new Error("해당 도시를 찾지 못했어요. 도시 이름을 확인해 주세요.");
    const forecast = new URL("https://api.open-meteo.com/v1/forecast");
    forecast.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: "temperature_2m,weather_code", timezone: "UTC", temperature_unit: "celsius" }).toString();
    const { current } = weatherSchema.parse(await request(forecast));
    const condition = conditions[current.weather_code];
    if (!condition) throw new Error("날씨 서비스가 지원하지 않는 상태 코드를 반환했어요.");
    return { location: [place.name, place.country].filter(Boolean).join(", "), temperature: current.temperature_2m,
      condition, source: "Open-Meteo", observedAt: `${current.time}Z`, latitude: place.latitude, longitude: place.longitude };
  } catch (error) {
    if (bounded.aborted) throw new Error("날씨 조회를 취소했거나 제한 시간을 초과했어요.");
    if (error instanceof z.ZodError) throw new Error("날씨 서비스의 응답을 확인하지 못했어요.");
    throw error;
  }
}
