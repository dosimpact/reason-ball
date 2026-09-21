import type { Diagnostic, WeaveDocument, WeaveNode } from "./types.js";

/** Compile source without executing code or interpreting user-defined prefixes. */
export function compileCodeWeave(source: string): WeaveDocument {
  const lines = source.split(/\r\n|\n|\r/);
  const nodes: WeaveNode[] = [];
  const roots: string[] = [];
  const lineToNode: Record<number, string> = {};
  const diagnostics: Diagnostic[] = [];
  const stack: WeaveNode[] = [];
  let layer: string | null = null;
  const report = (code: string, message: string, line: number, column = 1) => {
    diagnostics.push({ code, message, line, column });
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const whitespace = raw.match(/^\s*/)?.[0] ?? "";
    const content = raw.slice(whitespace.length);
    const depth = whitespace.length / 2;
    const line = i + 1;
    if (/[^ ]/.test(whitespace) || !Number.isInteger(depth)) {
      report(
        "indent",
        "Indentation must use multiples of two spaces, without tabs.",
        line,
      );
      continue;
    }
    if (content.startsWith("/*")) {
      const owner = nodes.at(-1);
      const validOwner =
        owner?.kind === "logic" && owner.endLine === i && owner.depth === depth;
      if (!validOwner)
        report(
          "orphan-comment",
          "Block comment must immediately follow its logic at the same depth.",
          line,
        );
      const parts: string[] = [];
      let closed = false;
      for (; i < lines.length; i++) {
        const part = i + 1 === line ? content.slice(2) : lines[i];
        const close = part.indexOf("*/");
        const text = close < 0 ? part : part.slice(0, close);
        if (text.includes("/*"))
          report(
            "nested-comment",
            "Nested block comments are not supported.",
            i + 1,
          );
        parts.push(text);
        if (validOwner) lineToNode[i + 1] = owner.id;
        if (close >= 0) {
          if (part.slice(close + 2).trim())
            report("comment-tail", "Only whitespace may follow */.", i + 1);
          closed = true;
          break;
        }
      }
      const endLine = Math.min(i + 1, lines.length);
      if (!closed) report("unclosed-comment", "Missing closing */.", line);
      if (validOwner) {
        owner.comments.push({
          kind: "block",
          text: parts.join("\n"),
          startLine: line,
          endLine,
        });
        owner.endLine = endLine;
      }
      continue;
    }
    const layerMatch = content.match(/^\[([^\[\]]+)\]\s*$/);
    let node: WeaveNode;
    if (layerMatch) {
      if (depth !== 0 || !layerMatch[1].trim()) {
        report("layer", "A non-empty layer must start at depth zero.", line);
        continue;
      }
      stack.length = 0;
      layer = layerMatch[1].trim();
      node = createNode(line, depth, "layer", layer, layer);
    } else {
      const match = content.match(
        /^(->|<-)\s+(?:\(([+-])\)\s+)?([^\s:]+):\s*(.*)$/,
      );
      if (!match || match[3] === "(+)" || match[3] === "(-)") {
        report(
          "syntax",
          "Expected arrow, optional (+)/(-), Prefix: and body.",
          line,
          whitespace.length + 1,
        );
        continue;
      }
      const commentAt = match[4].search(/(?:^|\s)\/\//);
      const text = (
        commentAt < 0 ? match[4] : match[4].slice(0, commentAt)
      ).trim();
      if (!text) {
        report("body", "Logic body must not be empty.", line);
        continue;
      }
      if (layer !== null && depth === 0) {
        report("layer-depth", "Logic inside a layer must be indented.", line);
        continue;
      }
      node = createNode(line, depth, "logic", text, layer);
      node.direction = match[1] as "->" | "<-";
      node.prefix = match[3];
      node.change =
        match[2] === "+" ? "added" : match[2] === "-" ? "removed" : "unchanged";
      if (commentAt >= 0) {
        const comment = match[4].slice(commentAt).replace(/^\s*\/\/\s?/, "");
        node.comments.push({
          kind: "inline",
          text: comment,
          startLine: line,
          endLine: line,
        });
      }
    }
    while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();
    const parent = stack.at(-1);
    if ((parent ? parent.depth + 1 : 0) !== depth) {
      report(
        "depth-jump",
        "Indentation requires a parent at the preceding depth.",
        line,
      );
      continue;
    }
    node.parentId = parent?.id ?? null;
    if (parent) parent.children.push(node.id);
    else roots.push(node.id);
    nodes.push(node);
    stack.push(node);
    lineToNode[line] = node.id;
  }
  return {
    schemaVersion: 1,
    ok: diagnostics.length === 0,
    source,
    nodes,
    roots,
    lineToNode,
    diagnostics,
  };
}

function createNode(
  line: number,
  depth: number,
  kind: WeaveNode["kind"],
  text: string,
  layer: string | null,
): WeaveNode {
  return {
    id: `line:${line}`,
    kind,
    text,
    layer,
    depth,
    startLine: line,
    endLine: line,
    parentId: null,
    children: [],
    direction: null,
    prefix: null,
    change: "unchanged",
    comments: [],
  };
}
