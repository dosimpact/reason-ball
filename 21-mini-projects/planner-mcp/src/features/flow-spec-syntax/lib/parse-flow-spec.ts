import {
  flowLimits,
  layerLabels,
  layerTypes,
  type ParseResult,
  type SyntaxNode,
  type FlowTree,
  type FlowStep,
} from "../model/types";
import { validateFlowTree } from "./validate-tree";

export function parseFlowSpec(source: string): ParseResult {
  const error = (
    code: string,
    message: string,
    line = 1,
    column = 1,
  ): ParseResult => ({
    success: false,
    errors: [{ code, message, line, column }],
  });
  if (source.length > flowLimits.textLength)
    return error("SIZE_LIMIT", "원문 크기 제한 초과");
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "flow-spec 1")
    return error("UNSUPPORTED_VERSION", "첫 줄은 flow-spec 1이어야 합니다.");
  const layers: SyntaxNode[] = [],
    stack: SyntaxNode[] = [];
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const indent = raw.match(/^ */)![0].length;
    if (/^\s*\t/.test(raw) || indent % 2)
      return error("INVALID_INDENT", "공백 두 칸 단위로 들여쓰세요.", i + 1);
    const depth = indent / 2,
      text = raw.slice(indent);
    if (++count > flowLimits.nodes || depth > flowLimits.depth)
      return error("TREE_LIMIT", "트리 크기·깊이 제한 초과", i + 1);
    if (depth === 0) {
      const layerType = layerTypes[layers.length];
      if (!layerType || text !== `[${layerLabels[layerType]}]`)
        return error(
          "INVALID_LAYER",
          "정해진 세 계층을 순서대로 작성하세요.",
          i + 1,
        );
      const node: SyntaxNode = {
        kind: "layer",
        layerType,
        label: layerLabels[layerType],
        line: i + 1,
        children: [],
      };
      layers.push(node);
      stack.length = 0;
      stack.push(node);
      continue;
    }
    const match = /^(->|\(\+\)) (.+)$/.exec(text);
    if (
      !match ||
      !match[2].trim() ||
      match[2].trim() !== match[2] ||
      match[2].length > flowLimits.labelLength
    )
      return error(
        "INVALID_LABEL",
        "-> 설명 또는 (+) 설명 형식이 필요합니다.",
        i + 1,
        indent + 1,
      );
    const parent = stack[depth - 1];
    const kind = match[1] === "->" ? "step" : "note";
    if (
      !parent ||
      parent.kind === "note" ||
      (parent.kind === "layer" && kind !== "step")
    )
      return error(
        "INVALID_PARENT",
        "들여쓰기와 부모 종류를 확인하세요.",
        i + 1,
        indent + 1,
      );
    const node: SyntaxNode = {
      kind,
      label: match[2],
      line: i + 1,
      children: [],
    };
    parent.children.push(node);
    stack.length = depth;
    stack.push(node);
  }
  if (layers.length !== 3)
    return error("MISSING_LAYER", "세 계층이 모두 필요합니다.", lines.length);
  return { success: true, layers };
}

// IDs are supplied by the boundary; parsing itself never generates identities.
export function materializeFlow(layers: SyntaxNode[], ids: string[]): FlowTree {
  let index = 0;
  const child = (n: SyntaxNode): FlowStep => ({
    id: ids[index++],
    kind: n.kind as "step" | "note",
    label: n.label,
    children: n.children.map(child),
  });
  const tree = {
    format: "flow-spec",
    schemaVersion: 1,
    layers: layers.map((n) => ({
      id: ids[index++],
      kind: "layer",
      layerType: n.layerType,
      children: n.children.map(child),
    })),
  };
  return validateFlowTree(tree);
}
