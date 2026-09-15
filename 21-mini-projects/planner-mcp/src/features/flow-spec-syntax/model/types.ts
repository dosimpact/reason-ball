export const layerTypes = [
  "upstream-api",
  "bff-endpoint",
  "frontend-biz-logic",
] as const;
export type LayerType = (typeof layerTypes)[number];
export const layerLabels: Record<LayerType, string> = {
  "upstream-api": "Upstream API",
  "bff-endpoint": "BFF Endpoint",
  "frontend-biz-logic": "Frontend Biz Logic",
};
export type FlowNode = FlowLayer | FlowStep;
export type FlowStep = {
  id: string;
  kind: "step" | "note";
  label: string;
  children: FlowStep[];
};
export type FlowLayer = {
  id: string;
  kind: "layer";
  layerType: LayerType;
  children: FlowStep[];
};
export type FlowTree = {
  format: "flow-spec";
  schemaVersion: 1;
  layers: FlowLayer[];
};
export type SyntaxNode = {
  kind: "layer" | "step" | "note";
  label: string;
  line: number;
  children: SyntaxNode[];
  layerType?: LayerType;
};
export type Diagnostic = {
  code: string;
  message: string;
  path?: string;
  nodeId?: string;
  line?: number;
  column?: number;
};
export type ParseResult =
  | { success: true; layers: SyntaxNode[] }
  | { success: false; errors: Diagnostic[] };
export const flowLimits = {
  nodes: 5000,
  depth: 40,
  textLength: 1_000_000,
  labelLength: 2000,
};
