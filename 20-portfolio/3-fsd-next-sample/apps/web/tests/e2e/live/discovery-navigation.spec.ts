import { randomUUID } from "node:crypto";
import type { Locator, Page } from "@playwright/test";
import type { Character, Mission } from "../../../src/shared/api/learning/contracts";
import { expect, signIn, test } from "./fixtures";

async function catalog<T>(page: Page, kind: "characters" | "missions"): Promise<T[]> {
  const response = await page.request.get(`/api/${kind}`);
  expect(response.ok()).toBe(true);
  const rows = (await response.json()).items as T[];
  expect(rows.length).toBeGreaterThan(0);
  return rows;
}
// Real owned API fixtures give distinct creation times and filter dimensions.
// They do not fabricate popularity counters or claim AI image generation.
async function discoveryCharacters(page: Page) {
  const items: Character[] = [];
  for (const level of ["입문", "중급"] as const) {
    const response = await page.request.post("/api/characters", {
      headers: { Origin: "http://dodonet.iptime.org:13000" },
      data: { name: `Discovery ${randomUUID()}`, role: "Practice partner", tagline: "Discovery fixture",
        description: "Private disposable catalog example", personality: ["다정함"],
        personaGoal: "Practice greetings", learningGoal: "Say hello", speakingStyle: "Brief English",
        relationship: "Practice partner", teachingStyle: "Gentle corrections", prohibitedInstructions: [],
        accent: "American", level, topics: [level === "입문" ? "일상" : "업무"],
        palette: ["#ff8067", "#ffc65c"], emoji: "🌱", visibility: "private", publishStatus: "draft",
        imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=" },
    });
    expect(response.ok(), `Create discovery character: ${response.status()}`).toBe(true);
    items.push((await response.json()).item);
  }
  expect(items[0].createdAt).not.toBe(items[1].createdAt);
  return items;
}
async function discoveryMissions(page: Page, characterId: string) {
  const items: Mission[] = [];
  for (const [difficulty, durationMinutes, location] of [["입문", 7, "Discovery cafe"], ["중급", 10, "Discovery office"]] as const) {
    const response = await page.request.post("/api/missions", {
      headers: { Origin: "http://dodonet.iptime.org:13000" },
      data: { title: `Discovery ${randomUUID()}`, subtitle: "Practice hello", description: "",
        category: "일상", location, difficulty, durationMinutes, recommendedCharacterId: characterId,
        objectives: [{ id: "hello", label: "Say hello", hint: "Hello" }], keyPhrases: [],
        rewardTitle: "Greeting badge", rewardPalette: ["#ff8067", "#ffc65c"], rewardEmoji: "🌱", publishStatus: "draft" },
    });
    expect(response.ok(), `Create discovery mission: ${response.status()}`).toBe(true);
    items.push((await response.json()).item);
  }
  expect(items[0].createdAt).not.toBe(items[1].createdAt);
  return items;
}
async function cardIds(page: Page, kind: "character" | "mission") {
  return page.locator(`[data-testid^="${kind}-card-"]`).evaluateAll((cards, prefix) =>
    cards.map(card => card.getAttribute("data-testid")!.slice(prefix.length)), `${kind}-card-`);
}
async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 60; index++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target, "Control is reachable through the natural Tab order").toBeFocused();
}

test("CHAR-07 DISC-02 desktop sidebar opens character filters, sorting and matching detail", async ({ page }) => {
  const fixtures = await discoveryCharacters(page);
  const characters = await catalog<Character>(page, "characters");
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "데스크톱 사이드바" });
  await expect(sidebar).toBeVisible();
  const charactersLink = sidebar.getByRole("link", { name: "캐릭터", exact: true });
  await tabTo(page, charactersLink);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/characters$/);
  // Popular result matches available counters; distinct popularity is not fabricated.
  for (const [sort, compare] of [
    ["popular", (a: Character, b: Character) => b.learnerCount - a.learnerCount],
    ["new", (a: Character, b: Character) => Date.parse(b.createdAt) - Date.parse(a.createdAt)],
  ] as const) {
    await page.getByRole("combobox", { name: "캐릭터 정렬" }).selectOption(sort);
    await expect.poll(() => cardIds(page, "character")).toEqual([...characters].sort(compare).slice(0, 6).map(row => row.id));
  }
  const chosen = characters.find(row => row.id === fixtures[0].id)!;
  expect(chosen, "Real catalog has a character with an authored topic").toBeTruthy();
  await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill(chosen.name);
  const level = page.getByRole("group", { name: "레벨 필터" }).getByRole("button", { name: chosen.level, exact: true });
  await level.click();
  await expect(level).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("combobox", { name: "관심사 필터" }).selectOption(chosen.topics[0]);
  const card = page.getByTestId(`character-card-${chosen.id}`);
  await expect(card).toBeVisible();
  const shown = await cardIds(page, "character");
  for (const id of shown) {
    const row = characters.find(item => item.id === id)!;
    expect(row.level).toBe(chosen.level);
    expect(row.topics).toContain(chosen.topics[0]);
  }
  await card.getByRole("link", { name: `${chosen.name} 상세 보기` }).click();
  await expect(page).toHaveURL(new RegExp(`/characters/${chosen.id}$`));
  await expect(page.getByRole("heading", { name: chosen.name, exact: true, level: 1 })).toBeVisible();
});

test("DISC-03 mission place, difficulty, duration and character filters lead to the matching detail", async ({ page }) => {
  const characters = await catalog<Character>(page, "characters");
  const fixtures = await discoveryMissions(page, characters[0].id);
  const missions = await catalog<Mission>(page, "missions");
  await page.goto("/missions");
  const chosen = missions.find(row => row.id === fixtures[1].id)!;
  expect(chosen, "Catalog has a short mission with a recommended character").toBeTruthy();
  // Popular result matches available counters; distinct popularity is not fabricated.
  for (const [sort, compare] of [
    ["popular", (a: Mission, b: Mission) => b.learnerCount - a.learnerCount],
    ["new", (a: Mission, b: Mission) => Date.parse(b.createdAt) - Date.parse(a.createdAt)],
  ] as const) {
    await page.getByRole("combobox", { name: "미션 정렬" }).selectOption(sort);
    await expect.poll(() => cardIds(page, "mission")).toEqual([...missions].sort(compare).slice(0, 8).map(row => row.id));
  }
  const location = chosen.location.split("·")[0].trim();
  await page.getByRole("searchbox", { name: "미션 검색" }).fill(chosen.title);
  await page.getByRole("combobox", { name: "장소 필터" }).selectOption(location);
  await page.getByRole("combobox", { name: "난이도 필터" }).selectOption(chosen.difficulty);
  await page.getByRole("combobox", { name: "소요 시간 필터" }).selectOption("10");
  await page.getByRole("combobox", { name: "캐릭터 필터" }).selectOption(chosen.recommendedCharacterId);
  await expect(page.getByTestId(`mission-card-${chosen.id}`)).toBeVisible();
  await page.getByRole("combobox", { name: "소요 시간 필터" }).selectOption("7");
  if (chosen.durationMinutes > 7) await expect(page.getByTestId(`mission-card-${chosen.id}`)).toHaveCount(0);
  else await expect(page.getByTestId(`mission-card-${chosen.id}`)).toBeVisible();
  await page.getByRole("combobox", { name: "소요 시간 필터" }).selectOption("10");
  const different = ["입문", "초급", "중급"].find(value => value !== chosen.difficulty)!;
  await page.getByRole("combobox", { name: "난이도 필터" }).selectOption(different);
  await expect(page.getByText("조건에 맞는 미션이 없어요.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "난이도 필터" }).selectOption(chosen.difficulty);
  await page.getByTestId(`mission-card-${chosen.id}`).getByRole("link", { name: `${chosen.title} 미션 상세 보기` }).click();
  await expect(page.getByRole("heading", { name: chosen.title, exact: true, level: 1 })).toBeVisible();
});

test("DISC-04 REF-03 NFR-01/02 mobile360 keyboard reaches menu, search, filters and character detail", async ({ page }) => {
  const characters = await catalog<Character>(page, "characters");
  const chosen = characters[0];
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("complementary", { name: "데스크톱 사이드바" })).toBeHidden();
  const open = page.getByRole("button", { name: "메뉴 열기", exact: true });
  await tabTo(page, open);
  await page.keyboard.press("Enter");
  const menu = page.getByRole("navigation", { name: "모바일 메뉴", exact: true });
  await expect(menu).toBeVisible();
  await tabTo(page, menu.getByRole("link", { name: "캐릭터", exact: true }));
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  const search = page.getByRole("searchbox", { name: "캐릭터 검색" });
  await tabTo(page, search);
  await page.keyboard.insertText(chosen.name);
  const level = page.getByRole("group", { name: "레벨 필터" }).getByRole("button", { name: chosen.level, exact: true });
  await tabTo(page, level);
  await page.keyboard.press("Enter");
  await expect(level).toHaveAttribute("aria-pressed", "true");
  const link = page.getByTestId(`character-card-${chosen.id}`).getByRole("link", { name: `${chosen.name} 상세 보기` });
  await tabTo(page, link);
  await expect(link).toBeInViewport();
  const bounds = await link.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: chosen.name, exact: true, level: 1 })).toBeVisible();
});

test("NFR-03 character image failure preserves a named fallback and reload decodes the real stored image", async ({ page, request, createAccount }) => {
  const [character] = await discoveryCharacters(page);
  expect(character.imageUrl).toBeTruthy();
  const imagePath = new URL(character.imageUrl!).pathname;
  expect(imagePath).toContain("/storage/v1/object/sign/character-private/");
  const storedImage = await page.request.get(character.imageUrl!);
  expect(storedImage.ok()).toBe(true);
  expect(storedImage.headers()["content-type"]).toContain("image/png");
  expect(await storedImage.body()).toEqual(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHmsAAAAASUVORK5CYII=", "base64"));
  const publicUrl = new URL(character.imageUrl!);
  publicUrl.pathname = imagePath.replace("/object/sign/", "/object/public/");
  publicUrl.search = "";
  expect((await request.get(publicUrl.toString())).ok()).toBe(false);
  await signIn(request, await createAccount());
  const foreign = await request.get(`/api/characters/${character.id}`);
  expect(foreign.status()).toBe(404);
  const foreignCatalog = await request.get("/api/characters");
  expect(foreignCatalog.ok()).toBe(true);
  expect((await foreignCatalog.json()).items.some((item: Character) => item.id === character.id)).toBe(false);
  let failedRequests = 0;
  await page.route(url => url.pathname === imagePath, route => {
    failedRequests++;
    return route.abort("failed");
  });
  await page.goto("/characters");
  await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill(character.name);
  const card = page.getByTestId(`character-card-${character.id}`);
  const avatar = card.getByRole("img", { name: `${character.name} 캐릭터 이미지`, exact: true });
  await expect(avatar).toBeVisible();
  await expect.poll(() => failedRequests).toBeGreaterThan(0);
  await expect(avatar.getByText(character.emoji, { exact: true })).toBeVisible();
  await expect(card.getByRole("link", { name: `${character.name} 상세 보기` })).toBeVisible();
  const failedSize = await avatar.boundingBox();
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
  await page.getByRole("searchbox", { name: "캐릭터 검색" }).fill(character.name);
  const image = avatar.locator("img");
  await expect(image).toHaveAttribute("loading", "lazy");
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(image).toBeVisible();
  const loadedSize = await avatar.boundingBox();
  expect(loadedSize!.width).toBe(failedSize!.width);
  expect(loadedSize!.height).toBe(failedSize!.height);
  await card.getByRole("link", { name: `${character.name} 상세 보기` }).click();
  await expect(page.getByRole("heading", { name: character.name, level: 1, exact: true })).toBeVisible();
});

test("DISC-04 mobile360 keyboard filters missions, recovers from empty results and opens the matching detail", async ({ page }) => {
  const characters = await catalog<Character>(page, "characters");
  const [chosen] = await discoveryMissions(page, characters[0].id);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await tabTo(page, page.getByRole("button", { name: "메뉴 열기", exact: true }));
  await page.keyboard.press("Enter");
  const menu = page.getByRole("navigation", { name: "모바일 메뉴", exact: true });
  await expect(menu).toBeVisible();
  await tabTo(page, menu.getByRole("link", { name: "미션", exact: true }));
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  const search = page.getByRole("searchbox", { name: "미션 검색", exact: true });
  await tabTo(page, search);
  await page.keyboard.insertText(chosen.title);
  async function selectWithKeyboard(name: string, value: string) {
    const select = page.getByRole("combobox", { name, exact: true });
    await tabTo(page, select);
    await expect(select).toBeInViewport();
    const box = await select.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    const options = await select.locator("option").evaluateAll(nodes => nodes.map(node => ({ value: (node as HTMLOptionElement).value, label: node.textContent ?? "" })));
    const option = options.find(item => item.value === value);
    expect(option).toBeDefined();
    // This macOS Chromium build doesn't change native select values with
    // Playwright arrow keys. Send real character input through CDP so Korean
    // type-ahead also works; never assign value or dispatch DOM change events.
    // Allow the native type-ahead buffer to expire before a new selection.
    await page.waitForTimeout(1100);
    const keyboard = await page.context().newCDPSession(page);
    try {
      for (const text of option!.label) await keyboard.send("Input.dispatchKeyEvent", { type: "char", text });
    } finally { await keyboard.detach(); }
    await expect(select).toHaveValue(value);
  }
  await selectWithKeyboard("장소 필터", chosen.location.split("·")[0].trim());
  await selectWithKeyboard("난이도 필터", "중급");
  await expect(page.getByText("조건에 맞는 미션이 없어요.", { exact: true })).toBeVisible();
  await selectWithKeyboard("난이도 필터", chosen.difficulty);
  await selectWithKeyboard("소요 시간 필터", "7");
  await selectWithKeyboard("캐릭터 필터", chosen.recommendedCharacterId);
  const card = page.getByTestId(`mission-card-${chosen.id}`);
  await expect(card).toBeVisible();
  expect(await cardIds(page, "mission")).toEqual([chosen.id]);
  const link = card.getByRole("link", { name: `${chosen.title} 미션 상세 보기`, exact: true });
  await tabTo(page, link);
  await expect(link).toBeInViewport();
  const bounds = await link.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: chosen.title, exact: true, level: 1 })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/missions/${chosen.id}$`));
});
