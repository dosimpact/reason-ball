import { expect, test } from "@playwright/test";

async function signInAsLearner(page: import("@playwright/test").Page) {
  await page.getByLabel("Username or email").fill("learner");
  await page.locator("#password").fill("learner");
  await page.getByRole("button", { name: "Sign In" }).click();
}

test("renders the three-panel protocol explorer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Protocol Explorer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "실습 시나리오" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Architecture" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "HTTP Inspector" })).toBeVisible();
  await expect(page.getByText("Browser", { exact: true })).toBeVisible();
  await expect(page.getByText("Next.js BFF", { exact: true })).toBeVisible();
  await expect(page.getByText("Keycloak", { exact: true })).toBeVisible();
  await expect(page.getByText("Resource Server", { exact: true })).toBeVisible();
});

test("runs a full Keycloak login and protected API lab", async ({ page }) => {
  test.skip(!process.env.FULL_E2E, "Docker-backed full E2E is opt-in");

  await page.goto("/");
  await page.getByRole("link", { name: "OIDC 로그인 시작" }).click();
  await signInAsLearner(page);

  await expect(page.getByText("learner", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "사용자 API 호출" }).click();
  await expect(page.getByText("200 OK", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "관리자 API 호출" }).click();
  await expect(page.getByText("403 Forbidden", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Token 갱신" }).click();
  await expect(page.getByText("200 Token refreshed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page.getByText("Anonymous", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "OIDC 로그인 시작" }).click();
  await expect(page.getByText("learner", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "로그아웃" }).click();
  const confirmLogout = page.getByRole("button", { name: /logout/i });
  await expect(confirmLogout).toBeVisible();
  await confirmLogout.click();
  await expect(page.getByText("Anonymous", { exact: true })).toBeVisible();
});

test("shows Keycloak rejecting a deliberately wrong PKCE verifier", async ({ page }) => {
  test.skip(!process.env.FULL_E2E, "Docker-backed full E2E is opt-in");

  await page.goto("/");
  await page.getByRole("link", { name: "잘못된 PKCE 실습" }).click();
  await signInAsLearner(page);
  await expect(page.getByText(/예상대로 token 교환이 거부되었습니다/)).toBeVisible();

  const response = await page.request.get("http://localhost:3000/api/traces");
  const body = (await response.json()) as { traces: Array<{ method: string; url: string; response: { status: number } }> };
  const exchange = body.traces.find((trace) => trace.method === "POST" && trace.url.endsWith("/token"));
  expect(exchange?.response.status).toBe(400);
  expect(JSON.stringify(body)).not.toContain("access_token\":\"ey");
});

test("rejects a modified state before calling the token endpoint", async ({ page }) => {
  test.skip(!process.env.FULL_E2E, "Docker-backed full E2E is opt-in");

  await page.goto("/");
  await page.getByRole("link", { name: "OIDC 로그인 시작" }).click();
  await page.goto("http://localhost:3000/api/auth/callback?code=fake-code&state=tampered-state");
  await expect(page.getByText("실습 오류: callback_validation_failed", { exact: true })).toBeVisible();

  const response = await page.request.get("http://localhost:3000/api/traces");
  const body = (await response.json()) as { traces: Array<{ method: string; url: string }> };
  expect(body.traces.some((trace) => trace.method === "POST" && trace.url.endsWith("/token"))).toBe(false);
});
