import { z } from "zod";

const sourceSchema = z.object({
  conversationId: z.string().trim().min(1).max(200),
  messageId: z.string().trim().min(1).max(200).optional(),
}).strict();

export const notebookDraftSchema = z.object({
  kind: z.enum(["expression", "word", "correction"]),
  text: z.string().trim().min(1).max(1_000),
  meaning: z.string().trim().max(2_000),
  originalText: z.string().trim().max(1_000),
  source: sourceSchema,
}).strict().superRefine((draft, context) => {
  if (draft.kind === "correction" && !draft.originalText) {
    context.addIssue({ code: "custom", path: ["originalText"], message: "교정 전 문장을 입력해 주세요." });
  }
  if (draft.kind !== "correction" && draft.originalText) {
    context.addIssue({ code: "custom", path: ["originalText"], message: "교정 기록에만 원문을 저장할 수 있어요." });
  }
});

export const notebookEntrySchema = z.object({
  id: z.uuid(),
  draft: notebookDraftSchema,
  createdAt: z.iso.datetime(),
}).strict();

export type NotebookDraft = z.infer<typeof notebookDraftSchema>;
export type NotebookEntry = z.infer<typeof notebookEntrySchema>;

// Keep punctuation meaningful. Normalization only merges case, Unicode width
// and whitespace variants, not different sentences or different corrections.
export function normalizeNotebookText(text: string) {
  return text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function notebookIdentity(draft: NotebookDraft) {
  return JSON.stringify([draft.kind, normalizeNotebookText(draft.text), normalizeNotebookText(draft.originalText)]);
}

export const notebookSchema = z.object({
  version: z.literal(1),
  entries: z.array(notebookEntrySchema),
  receipts: z.array(z.object({ id: z.uuid(), draft: notebookDraftSchema, entryId: z.uuid() }).strict()).default([]),
}).strict().superRefine((notebook, context) => {
  const ids = new Set(notebook.entries.map((entry) => entry.id));
  const identities = new Set(notebook.entries.map((entry) => notebookIdentity(entry.draft)));
  if (ids.size !== notebook.entries.length || identities.size !== notebook.entries.length) {
    context.addIssue({ code: "custom", path: ["entries"], message: "중복된 복습 기록을 확인해 주세요." });
  }
  if (new Set(notebook.receipts.map((receipt) => receipt.id)).size !== notebook.receipts.length
    || notebook.receipts.some((receipt) => !ids.has(receipt.entryId))) {
    context.addIssue({ code: "custom", path: ["receipts"], message: "복습 저장 요청 기록이 올바르지 않아요." });
  }
});
export type Notebook = z.infer<typeof notebookSchema>;

export const saveNotebookRequestSchema = z.object({ id: z.uuid(), draft: notebookDraftSchema }).strict();
export type SaveNotebookRequest = z.infer<typeof saveNotebookRequestSchema>;

function sameDraft(left: NotebookDraft, right: NotebookDraft) {
  return left.kind === right.kind && left.text === right.text && left.meaning === right.meaning
    && left.originalText === right.originalText && left.source.conversationId === right.source.conversationId
    && left.source.messageId === right.source.messageId;
}

export function saveNotebookEntry(input: Notebook, raw: SaveNotebookRequest, createdAt: string) {
  const notebook = notebookSchema.parse(input);
  const request = saveNotebookRequestSchema.parse(raw);
  const candidate = notebookEntrySchema.parse({ ...request, createdAt });
  const receipt = notebook.receipts.find((item) => item.id === request.id);
  if (receipt) {
    if (!sameDraft(receipt.draft, request.draft)) throw new Error("같은 저장 요청으로 다른 내용을 덮어쓸 수 없어요.");
    return { notebook, entry: notebook.entries.find((entry) => entry.id === receipt.entryId)!, outcome: "replayed" as const };
  }
  const replay = notebook.entries.find((entry) => entry.id === request.id);
  if (replay) {
    if (!sameDraft(replay.draft, request.draft)) throw new Error("같은 저장 요청으로 다른 내용을 덮어쓸 수 없어요.");
    return { notebook, entry: replay, outcome: "replayed" as const };
  }
  const duplicate = notebook.entries.find((entry) => notebookIdentity(entry.draft) === notebookIdentity(request.draft));
  const entry = duplicate ?? candidate;
  const receipts = [...notebook.receipts, { ...request, entryId: entry.id }];
  if (duplicate) return { notebook: { ...notebook, receipts }, entry, outcome: "duplicate" as const };
  return { notebook: { ...notebook, receipts, entries: [...notebook.entries, candidate] }, entry, outcome: "created" as const };
}

export function countNotebookExpressions(input: Notebook) {
  return new Set(notebookSchema.parse(input).entries.map((entry) => normalizeNotebookText(entry.draft.text))).size;
}
