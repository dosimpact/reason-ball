import { expect, test } from "@playwright/test";

test("production rejects playground page and every generation API before provider calls", async ({ request }) => {
  const page = await request.get("/admin/playground");
  expect(page.status()).toBe(404);
  for (const operation of ["chat", "image", "speech"]) {
    const response = await request.post(`/api/admin/playground/${operation}`, {
      data: {},
      headers: { Origin: "https://untrusted.example" },
    });
    expect(response.status(), operation).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
});
