import { test, expect } from "@playwright/test";
import { beginnerHomeMissions, popularHomeCharacters, recommendHomeCharacters } from "../../src/app/_lib/home-selection";

test("home recommendation prioritizes distinct stated interests with deterministic ties and no input mutation", () => {
  const characters = Object.freeze([
    Object.freeze({ id: "z", visibility: "public", publishStatus: "published", topics: Object.freeze(["여행", "여행"]), learnerCount: 20 }),
    Object.freeze({ id: "b", visibility: "public", publishStatus: "published", topics: Object.freeze(["여행", "문화"]), learnerCount: 0 }),
    Object.freeze({ id: "a", visibility: "public", publishStatus: "published", topics: Object.freeze(["여행"]), learnerCount: 1 }),
    Object.freeze({ id: "c", visibility: "public", publishStatus: "published", topics: Object.freeze(["직장"]), learnerCount: 5 }),
  ]);
  const interests = Object.freeze(["여행", "문화", "여행"]);
  expect(recommendHomeCharacters(characters, interests).map(item => [item.character.id, item.matchedInterests])).toEqual([
    ["b", ["문화", "여행"]], ["a", ["여행"]], ["z", ["여행"]],
  ]);
  expect(recommendHomeCharacters(characters, []).map(item => item.character.id)).toEqual(["a", "b", "c"]);
  expect(characters.map(item => item.id)).toEqual(["z", "b", "a", "c"]);
  expect(popularHomeCharacters(characters).map(item => item.id)).toEqual(["z", "c", "a"]);
});

test("beginner selection excludes intermediate and unknown difficulty, bounds cards, and retains input order", () => {
  const missions = Object.freeze([
    { id: "z", publishStatus: "published", difficulty: "중급" }, { id: "b", publishStatus: "published", difficulty: "초급" }, { id: "a", publishStatus: "published", difficulty: "입문" },
    { id: "x", publishStatus: "published", difficulty: "unknown" }, { id: "c", publishStatus: "published", difficulty: "초급" }, { id: "d", publishStatus: "published", difficulty: "입문" }, { id: "e", publishStatus: "published", difficulty: "초급" },
  ].map(mission => Object.freeze(mission)));
  expect(beginnerHomeMissions(missions).map(item => item.id)).toEqual(["a", "b", "c", "d"]);
  expect(missions.map(item => item.id)).toEqual(["z", "b", "a", "x", "c", "d", "e"]);
  expect(beginnerHomeMissions([{ id: "z", publishStatus: "published", difficulty: "중급" }])).toEqual([]);
});

test("empty catalogs and tied popularity are deterministic without fabricated counters", () => {
  expect(recommendHomeCharacters([], ["여행"])).toEqual([]);
  expect(popularHomeCharacters([])).toEqual([]); expect(beginnerHomeMissions([])).toEqual([]);
  expect(popularHomeCharacters([{ id: "b", visibility: "public", publishStatus: "published", topics: [], learnerCount: 0 }, { id: "a", visibility: "public", publishStatus: "published", topics: [], learnerCount: 0 }]).map(item => item.id)).toEqual(["a", "b"]);
});

test("public home selection excludes owned private characters and unpublished resources", () => {
  const base = { topics: ["여행"], learnerCount: 100, visibility: "public", publishStatus: "published" };
  const characters = [{ ...base, id: "private", visibility: "private" }, { ...base, id: "draft", publishStatus: "draft" }, { ...base, id: "archived", publishStatus: "archived" }, { ...base, id: "public", learnerCount: 1 }];
  expect(recommendHomeCharacters(characters, ["여행"]).map(item => item.character.id)).toEqual(["public"]);
  expect(popularHomeCharacters(characters).map(item => item.id)).toEqual(["public"]);
  expect(beginnerHomeMissions([{ id: "draft", difficulty: "입문", publishStatus: "draft" }, { id: "published", difficulty: "초급", publishStatus: "published" }]).map(item => item.id)).toEqual(["published"]);
});
