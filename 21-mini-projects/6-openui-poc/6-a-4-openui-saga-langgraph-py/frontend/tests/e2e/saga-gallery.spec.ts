import { test, expect } from "@playwright/test";
import sourceManifest from "../../src/lib/saga-genui/manifest.json";
const manifest = [...sourceManifest, { name: "SagaForm", status: "supported" }];

test("SAGA-002: every supported catalog example renders offline in both themes", async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors: string[] = [];
  const modelRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.url().includes("/api/chat")) modelRequests.push(request.url()); });
  await page.goto("/gallery");
  await expect(page.getByRole("heading", { name: "Saga component gallery" })).toBeVisible();
  const examples = page.locator('article[data-status="supported"]');
  expect(await examples.count()).toBe(manifest.filter(entry => entry.status === "supported").length);
  for (const entry of manifest) await expect(page.getByTestId(`gallery-${entry.name}`)).toHaveAttribute("data-status", entry.status);
  for (const theme of ["light", "dark"]) {
    for (const entry of manifest.filter(entry => entry.status === "supported")) {
      await page.goto(`/gallery?component=${encodeURIComponent(entry.name)}`);
      const themeButton = page.getByRole("button", { name: "Toggle gallery theme" });
      if ((await themeButton.innerText()).toLowerCase().startsWith(theme)) await themeButton.click();
      const example = page.getByTestId(`gallery-${entry.name}`);
      const preview = example.getByTestId("openui-preview");
      await expect(preview).toBeVisible();
      await expect.poll(() => preview.getByTestId("saga-page").evaluate(element => element.childElementCount)).toBeGreaterThan(0);
      await expect(example.getByTestId("gallery-render-error")).toHaveCount(0);
    }
    await page.screenshot({ path: `output/playwright/saga-gallery-${theme}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
  expect(modelRequests).toEqual([]);
});

test("SAGA-002: gallery search filters by component and exposes exclusions", async ({ page }) => {
  await page.goto("/gallery");
  const search = page.getByRole("searchbox", { name: "Search components" });
  await search.fill("Button");
  await expect(page.getByTestId("gallery-Button")).toBeVisible();
  await expect(page.getByTestId("gallery-Input")).toHaveCount(0);
  await search.fill("zzzz-no-match");
  await expect(page.getByText("No matching components.")).toBeVisible();
  await search.clear();
  expect(await page.locator('article[data-status="excluded"]').count()).toBeGreaterThan(0);
});

test("SAGA-002: saved OpenUI programs support local controls and actions", async ({ page }) => {
  await page.goto("/gallery?component=Input");
  const input = page.getByTestId("gallery-Input").getByRole("textbox");
  await input.fill("Edited without a model");
  await expect(input).toHaveValue("Edited without a model");
  await page.goto("/gallery?component=Checkbox");
  const checkbox = page.getByTestId("gallery-Checkbox").getByRole("checkbox");
  await page.getByTestId("gallery-Checkbox").getByText("Enable feature", { exact: true }).click();
  await expect(checkbox).toBeChecked();
  await page.getByTestId("gallery-Checkbox").getByText("Enable feature", { exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await page.goto("/gallery?component=Combobox");
  const combo = page.getByTestId("gallery-Combobox").getByRole("combobox");
  await combo.click();
  await page.getByRole("option", { name: "Beta", exact: true }).click();
  await expect(combo).toHaveValue("Beta");
  await page.goto("/gallery?component=Button");
  const button = page.getByTestId("gallery-Button");
  await button.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(button.getByLabel("Last gallery action")).toContainText("Continue");
  await page.goto("/gallery?component=Modal");
  await page.getByTestId("gallery-Modal").getByRole("button", { name: "Sample details", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
