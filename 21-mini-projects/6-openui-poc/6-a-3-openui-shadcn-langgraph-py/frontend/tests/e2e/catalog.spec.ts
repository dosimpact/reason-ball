import { expect as baseExpect, test } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 10_000 });

import { readFileSync } from "node:fs";
import path from "node:path";

test.describe("deterministic component catalog (no model)", () => {
  test.setTimeout(600_000);
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/chat", route => route.abort("blockedbyclient"));
    await page.goto("/component-gallery");
    await expect(page.getByRole("heading", { name: "Component gallery", exact: true })).toBeVisible();
  });

  test("every registered definition is covered by a rendered fixture", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const spec = JSON.parse(readFileSync(path.resolve("src/generated/spec.json"), "utf8"));
    const previews = page.locator("article[data-components]");
    await expect(previews.first().getByTestId("preview")).not.toBeEmpty();
    const covered = await previews.evaluateAll(nodes => nodes.flatMap(node => (node.getAttribute("data-components") ?? "").split(",")));
    expect(Object.keys(spec.components).filter(name => !covered.includes(name)), "registered definitions missing fixture coverage").toEqual([]);
    expect(covered.filter(name => !Object.hasOwn(spec.components, name)), "fixtures reference unregistered definitions").toEqual([]);
    await expect(page.getByTestId("catalog-errors")).toHaveCount(0);
    for (const article of await previews.all()) {
      console.log(`Rendering ${await article.getAttribute("id")}`);
      await article.getByRole("button", { name: /^Preview / }).click();
      const preview = article.getByTestId("preview");
      await preview.scrollIntoViewIfNeeded();
      await expect(preview.locator(":scope > *")).not.toHaveCount(0);
      if ((await article.getAttribute("data-components"))?.startsWith("Magic")) {
        const scope = preview.locator("[data-magic-scope]");
        await expect(scope).toBeVisible();
        await expect(scope.locator(":scope > span[role=status]")).toHaveCount(0);
      }
      await expect(preview.locator('[data-magic-error]')).toHaveCount(0);
      await expect(preview.getByText("Loading Magic UI…", { exact: true })).toHaveCount(0);
      await expect(article.getByTestId("catalog-errors")).toHaveCount(0);
      const id = await article.getAttribute("id");
      if (id === "table" || id === "magicui-marquee") await article.screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    expect(errors).toEqual([]);
    await previews.first().getByText("OpenUI source", { exact: true }).click();
    await expect(previews.first().locator("pre").first()).toContainText("root = Card");
  });

  test("filters by component, library and category", async ({ page }) => {
    await page.getByRole("textbox", { name: "Search components" }).fill("DialogBlock");
    await expect(page.getByTestId("fixture-dialog")).toBeVisible();
    await expect(page.getByTestId("fixture-table")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Library", exact: true }).selectOption("magicui");
    await expect(page.getByTestId("fixture-dialog")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Search components" }).fill("");
    await page.getByRole("combobox", { name: "Library", exact: true }).selectOption("shadcn");
    await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("Tables");
    await expect(page.getByTestId("fixture-table")).toBeVisible();
    await expect(page.getByTestId("fixture-dialog")).toHaveCount(0);
  });

  test("keyboard tabs, accordion, form state and local actions", async ({ page }) => {
    const tabs = page.getByTestId("fixture-tabs");
    await tabs.getByRole("button", { name: /^Preview / }).click();
    await tabs.getByRole("tab", { name: "Overview", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "Details", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tabs.getByText("Details panel", { exact: true })).toBeVisible();
    const accordion = page.getByTestId("fixture-accordion");
    await accordion.getByRole("button", { name: /^Preview / }).click();
    await accordion.getByRole("button", { name: "Expand sample" }).click();
    await expect(accordion.getByText("Expanded content", { exact: true })).toBeVisible();
    const form = page.getByTestId("fixture-form");
    await form.getByRole("button", { name: /^Preview / }).click();
    await form.getByPlaceholder("you@example.com").fill("sample@example.com");
    await form.getByPlaceholder("Your message").click();
    await expect(form.getByTestId("form-state")).toContainText("sample@example.com");
    await form.getByRole("checkbox", { name: "Design" }).click();
    await expect(form.getByRole("checkbox", { name: "Design" })).toBeChecked();
    await form.getByRole("button", { name: "Submit sample" }).click();
    await expect(form.getByLabel("Last local action")).toBeVisible();
  });

  test("dialog keyboard dismissal and confirmation stay local", async ({ page }) => {
    await page.getByTestId("fixture-dialog").getByRole("button", { name: /^Preview / }).click();
    const opener = page.getByRole("button", { name: "Open sample dialog", exact: true });
    await opener.click();
    await expect(page.getByRole("dialog", { name: "Sample dialog", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Sample dialog", exact: true }).getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Sample dialog", exact: true })).toHaveCount(0);
    await expect(opener).toBeFocused();
    await page.getByTestId("fixture-alertdialog").getByRole("button", { name: /^Preview / }).click();
    await page.getByRole("button", { name: "Confirm sample", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByTestId("fixture-alertdialog").getByLabel("Last local action")).toBeVisible();
  });
});

test("custom mixed program renders at desktop and mobile widths", async ({ page }, testInfo) => {
  await page.goto("/component-gallery");
  await page.getByRole("textbox", { name: "Search components" }).fill("__custom_only__");
  await page.getByRole("textbox", { name: "OpenUI source to render" }).fill('root = Card([Heading("Mixed catalog preview", "h2"), MagicAuroraText("Magic sample"), TextContent("shadcn and Magic UI share the OpenUI renderer")])');
  await page.getByRole("button", { name: "Render program", exact: true }).click();
  const preview = page.getByTestId("fixture-custom");
  await expect(preview.getByRole("heading", { name: "Mixed catalog preview", exact: true })).toBeVisible();
  await expect(preview.locator("[data-magic-scope]")).toBeVisible();
  await expect(preview.getByText("Loading Magic UI…", { exact: true })).toHaveCount(0);
  await expect(preview.getByTestId("catalog-errors")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("mixed-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await preview.scrollIntoViewIfNeeded();
  await expect(preview.getByRole("heading", { name: "Mixed catalog preview", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mixed-mobile.png"), fullPage: true });
});
