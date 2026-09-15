import { PlannerError } from "@/shared/lib/errors";
import {
  flowLimits,
  layerTypes,
  layerLabels,
  type FlowTree,
  type Diagnostic,
} from "../model/types";

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k)) && keys.every((k) => k in v);

export function validateFlowTree(value: unknown): FlowTree {
  const errors: Diagnostic[] = [];
  let nodeId: string | undefined;
  const fail = (code: string, path: string, message: string) =>
    errors.push({ code, path, message, ...(nodeId ? { nodeId } : {}) });
  if (
    !object(value) ||
    !exactKeys(value, ["format", "schemaVersion", "layers"]) ||
    value.format !== "flow-spec" ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.layers) ||
    value.layers.length !== 3
  ) {
    throw new PlannerError(
      "SCHEMA_INVALID",
      "Flow Spec v1에는 정해진 세 계층이 필요합니다.",
      { errors: [{ path: "/", code: "INVALID_ROOT" }] },
    );
  }
  const ids = new Set<string>(),
    objects = new Set<object>();
  const stack = value.layers
    .map((node, i) => ({
      node,
      parent: "root",
      depth: 0,
      path: `/layers/${i}`,
      index: i,
    }))
    .reverse();
  let count = 0;
  let textLength = "flow-spec 1".length;
  while (stack.length) {
    const { node, parent, depth, path, index } = stack.pop()!;
    nodeId = object(node) && typeof node.id === "string" ? node.id : undefined;
    if (++count > flowLimits.nodes) {
      fail("NODE_LIMIT", path, "노드 수 제한 초과");
      break;
    }
    if (depth > flowLimits.depth) {
      fail("DEPTH_LIMIT", path, "트리 깊이 제한 초과");
      continue;
    }
    if (!object(node) || objects.has(node)) {
      fail("INVALID_NODE", path, "잘못된 노드 또는 순환/중복 객체");
      continue;
    }
    objects.add(node);
    textLength +=
      1 +
      (parent === "root"
        ? layerLabels[layerTypes[index]].length + 2
        : depth * 2 +
          (node.kind === "note" ? 4 : 3) +
          (typeof node.label === "string" ? node.label.length : 0));
    if (textLength > flowLimits.textLength) {
      fail("TEXT_LIMIT", path, "Flow 텍스트 크기 제한 초과");
      break;
    }
    if (
      typeof node.id !== "string" ||
      !node.id.trim() ||
      node.id.length > 128 ||
      ids.has(node.id)
    )
      fail("INVALID_ID", path + "/id", "고유한 노드 ID가 필요합니다.");
    else ids.add(node.id);
    const isLayer = parent === "root";
    const keys = isLayer
      ? ["id", "kind", "layerType", "children"]
      : ["id", "kind", "label", "children"];
    if (!exactKeys(node, keys))
      fail("INVALID_FIELDS", path, "허용되지 않거나 누락된 필드");
    if (isLayer) {
      if (node.kind !== "layer" || node.layerType !== layerTypes[index])
        fail("INVALID_LAYER", path, "계층 순서 또는 종류 오류");
    } else {
      if (
        !["step", "note"].includes(String(node.kind)) ||
        (parent === "layer" && node.kind !== "step") ||
        parent === "note"
      )
        fail("INVALID_PARENT", path, "허용되지 않는 부모·자식 관계");
      if (
        typeof node.label !== "string" ||
        !node.label ||
        node.label.trim() !== node.label ||
        /[\r\n]/.test(node.label) ||
        node.label.length > flowLimits.labelLength
      )
        fail(
          "INVALID_LABEL",
          path + "/label",
          "공백 없는 시작·끝의 한 줄 설명이 필요합니다.",
        );
    }
    if (!Array.isArray(node.children)) {
      fail("INVALID_CHILDREN", path, "children 배열 필요");
      continue;
    }
    if (node.kind === "note" && node.children.length)
      fail("INVALID_PARENT", path, "note는 자식을 가질 수 없습니다.");
    for (let i = node.children.length - 1; i >= 0; i--)
      stack.push({
        node: node.children[i],
        parent: String(node.kind),
        depth: depth + 1,
        path: `${path}/children/${i}`,
        index: i,
      });
  }
  if (errors.length)
    throw new PlannerError(
      "SCHEMA_INVALID",
      "Flow Spec 트리가 유효하지 않습니다.",
      { errors },
    );
  return value as unknown as FlowTree;
}
