export function missionPhraseLengthIssues(draft: { difficulty: string; keyPhrases: readonly { english: string }[] }) {
  if (draft.difficulty !== "입문") return [];
  return draft.keyPhrases.flatMap((phrase, index) => phrase.english.trim().split(/\s+/).length > 10 ? [{
    code: "custom" as const,
    path: ["keyPhrases", index, "english"],
    message: "입문 표현은 한 문장에 10단어 이하로 작성해 주세요.",
  }] : []);
}
