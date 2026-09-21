import type { Page } from "@playwright/test";
export async function sourceEditor(page: Page, label: string) {
  await page
    .getByRole("region", { name: `${label} 편집기`, exact: true })
    .getByRole("button", { name: "Markdown", exact: true })
    .click();
  return page.getByRole("textbox", { name: label, exact: true });
}
