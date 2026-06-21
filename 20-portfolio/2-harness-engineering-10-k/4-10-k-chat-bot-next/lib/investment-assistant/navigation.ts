import { generateUUID } from "@/lib/utils";

export function createInvestmentAssistantThreadPath() {
  return `/?thread=${encodeURIComponent(generateUUID())}`;
}
