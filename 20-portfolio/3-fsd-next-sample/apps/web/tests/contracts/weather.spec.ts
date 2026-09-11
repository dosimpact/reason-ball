import { expect, test } from "@playwright/test";
import { getCurrentWeather } from "../../src/shared/api/ai/weather";

test("weather resolves fixed endpoints and returns provider values, never invented temperatures", async () => {
  const calls: URL[] = [];
  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input)); calls.push(url);
    expect(init?.signal).toBeTruthy(); expect(init?.redirect).toBe("error");
    return Response.json(calls.length === 1 ? { results: [{ name: "Seoul", latitude: 37.5, longitude: 127, country: "South Korea" }] }
      : { current: { temperature_2m: 18.25, weather_code: 61, time: "2026-09-11T06:00" } });
  }) as typeof fetch;
  const result = await getCurrentWeather("Seoul", undefined, fetcher);
  expect(result).toMatchObject({ temperature: 18.25, condition: "light rain", source: "Open-Meteo", observedAt: "2026-09-11T06:00Z" });
  expect(calls.map(url => url.hostname)).toEqual(["geocoding-api.open-meteo.com", "api.open-meteo.com"]);
  expect(calls[1].searchParams.get("latitude")).toBe("37.5");
});

test("weather errors never become fake successful readings", async () => {
  for (const [body, status, message] of [[{}, 200, "도시를 찾지"], [{}, 429, "요청이 많아요"], [{}, 503, "연결하지"], [{ results: [{ name: "Bad", latitude: 999, longitude: 0 }] }, 200, "응답을 확인"]] as const) {
    await expect(getCurrentWeather("Seoul", undefined, (async () => Response.json(body, { status })) as typeof fetch)).rejects.toThrow(message);
  }
  const controller = new AbortController(); controller.abort();
  await expect(getCurrentWeather("Seoul", controller.signal, (async (_input, init) => { init?.signal?.throwIfAborted(); return Response.json({}); }) as typeof fetch)).rejects.toThrow("취소");
});

test("native weather transport honors cancellation before making a request", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(getCurrentWeather("Seoul", controller.signal)).rejects.toThrow("취소");
});
