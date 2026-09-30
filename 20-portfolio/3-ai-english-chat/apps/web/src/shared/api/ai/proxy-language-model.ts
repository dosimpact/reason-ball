import { simulateStreamingMiddleware, wrapLanguageModel } from "ai";

/** The OAuth proxy returns a buffered Responses JSON object for chat requests. */
export function proxyLanguageModel(model: Parameters<typeof wrapLanguageModel>[0]["model"]) {
  return wrapLanguageModel({ model, middleware: simulateStreamingMiddleware() });
}
