import { expect, test } from "@playwright/test";
import { artifactAssistanceRequest, assistanceTarget, storedAssistanceDto, matchesAssistanceRequest } from "../../src/features/chat-artifact/model/assistance";
const base = { requestId: "33333333-3333-4333-8333-333333333333", artifactId: "11111111-1111-4111-8111-111111111111", expectedVersionId: "22222222-2222-4222-8222-222222222222" };
test("artifact assistance selects only bounded authoritative content and compatible operations", () => {
  expect(assistanceTarget("text", "before target after", { ...base, mode: "rewrite", selection: { start: 7, end: 13 } })).toBe("target");
  expect(assistanceTarget("sheet", "a,b\n1,2", { ...base, mode: "analysis" })).toBe("a,b\n1,2");
  for (const selection of [{ start: 2, end: 2 }, { start: 0, end: 100 }]) expect(() => assistanceTarget("text", "hi", { ...base, mode: "rewrite", selection })).toThrow();
  expect(() => assistanceTarget("code", "1+1", { ...base, mode: "grammar" })).toThrow();
  expect(() => assistanceTarget("text", "hi", { ...base, mode: "analysis" })).toThrow();
  expect(artifactAssistanceRequest.safeParse({ ...base, mode: "grammar", content: "untrusted override" }).success).toBe(false);
  expect(artifactAssistanceRequest.safeParse({ ...base, mode: "grammar", ownerId: base.artifactId }).success).toBe(false);
});

test("stored assistance preserves exact source, selection and first provider output for replay", () => {
  const ownerId = "44444444-4444-4444-8444-444444444444";
  const content = "before target after";
  const input = { ...base, mode: "rewrite" as const, selection: { start: 7, end: 13 } };
  const row = { id: base.requestId, artifact_version_id: base.expectedVersionId, owner_id: ownerId,
    mode: "rewrite", selection_start: 7, selection_end: 13, original_text: content,
    suggested_text: "replacement", description: "의미를 유지했습니다.", status: "pending" };
  expect(matchesAssistanceRequest(row, input, ownerId, content)).toBe(true);
  expect(storedAssistanceDto(row, base.artifactId, "text", content)).toEqual({
    suggestionId: base.requestId, artifactId: base.artifactId, versionId: base.expectedVersionId,
    mode: "rewrite", selection: { start: 7, end: 13 }, sourceContent: content, source: "provider",
    result: { suggestion: "replacement", explanation: "의미를 유지했습니다." },
  });
  for (const changed of [{ ...input, mode: "grammar" as const }, { ...input, expectedVersionId: ownerId }, { ...input, selection: { start: 0, end: 6 } }]) {
    expect(matchesAssistanceRequest(row, changed, ownerId, content)).toBe(false);
  }
  expect(matchesAssistanceRequest(row, input, base.artifactId, content)).toBe(false);
  expect(matchesAssistanceRequest(row, input, ownerId, content + " changed")).toBe(false);
  expect(() => storedAssistanceDto(row, base.artifactId, "text", content + " changed")).toThrow();
  expect(() => storedAssistanceDto({ ...row, selection_end: null }, base.artifactId, "text", content)).toThrow();
  expect(() => storedAssistanceDto({ ...row, selection_end: 100 }, base.artifactId, "text", content)).toThrow();
  expect(artifactAssistanceRequest.safeParse({ artifactId: base.artifactId, expectedVersionId: base.expectedVersionId, mode: "grammar" }).success).toBe(false);
});
