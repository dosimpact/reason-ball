import { test, expect as baseExpect, type Page } from "@playwright/test";

const expect = baseExpect.configure({timeout:10_000});

async function preview(page: Page, id: string) {
  const fixture = page.getByTestId(`fixture-shadcn-${id}`);
  await fixture.getByRole("button", { name: /^Preview / }).click();
  await expect(fixture.getByTestId("preview")).toBeVisible();
  return fixture;
}

test.use({ actionTimeout: 10_000 });
test.setTimeout(45_000);
const focusTimeout = { timeout: 10_000 };

test.beforeEach(async ({ page }) => {
  await page.goto("/component-gallery");
  await expect(page.getByRole("heading", { name: "Component gallery" })).toBeVisible();
});

test("DataTable filters, sorts, paginates and hides a column", async ({ page }) => {
  const fixture = await preview(page, "data-table");
  const rows = fixture.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await fixture.getByRole("button", { name: "Go to next page", exact: true }).click();
  await expect(fixture.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(rows.first()).toContainText("Alan");
  await fixture.getByRole("button", { name: "Go to first page", exact: true }).click();
  await fixture.getByRole("button", { name: "Name", exact: true }).click();
  await page.getByRole("menuitem", { name: "Asc", exact: true }).click();
  await expect(rows.first()).toContainText("Ada");
  await expect(rows.nth(1)).toContainText("Alan");
  await fixture.getByPlaceholder("Filter name...").fill("Barbara");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Barbara");
  await fixture.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "score", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(fixture.getByRole("columnheader")).toHaveCount(1);
});

test("Combobox selection updates the named OpenUI field", async ({ page }) => {
  const fixture = await preview(page, "combobox");
  await fixture.getByRole("combobox", { name: "Choose framework" }).click();
  await page.getByRole("option", { name: "Python", exact: true }).click();
  await expect(fixture.getByRole("combobox")).toHaveValue("Python");
  await fixture.getByText("Form state", { exact: true }).click();
  await expect(fixture.getByTestId("form-state")).toContainText('"framework"');
  await expect(fixture.getByTestId("form-state")).toContainText('"Python"');
});

test("Sheet traps focus and restores its trigger on Escape", async ({ page }) => {
  const fixture = await preview(page, "sheet");
  const trigger = fixture.getByRole("button", { name: "Open sheet", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused(focusTimeout);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused(focusTimeout);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused(focusTimeout);
});

test("Menu selection records the conversation action without a model request", async ({ page }) => {
  let requests = 0;
  page.on("request", request => { if (request.url().includes("/api/chat")) requests++; });
  const fixture = await preview(page, "dropdown-menu");
  await fixture.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(fixture.getByLabel("Last local action")).toContainText("Edit");
  await expect(fixture.getByLabel("Last local action")).toContainText("continue_conversation");
  expect(requests).toBe(0);
});
