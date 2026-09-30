import type { UIMessage } from "ai";

export function hasAssistantOutput(parts: UIMessage["parts"]): boolean {
  return parts.some((part) => {
    if (part.type === "step-start") return false;
    if (part.type === "text" || part.type === "reasoning") return Boolean(part.text.trim());
    // Tool checkpoints and multimodal output can be valid without prose.
    return true;
  });
}
