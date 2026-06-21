import "server-only";

import type { ReaderTocItem } from "./types";

export type SelectedFilingContext = {
  chatId: string;
  cik: string;
  accessionNo: string;
  formType: string;
  filingDate: string | null;
  reportDate: string | null;
  companyName: string;
  ticker: string | null;
  filingUrl: string;
  filePath: string | null;
  documentId: string;
  documentTitle: string;
  toc: ReaderTocItem[];
};

const selectedFilingByChatId = new Map<string, SelectedFilingContext>();

export function setSelectedFilingContext(context: SelectedFilingContext) {
  selectedFilingByChatId.set(context.chatId, context);
}

export function getSelectedFilingContext(chatId: string) {
  return selectedFilingByChatId.get(chatId) ?? null;
}

export function clearSelectedFilingContext(chatId: string) {
  selectedFilingByChatId.delete(chatId);
}
