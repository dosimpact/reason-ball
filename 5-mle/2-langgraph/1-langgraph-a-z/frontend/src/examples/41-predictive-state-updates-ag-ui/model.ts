import { filter, isPlainObject, isString, isTruthy, map, pipe } from "remeda";
import { z } from "zod";

export type DocumentState = {
  title: string;
  body: string;
  revision: number;
  lastOperation: string;
};

export type PendingOperation = {
  id: string;
  operation: string;
  status: "pending" | "confirmed" | "reverted";
  predictedTitle: string;
  predictedBody: string;
};

export const initialDocument: DocumentState = {
  title: "Launch Readiness Note",
  body:
    "The team needs a compact readiness note before launch. It should summarize owner, risk, and next decision. The first draft is intentionally plain so predictive edits are easy to inspect.",
  revision: 1,
  lastOperation: "seed",
};

export function parseResult(result: unknown): Record<string, unknown> {
  if (isString(result)) {
    try {
      const parsed: unknown = JSON.parse(result);
      return parseResult(parsed);
    } catch {
      return { text: result };
    }
  }
  if (isPlainObject(result)) return result as Record<string, unknown>;
  return {};
}

export function predictPatch(document: DocumentState, operation: string): Pick<DocumentState, "title" | "body"> {
  if (operation === "rewrite_title") {
    return { title: `${document.title}: reviewed draft`, body: document.body };
  }
  if (operation === "shorten") {
    const sentences = pipe(document.body.split("."), map((part) => part.trim()), filter(isTruthy));
    return { title: document.title, body: sentences.slice(0, 2).join(". ") + "." };
  }
  if (operation === "append_summary") {
    return {
      title: document.title,
      body: `${document.body}\n\nSummary: Keep the launch note focused, testable, and ready for review.`,
    };
  }
  return {
    title: document.title,
    body: `${document.body}\n\nRevision note: Clarified the outcome, owner, and next decision point.`,
  };
}

export const editDocumentParameters = z.object({
  title: z.string(),
  body: z.string(),
  operation: z.enum(["rewrite_title", "improve_paragraph", "shorten", "append_summary"]),
});
