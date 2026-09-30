import { expect, test } from "@playwright/test";
import { countNotebookExpressions, normalizeNotebookText, notebookDraftSchema, notebookSchema, saveNotebookEntry, type Notebook, type SaveNotebookRequest } from "../../src/entities/learning-notebook/model/notebook";
import { createLocalNotebookRepository, localNotebookKey } from "../../src/entities/learning-notebook/api/local-notebook";

const empty: Notebook = { version: 1, entries: [], receipts: [] };
const time = "2026-09-10T12:00:00.000Z";
const request = (number: number): SaveNotebookRequest => ({
  id: `61000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
  draft: { kind: "expression", text: "Could I check in?", meaning: "체크인할 수 있을까요?", originalText: "", source: { conversationId: "demo-chat", messageId: "answer-1" } },
});

test("notebook saves a validated snapshot without mutating input and replays the original result", () => {
  const input = structuredClone(empty);
  const raw = request(1);
  const first = saveNotebookEntry(input, raw, time);
  expect(input).toEqual(empty);
  expect(first.outcome).toBe("created");
  expect(first.entry.createdAt).toBe(time);
  raw.draft.text = "Changed elsewhere";
  expect(first.entry.draft.text).toBe("Could I check in?");
  const replay = saveNotebookEntry(first.notebook, request(1), "2026-09-11T12:00:00.000Z");
  expect(replay.entry).toEqual(first.entry);
  expect(replay.outcome).toBe("replayed");
  expect(replay.notebook.entries).toHaveLength(1);
  expect(() => saveNotebookEntry(first.notebook, raw, time)).toThrow("덮어쓸");
  expect(() => saveNotebookEntry(empty, request(1), "invalid")).toThrow();
});

test("semantic duplicates preserve the first note and source while distinct punctuation and corrections remain separate", () => {
  const first = saveNotebookEntry(empty, request(1), time);
  const duplicate = request(2);
  duplicate.draft.text = "  ＣＯＵＬＤ I\n check in?  ";
  duplicate.draft.meaning = "Do not overwrite my existing note";
  duplicate.draft.source.conversationId = "another-chat";
  const result = saveNotebookEntry(first.notebook, duplicate, time);
  expect(result.outcome).toBe("duplicate");
  expect(result.entry).toEqual(first.entry);
  expect(saveNotebookEntry(result.notebook, duplicate, time).outcome).toBe("replayed");
  expect(() => saveNotebookEntry(result.notebook, request(2), time)).toThrow("덮어쓸");
  const corrected = request(3);
  corrected.draft.kind = "correction";
  corrected.draft.originalText = "I check in?";
  const withCorrection = saveNotebookEntry(result.notebook, corrected, time);
  expect(withCorrection.notebook.entries).toHaveLength(2);
  expect(countNotebookExpressions(withCorrection.notebook)).toBe(1);
  expect(countNotebookExpressions(empty)).toBe(0);
  expect(normalizeNotebookText(" It's  fine. ")).toBe("it's fine.");
  expect(normalizeNotebookText("fine")).not.toBe(normalizeNotebookText("fine?"));
});

test("notebook rejects incomplete correction, forged fields, duplicate keys, empty and oversized text", () => {
  expect(notebookDraftSchema.safeParse({ ...request(1).draft, kind: "correction" }).success).toBe(false);
  expect(notebookDraftSchema.safeParse({ ...request(1).draft, originalText: "unexpected" }).success).toBe(false);
  for (const text of ["   ", "a".repeat(1_001)]) {
    expect(notebookDraftSchema.safeParse({ ...request(1).draft, text }).success).toBe(false);
  }
  expect(() => saveNotebookEntry(empty, { ...request(1), ownerId: "someone-else" } as SaveNotebookRequest, time)).toThrow();
  const { entry } = saveNotebookEntry(empty, request(1), time);
  expect(notebookSchema.safeParse({ version: 1, entries: [entry, entry] }).success).toBe(false);
  expect(notebookSchema.safeParse({ version: 1, entries: [entry, { ...entry, id: request(2).id }] }).success).toBe(false);
});

test("words keep their explanation and request identity includes the original source and note", () => {
  const word = request(1);
  word.draft = { kind: "word", text: " reservation ", meaning: " 예약 ", originalText: "", source: { conversationId: "my-chat" } };
  const first = saveNotebookEntry(empty, word, time);
  expect(first.entry.draft).toEqual({ ...word.draft, text: "reservation", meaning: "예약" });
  for (const draft of [
    { ...first.entry.draft, meaning: "new explanation" },
    { ...first.entry.draft, source: { conversationId: "other-chat" } },
    { ...first.entry.draft, source: { conversationId: "my-chat", messageId: "other-message" } },
  ]) {
    expect(() => saveNotebookEntry(first.notebook, { id: word.id, draft }, time)).toThrow("덮어쓸");
  }
  expect(() => notebookDraftSchema.parse({ ...word.draft, source: { conversationId: "" } })).toThrow();
  expect(() => notebookDraftSchema.parse({ ...word.draft, meaning: "a".repeat(2_001) })).toThrow();
});

test("local notebook survives recreation and persists duplicate receipts without rewriting entries", () => {
  const data = new Map<string, string>([["unrelated", "keep"]]);
  let writes = 0;
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { writes++; data.set(key, value); } };
  const repository = createLocalNotebookRepository(storage);
  expect(repository.read()).toEqual(empty);
  expect(writes).toBe(0);
  const saved = repository.save(request(1), time);
  expect(JSON.parse(data.get(localNotebookKey)!)).toEqual(saved.notebook);
  expect(createLocalNotebookRepository(storage).read()).toEqual(saved.notebook);
  expect(repository.save(request(1), time).outcome).toBe("replayed");
  expect(repository.save(request(2), time).outcome).toBe("duplicate");
  expect(repository.save(request(2), time).outcome).toBe("replayed");
  expect(writes).toBe(2);
  expect(data.get("unrelated")).toBe("keep");
});

test("quota and corrupt storage failures preserve existing records and never fall back to empty data", () => {
  const stored = JSON.stringify(saveNotebookEntry(empty, request(1), time).notebook);
  const failing = createLocalNotebookRepository({ getItem: () => stored, setItem: () => { throw new Error("quota"); } });
  const next = request(2);
  next.draft.text = "Where is the station?";
  expect(() => failing.save(next, time)).toThrow("quota");
  expect(failing.read().entries).toHaveLength(1);
  let wrote = false;
  const corrupt = createLocalNotebookRepository({ getItem: () => "not json", setItem: () => { wrote = true; } });
  expect(() => corrupt.read()).toThrow();
  expect(() => corrupt.save(next, time)).toThrow();
  expect(wrote).toBe(false);
});
