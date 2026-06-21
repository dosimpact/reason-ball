import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { buildInvestmentDecisionBrief } from "./ai/tools/sec/build-investment-decision-brief";
import type { listCompanyFilings } from "./ai/tools/sec/list-company-filings";
import type { openLatestFilingFullText } from "./ai/tools/sec/open-latest-filing-full-text";
import type { summarizeSelectedFiling } from "./ai/tools/sec/summarize-selected-filing";
import type { updateDocument } from "./ai/tools/update-document";
import type { Suggestion } from "./db/schema";

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type listCompanyFilingsTool = InferUITool<typeof listCompanyFilings>;
type openLatestFilingFullTextTool = InferUITool<
  ReturnType<typeof openLatestFilingFullText>
>;
type summarizeSelectedFilingTool = InferUITool<
  ReturnType<typeof summarizeSelectedFiling>
>;
type buildInvestmentDecisionBriefTool = InferUITool<
  ReturnType<typeof buildInvestmentDecisionBrief>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  listCompanyFilings: listCompanyFilingsTool;
  openLatestFilingFullText: openLatestFilingFullTextTool;
  summarizeSelectedFiling: summarizeSelectedFilingTool;
  buildInvestmentDecisionBrief: buildInvestmentDecisionBriefTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  "chat-title": string;
  "selected-filing": Record<string, unknown>;
  "retrieval-debug": Record<string, unknown>;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
