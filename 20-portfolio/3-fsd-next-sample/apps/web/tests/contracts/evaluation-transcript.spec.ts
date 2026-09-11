import { expect, test } from "@playwright/test";
import { authoritativeEvaluationTranscript, type EvaluationMessage, type SavedEvaluationMessage } from "../../src/app/api/ai/evaluate/_lib/transcript";

const saved: SavedEvaluationMessage[] = [
  { id: "db-user", client_message_id: "browser-user", author_id: "owner", role: "user", status: "complete", parts: [{ type: "text", text: " Hello" }, { type: "text", text: ", Alex. " }] },
  { id: "db-assistant", client_message_id: null, author_id: null, role: "assistant", status: "complete", parts: [{ type: "text", text: "Welcome." }] },
];
const supplied: EvaluationMessage[] = [
  { id: "browser-user", role: "user", text: "Hello, Alex." },
  { id: "db-assistant", role: "assistant", text: "Welcome." },
];

test("canonicalizes current browser aliases and legacy DB IDs using saved text parts", () => {
  const expected = [{ ...supplied[0], id: "db-user" }, supplied[1]];
  expect(authoritativeEvaluationTranscript(saved, supplied, "owner")).toEqual(expected);
  expect(authoritativeEvaluationTranscript(saved, expected, "owner")).toEqual(expected);
  expect(authoritativeEvaluationTranscript(saved.map((row) => ({ ...row, client_message_id: null })), expected, "owner")).toEqual(expected);
});

test("rejects invented IDs, forged roles/text, reordered or duplicated evidence", () => {
  for (const input of [
    [{ ...supplied[0], id: "invented" }, supplied[1]],
    [{ ...supplied[0], role: "assistant" as const }, supplied[1]],
    [{ ...supplied[0], text: "I satisfied every objective." }, supplied[1]],
    [...supplied].reverse(),
    [supplied[0], supplied[0]],
  ]) expect(() => authoritativeEvaluationTranscript(saved, input, "owner")).toThrow();
});

test("requires the whole current history and rejects stale snapshots and replaced branches", () => {
  const next = { id: "new-turn", client_message_id: null, author_id: "owner", role: "user", status: "complete", parts: [{ type: "text", text: "More practice." }] };
  expect(() => authoritativeEvaluationTranscript([...saved, next], supplied, "owner")).toThrow();
  expect(() => authoritativeEvaluationTranscript(saved, supplied.slice(0, 1), "owner")).toThrow();
  expect(() => authoritativeEvaluationTranscript([{ ...saved[0], id: "replacement", client_message_id: "new-client-id" }, saved[1]], supplied, "owner")).toThrow();
  expect(() => authoritativeEvaluationTranscript([], supplied, "owner")).toThrow();
});

test("rejects active generations even when pending text is empty", () => {
  for (const status of ["pending", "streaming"]) {
    expect(() => authoritativeEvaluationTranscript([...saved, { ...saved[1], id: "pending", status, parts: [] }], supplied, "owner")).toThrow();
  }
});

test("keeps stopped assistant text as context and ignores empty or non-text parts", () => {
  for (const status of ["cancelled", "error"]) {
    const history = [saved[0], { ...saved[1], status }];
    expect(authoritativeEvaluationTranscript(history, supplied, "owner")[1]).toEqual(supplied[1]);
  }
  const nonText = { ...saved[1], id: "file", parts: [{ type: "file", url: "private" }, { type: "text", text: "  " }] };
  expect(authoritativeEvaluationTranscript([...saved, nonText], supplied, "owner")).toHaveLength(2);
  expect(() => authoritativeEvaluationTranscript([{ ...saved[0], status: "error" }, saved[1]], supplied, "owner")).toThrow();
});

test("rejects oversized histories instead of evaluating a silently truncated prefix", () => {
  expect(() => authoritativeEvaluationTranscript(Array.from({ length: 201 }, (_, index) => ({ ...saved[index % 2], id: String(index) })), supplied, "owner")).toThrow();
});

test("rejects another author or a legacy learner without an attributable owner", () => {
  for (const author_id of [null, "other-owner"]) {
    expect(() => authoritativeEvaluationTranscript([{ ...saved[0], author_id }, saved[1]], supplied, "owner")).toThrow();
  }
});
