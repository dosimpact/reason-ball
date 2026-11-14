import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { expect as baseExpect, test, type Page } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 10_000 });

async function preview(page: Page, slug: string, component: string) {
  await page.getByRole("textbox", { name: "Search components" }).fill(component);
  const fixture = page.getByTestId(`fixture-magicui-${slug}`);
  await fixture.getByRole("button", { name: /^Preview / }).click();
  const scope = fixture.locator("[data-magic-scope]");
  await scope.scrollIntoViewIfNeeded();
  await expect(scope).toBeVisible();
  await expect(scope.getByText("Loading Magic UI…", { exact: true })).toHaveCount(0);
  await expect(scope.locator("[data-magic-error]")).toHaveCount(0);
  return fixture;
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/chat", route => route.abort("blockedbyclient"));
  await page.goto("/component-gallery");
  await expect(page.getByRole("heading", { name: "Component gallery", exact: true })).toBeVisible();
});

test("CoolMode particles remain local and are removed on unmount", async ({ page }) => {
  const fixture = await preview(page, "cool-mode", "MagicCoolMode");
  const button = fixture.getByRole("button", { name: "Magic UI", exact: true });
  await expect(button).toBeVisible();
  await button.click();
  const particles = fixture.locator("[data-magic-scope] [data-cool-particles]");
  await expect(particles).toHaveCount(1);
  expect(await page.locator("body > [data-cool-particles]").count()).toBe(0);
  await page.getByRole("textbox", { name: "Search components" }).fill("MagicAuroraText");
  await expect(page.locator("[data-cool-particles]")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.cursor)).toBe("");
});

test("theme animation changes only its generated example", async ({ page }) => {
  const rootTheme = await page.evaluate(() => document.documentElement.className);
  const fixture = await preview(page, "animated-theme-toggler", "MagicAnimatedThemeToggler");
  const toggle = fixture.getByTestId("preview").getByRole("button");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(fixture.locator("[data-magic-scope] .dark")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.className)).toBe(rootTheme);
  await toggle.click();
  await expect(fixture.locator("[data-magic-scope] .dark")).toHaveCount(0);
});

test("smooth cursor does not hide the page cursor and releases local styles", async ({ page }) => {
  const fixture = await preview(page, "smooth-cursor", "MagicSmoothCursor");
  const scope = fixture.locator("[data-magic-scope]");
  await scope.hover();
  expect(await page.evaluate(() => document.body.style.cursor)).toBe("");
  await page.getByRole("textbox", { name: "Search components" }).fill("MagicAuroraText");
  await expect(page.locator('[style*="cursor: none"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.cursor)).toBe("");
});

test("scroll progress tracks its own scroll area without moving the page", async ({ page }) => {
  const fixture = await preview(page, "scroll-progress", "MagicScrollProgress");
  await expect(fixture.getByText("Scroll to see your progress", { exact: true })).toBeVisible();
  const scroll = fixture.locator("[data-magic-scope] .overflow-y-auto");
  const pageScroll = await page.evaluate(() => window.scrollY);
  await scroll.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  await expect.poll(() => fixture.locator(".origin-left").evaluate(element => getComputedStyle(element).transform)).not.toBe("matrix(0, 0, 0, 1, 0, 0)");
});

test("reduced motion preserves supplied text and numeric content without mounting effects", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const text = await preview(page, "aurora-text", "MagicAuroraText");
  await expect(text.locator("[data-magic-static]")).toContainText("Magic UI");
  const ticker = await preview(page, "number-ticker", "MagicNumberTicker");
  await expect(ticker.locator("[data-magic-static]")).toContainText("75");
  await expect(ticker.locator("[data-magic-static] canvas")).toHaveCount(0);
});

async function customProgram(page: Page, source: string) {
  await page.getByRole("textbox", { name: "OpenUI source to render" }).fill(source);
  await page.getByRole("button", { name: "Render program", exact: true }).click();
  const fixture = page.getByTestId("fixture-custom");
  await fixture.getByTestId("preview").scrollIntoViewIfNeeded();
  await expect(fixture.getByTestId("preview")).not.toBeEmpty();
  await expect(fixture.locator("[data-magic-error]")).toHaveCount(0);
  await expect(fixture.getByTestId("catalog-errors")).toHaveCount(0);
  return fixture;
}

test("Magic button actions stay local with their supplied label", async ({ page }) => {
  let requests = 0;
  page.on("request", request => { if (request.url().includes("/api/chat")) requests++; });
  const fixture = await customProgram(page, 'root = Card([MagicRainbowButton({type:"continue_conversation"}, "Explore plan")])');
  await fixture.getByRole("button", { name: "Explore plan", exact: true }).click();
  await expect(fixture.getByLabel("Last local action")).toContainText("Explore plan");
  await expect(fixture.getByLabel("Last local action")).toContainText("continue_conversation");
  expect(requests).toBe(0);
});

test("reduced motion retains structured Bento titles, descriptions and destinations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await customProgram(page, 'root = Card([MagicBentoGrid([{title:"Research workspace",description:"Keep the evidence",href:"https://example.com/research",cta:"Read evidence"}])])');
  await expect(fixture.getByRole("heading", { name: "Research workspace", exact: true })).toBeVisible();
  await expect(fixture.getByText("Keep the evidence", { exact: true })).toBeVisible();
  await expect(fixture.getByRole("link", { name: "Read evidence", exact: true })).toHaveAttribute("href", "https://example.com/research");
  await expect(fixture.locator("[data-magic-static]")).toBeVisible();
});

test("offscreen globe releases its canvas and mounts again when visible", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 350 });
  const fixture = await preview(page, "globe", "MagicGlobe");
  await fixture.locator("[data-magic-scope]").scrollIntoViewIfNeeded();
  await expect(fixture.locator("canvas")).toHaveCount(1);
  await page.getByRole("heading", { name: "Component gallery", exact: true }).scrollIntoViewIfNeeded();
  await expect(fixture.locator("canvas")).toHaveCount(0);
  await fixture.locator("[data-magic-scope]").scrollIntoViewIfNeeded();
  await expect(fixture.locator("canvas")).toHaveCount(1);
});

for (const name of ["expanded-shadcn", "magic", "mixed"]) {
 test(`saved real-model ${name} program renders without another API request`, async ({page},testInfo)=>{
  const file=path.resolve(`output/validation/catalog-${name}.openui`);
  test.skip(!existsSync(file), "Run catalog live-model smoke to produce this optional validation artifact.");
  let requests=0;page.on("request",request=>{if(request.url().includes("/api/chat"))requests++;});
  const fixture=await customProgram(page,readFileSync(file,"utf8"));
  for(const scope of await fixture.locator("[data-magic-scope]").all()){
   await scope.scrollIntoViewIfNeeded();
   await expect(scope.locator(":scope > span[role=status]")).toHaveCount(0);
   await expect(scope.getByText("Loading Magic UI…",{exact:true})).toHaveCount(0);
  }
  await expect(fixture.getByTestId("catalog-errors")).toHaveCount(0);
  await expect(fixture.locator("[data-magic-error]")).toHaveCount(0);
  expect(requests).toBe(0);
  await fixture.screenshot({path:testInfo.outputPath(`generated-${name}.png`)});
 });
}

test("local sample media powers VideoText and HeroVideoDialog without external media fetches", async ({ page }) => {
  const external: string[] = [];
  page.on("request", request => {
    if ((request.resourceType() === "media" || request.resourceType() === "image") && /^https?:/.test(request.url()) && !request.url().startsWith(new URL(page.url()).origin)) external.push(request.url());
  });
  const video = await preview(page, "video-text", "MagicVideoText");
  const media = video.locator("video");
  await expect(media).toBeVisible();
  await expect.poll(() => media.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(0);
  expect(await media.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
  expect(await media.evaluate(element => (element as HTMLVideoElement).duration)).toBeGreaterThan(0);
  const hero = await preview(page, "hero-video-dialog", "MagicHeroVideoDialog");
  await hero.getByRole("button", { name: "Play video", exact: true }).click();
  await expect(hero.locator('iframe[title="Hero Video player"]')).toHaveAttribute("src", "/catalog/sample-video.mp4");
  expect(external).toEqual([]);
});
