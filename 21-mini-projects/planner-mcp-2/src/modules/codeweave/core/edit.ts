import { compileCodeWeave } from "./compiler.js";
import { getNode } from "./query.js";
import type {
  EditResult,
  NodePatch,
  WeaveDocument,
  WeaveNode,
} from "./types.js";

function reject(
  code: "conflict" | "invalid-document" | "not-found" | "invalid-edit",
  message: string,
): EditResult {
  return {
    ok: false,
    code,
    diagnostics: [{ code, message, line: 1, column: 1 }],
  };
}
function guard(
  document: WeaveDocument,
  expectedSource: string,
): EditResult | undefined {
  if (document.source !== expectedSource)
    return reject(
      "conflict",
      "Source changed; read the current document before editing.",
    );
  if (!document.ok)
    return reject(
      "invalid-document",
      "Resolve source diagnostics before structured editing.",
    );
}
/** Replace the document atomically; adapters must also check their storage revision. */
export function replaceSource(
  document: WeaveDocument,
  source: string,
  expectedSource: string,
): EditResult {
  if (document.source !== expectedSource)
    return reject(
      "conflict",
      "Source changed; read the current document before editing.",
    );
  const next = compileCodeWeave(source);
  return next.ok
    ? { ok: true, document: next }
    : { ok: false, code: "invalid-edit", diagnostics: next.diagnostics };
}
/** Patch a snapshot-local node. Untouched source lines and comments remain intact. */
export function updateNode(
  document: WeaveDocument,
  id: string,
  patch: NodePatch,
  expectedSource: string,
): EditResult {
  const error = guard(document, expectedSource);
  if (error) return error;
  const node = getNode(document, id);
  if (!node)
    return reject("not-found", "Node does not exist in this snapshot.");
  if (!validPatch(node, patch))
    return reject(
      "invalid-edit",
      "Patch contains unsupported fields or invalid delimiters.",
    );
  if (Object.values(patch).every((value) => value === undefined))
    return { ok: true, document, nodeId: id };
  const lines = document.source
    .match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)!
    .filter(Boolean);
  const newline = document.source.match(/\r\n|\r|\n/)?.[0] ?? "\n";
  const first = lines[node.startLine - 1];
  const ending = first.match(/(?:\r\n|\r|\n)$/)?.[0] ?? "";
  const originalInline = node.comments.find(
    (comment) => comment.kind === "inline",
  );
  const inline =
    patch.inlineComment === undefined
      ? originalInline?.text
      : patch.inlineComment;
  const indent = " ".repeat(node.depth * 2);
  let line: string;
  if (node.kind === "layer") line = `[${patch.text ?? node.text}]`;
  else {
    const change = patch.change ?? node.change;
    const marker =
      change === "added" ? "(+) " : change === "removed" ? "(-) " : "";
    line = `${indent}${patch.direction ?? node.direction} ${marker}${patch.prefix ?? node.prefix}: ${patch.text ?? node.text}`;
    if (inline !== null && inline !== undefined) line += ` // ${inline}`;
  }
  // Preserve existing block bytes unless explicitly changed.
  const existingBlock = lines.slice(node.startLine, node.endLine).join("");
  let replacement = line + ending + existingBlock;
  if (patch.blockComment !== undefined) {
    const lastEnding =
      lines[node.endLine - 1].match(/(?:\r\n|\r|\n)$/)?.[0] ?? "";
    replacement = line;
    if (patch.blockComment !== null) {
      replacement += newline + indent + "/*" + newline;
      replacement += patch.blockComment.replace(/\r\n|\r|\n/g, newline);
      replacement += newline + indent + "*/";
    }
    replacement += lastEnding;
  }
  lines.splice(
    node.startLine - 1,
    node.endLine - node.startLine + 1,
    replacement,
  );
  const result = replaceSource(document, lines.join(""), expectedSource);
  return result.ok ? { ...result, nodeId: `line:${node.startLine}` } : result;
}

function validPatch(node: WeaveNode, patch: NodePatch): boolean {
  const allowed =
    node.kind === "layer"
      ? ["text"]
      : [
          "text",
          "prefix",
          "direction",
          "change",
          "inlineComment",
          "blockComment",
        ];
  if (Object.keys(patch).some((key) => !allowed.includes(key))) return false;
  if (
    patch.text !== undefined &&
    (typeof patch.text !== "string" ||
      !patch.text.trim() ||
      /[\r\n]/.test(patch.text) ||
      patch.text !== patch.text.trim())
  )
    return false;
  if (
    node.kind === "layer" &&
    patch.text !== undefined &&
    /[\[\]]/.test(patch.text)
  )
    return false;
  if (
    node.kind === "logic" &&
    patch.text !== undefined &&
    /(?:^|\s)\/\//.test(patch.text)
  )
    return false;
  if (
    patch.prefix !== undefined &&
    (typeof patch.prefix !== "string" ||
      !/^[^\s:]+$/.test(patch.prefix) ||
      ["(+)", "(-)"].includes(patch.prefix))
  )
    return false;
  if (patch.direction !== undefined && !["->", "<-"].includes(patch.direction))
    return false;
  if (
    patch.change !== undefined &&
    !["added", "removed", "unchanged"].includes(patch.change)
  )
    return false;
  if (
    patch.inlineComment != null &&
    (typeof patch.inlineComment !== "string" ||
      /[\r\n]/.test(patch.inlineComment))
  )
    return false;
  if (
    patch.blockComment != null &&
    (typeof patch.blockComment !== "string" ||
      /\/\*|\*\//.test(patch.blockComment))
  )
    return false;
  return true;
}
