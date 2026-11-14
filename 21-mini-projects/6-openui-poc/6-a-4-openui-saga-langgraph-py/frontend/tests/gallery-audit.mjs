/** Exhaustive offline browser audit. No Python server or model API is used. */
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile(new URL("../src/lib/saga-genui/manifest.json", import.meta.url), "utf8"));
manifest.push({ name: "SagaForm", status: "supported" });
const base = process.env.CHAT_TEST_URL || "http://127.0.0.1:3048";
const out = new URL("../output/gallery-audit/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
try {
  for (const theme of (process.env.AUDIT_THEME ? [process.env.AUDIT_THEME] : ["light", "dark"])) {
    const context = await browser.newContext();
    await context.addInitScript(mode => { try { if (!localStorage.getItem("openui-saga:theme")) localStorage.setItem("openui-saga:theme", mode); } catch {} }, theme);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    let messages = [];
    let requests = [];
    page.on("console", message => { if (message.type() === "error") messages.push(message.text()); });
    page.on("pageerror", error => messages.push(error.message));
    page.on("request", request => { if (request.url().includes("/api/chat")) requests.push(request.url()); });
    for (const entry of manifest.filter(item => item.status === "supported" && (!process.env.AUDIT_NAMES || process.env.AUDIT_NAMES.split(",").includes(item.name)) && (theme !== "light" || !process.env.AUDIT_RECHECK_NAMES || process.env.AUDIT_RECHECK_NAMES.split(",").includes(item.name)))) {
      messages = []; requests = [];
      const result = { name: entry.name, theme, errors: [], console: [], modelRequests: [] };
      try {
        await page.goto(`${base}/gallery?component=${encodeURIComponent(entry.name)}`, { timeout: 30_000 });
        const card = page.getByTestId(`gallery-${entry.name}`);
        const preview = card.getByTestId("openui-preview");
        await preview.waitFor({ state: "attached", timeout: 30_000 });
        await card.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
          const preview = document.querySelector('[data-testid="openui-preview"]');
          return preview && (preview.querySelector('[data-testid="saga-page"]')?.childElementCount > 0 || preview.querySelector('[data-testid="gallery-render-error"]'));
        }, undefined, { timeout: 3_000 }).catch(() => {});
        // Give effects, lazy children and error boundaries time to commit.
        await page.waitForTimeout(600);
        result.errors = await card.getByTestId("gallery-render-error").allTextContents();
        result.html = await preview.innerHTML();
        const content = preview.getByTestId("saga-page");
        result.children = await content.evaluate(element => element.childElementCount).catch(() => 0);
        result.visible = await preview.isVisible();
        if (entry.name === "Sparkline") {
          result.canvas = await preview.locator("canvas").evaluateAll(canvases => canvases.map(canvas => ({ width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height })));
          if (!result.canvas.some(canvas => canvas.width > 0 && canvas.height > 0)) result.errors.push("Sparkline has no visible canvas");
        }
        if (!result.children) result.errors.push("SagaPage has no rendered component children");
        if (!result.visible) result.errors.push("Preview is not visible");
        if (result.errors.length) await card.screenshot({ path: new URL(`${theme}-${entry.name}.png`, out).pathname }).catch(() => {});
      } catch (error) { result.errors.push(error.message); }
      result.console = [...new Set(messages)]; result.modelRequests = [...requests];
      results.push(result);
      console.log(`${result.errors.length || result.console.length ? "CHECK" : "PASS"} ${theme} ${entry.name}: ${result.errors.join("; ").slice(0, 200)}`);
      await writeFile(new URL(`${process.env.AUDIT_NAMES ? "recheck" : "results"}-${process.env.AUDIT_THEME || "all"}.json`, out), JSON.stringify(results, null, 2));
    }
    if (process.env.AUDIT_CONTROLS === "1") {
      await page.goto(`${base}/gallery?component=Input`);
      const input = page.getByTestId("gallery-Input").getByRole("textbox");
      await input.fill("Edited without a model"); await expect(input).toHaveValue("Edited without a model");
      await page.goto(`${base}/gallery?component=Checkbox`);
      const checkbox = page.getByTestId("gallery-Checkbox").getByRole("checkbox");
      await page.getByTestId("gallery-Checkbox").getByText("Enable feature", { exact: true }).click(); await expect(checkbox).toBeChecked(); await page.getByTestId("gallery-Checkbox").getByText("Enable feature", { exact: true }).click();
      await expect(checkbox).not.toBeChecked();
      await page.goto(`${base}/gallery?component=Combobox`);
      const combo = page.getByTestId("gallery-Combobox").getByRole("combobox");
      await combo.click(); await page.getByRole("option", { name: "Beta", exact: true }).click();
      await expect(combo).toHaveValue("Beta");
      await page.goto(`${base}/gallery?component=Button`);
      const button = page.getByTestId("gallery-Button");
      await button.getByRole("button", { name: "Continue", exact: true }).click();
      await expect(button.getByLabel("Last gallery action")).toContainText("Continue");
      await page.goto(`${base}/gallery?component=Modal`);
      await page.getByTestId("gallery-Modal").getByRole("button", { name: "Sample details", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await writeFile(new URL(`controls-${theme}.json`, out), JSON.stringify({ result: "PASS", checks: ["Input", "Checkbox", "Combobox", "Button action", "Modal"] }));
    }
    if (process.env.AUDIT_SCREENSHOTS === "1") {
      for (const screenshotTheme of (process.env.AUDIT_SCREENSHOT_THEMES || theme).split(",")) {
        await page.goto(`${base}/gallery?component=Table`);
        await expect(page.getByTestId("gallery-Table").getByRole("table")).toBeVisible();
        if (await page.locator("html").getAttribute("data-theme") !== screenshotTheme) await page.getByRole("button", { name: "Toggle gallery theme" }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", screenshotTheme);
        await page.getByTestId("gallery-Table").scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`gallery-${screenshotTheme}.png`, out).pathname });
        await page.goto(`${base}/`);
        await page.getByRole("button", { name: "01 · Service health", exact: true }).click();
        await expect(page.getByRole("cell", { name: "API gateway", exact: true })).toBeVisible();
        await expect(page.getByText("99.98", { exact: true })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", screenshotTheme);
        await page.screenshot({ path: new URL(`chat-${screenshotTheme}.png`, out).pathname });
      }
    }
    await context.close();
  }
} finally { await browser.close(); console.log("Closed gallery audit browser"); }
console.log(JSON.stringify({ total: results.length, failures: results.filter(result => result.errors.length).map(result => `${result.theme}:${result.name}`), console: results.filter(result => result.console.length).map(result => `${result.theme}:${result.name}`) }));
process.exitCode = results.some(result => result.errors.length || result.console.length || result.modelRequests.length) ? 1 : 0;
