export function allowedChatModels(defaultModel: string, configured?: string): string[] {
  return [...new Set((configured ?? `${defaultModel},gpt-5-mini`).split(",").map((id) => id.trim()).filter(Boolean))];
}

export function isAllowedChatModel(modelId: string, defaultModel: string, configured?: string): boolean {
  return allowedChatModels(defaultModel, configured).includes(modelId);
}
