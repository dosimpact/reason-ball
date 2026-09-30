import { expect, test } from "@playwright/test";
import { missionPhraseLengthIssues } from "../../src/shared/api/supabase/mission-level-validation";

const ten = "Please help me find the nearest train station in town.";
const eleven = "Please help me find the nearest train station in this city.";

test("Pre-A1 accepts exactly ten words and reports the exact eleven-word phrase field", () => {
  expect(missionPhraseLengthIssues({ difficulty: "입문", keyPhrases: [{ english: ten }] })).toEqual([]);
  expect(missionPhraseLengthIssues({ difficulty: "입문", keyPhrases: [{ english: ten }, { english: eleven }] }))
    .toEqual([{ code: "custom", path: ["keyPhrases", 1, "english"], message: "입문 표현은 한 문장에 10단어 이하로 작성해 주세요." }]);
});

test("spaces, tabs and newlines do not add or hide words at the boundary", () => {
  const spaced = (text: string) => ` \n ${text.split(" ").join(" \t\n ")}  `;
  expect(missionPhraseLengthIssues({ difficulty: "입문", keyPhrases: [{ english: spaced(ten) }] })).toEqual([]);
  expect(missionPhraseLengthIssues({ difficulty: "입문", keyPhrases: [{ english: spaced(eleven) }] })).toHaveLength(1);
});

test("higher difficulty is not silently subject to the Pre-A1 limit", () => {
  for (const difficulty of ["초급", "중급"]) {
    expect(missionPhraseLengthIssues({ difficulty, keyPhrases: [{ english: eleven }] })).toEqual([]);
  }
});
