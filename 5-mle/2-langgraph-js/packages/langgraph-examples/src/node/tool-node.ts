import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { StructuredToolInterface } from "@langchain/core/tools";

export function makeToolNode(tools: StructuredToolInterface[]): ToolNode {
  return new ToolNode(tools);
}
