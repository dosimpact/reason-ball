import { test, expect } from "@playwright/test";

test("primary pages have independent URLs, reload and history navigation", async ({
  page,
}) => {
  await page.goto("/");
  for (const [name, path] of [
    ["템플릿 관리", "/templates"],
    ["AI 작업 안내", "/ai-workflow"],
    ["작업 공간", "/"],
  ]) {
    const link = page.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", path);
    await link.click();
    await expect(page).toHaveURL(new URL(path, process.env.BASE_URL!).href);
    await expect(link).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(link).toHaveAttribute("aria-current", "page");
  }
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "AI 작업 안내", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("textbox", { name: "템플릿 제목", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "AI 작업 안내", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Planner 메인 화면" }).click();
  await expect(page).toHaveURL(new URL("/", process.env.BASE_URL!).href);
});

test("project URL supports deep links, reload, history and missing project recovery", async ({
  page,
  request,
}) => {
  const first = await (
    await request.post("/api/projects", { data: { title: "URL project A" } })
  ).json();
  const second = await (
    await request.post("/api/projects", { data: { title: "URL project B" } })
  ).json();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: first.title, exact: true }).click();
    await expect(page).toHaveURL(
      new URL(`/projects/${first.id}`, process.env.BASE_URL!).href,
    );
    await expect(
      page.getByRole("heading", { name: "design index", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: first.title, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: second.title, exact: true }).click();
    await expect(page).toHaveURL(
      new URL(`/projects/${second.id}`, process.env.BASE_URL!).href,
    );
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: first.title, exact: true }),
    ).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("heading", { name: second.title, exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "템플릿 관리", exact: true }).click();
    await page.getByRole("link", { name: "작업 공간", exact: true }).click();
    await expect(page).toHaveURL(
      new URL(`/projects/${second.id}`, process.env.BASE_URL!).href,
    );
    await page.goto(`/projects/${first.id}`);
    await expect(
      page.getByRole("heading", { name: first.title, exact: true }),
    ).toBeVisible();
    await request.delete(`/api/projects/${first.id}`, { data: {} });
    await expect(page).toHaveURL(new URL("/", process.env.BASE_URL!).href);
    await page.goto("/projects/not-a-project");
    await expect(page).toHaveURL(new URL("/", process.env.BASE_URL!).href);
  } finally {
    await request.delete(`/api/projects/${first.id}`, { data: {} });
    await request.delete(`/api/projects/${second.id}`, { data: {} });
  }
});
