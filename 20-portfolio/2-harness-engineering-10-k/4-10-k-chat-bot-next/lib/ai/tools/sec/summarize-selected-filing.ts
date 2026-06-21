import { tool } from "ai";
import { z } from "zod";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { getFilingByIdentity } from "@/lib/sec/repository";
import { getSelectedFilingContext } from "@/lib/sec/session-context";
import {
  type SummaryStyle,
  summarizeFilingByStyle,
} from "@/lib/sec/summarizer";

export const summarizeSelectedFiling = ({ chatId }: { chatId: string }) =>
  tool({
    description:
      "Summarize the currently selected filing in the chat context. Use this for requests like 요약으로 읽어와줘 or 기본적으로 중요한 정보를 요약해줘.",
    inputSchema: z.object({
      style: z
        .enum(["executive", "short", "risk_focus", "key_info_first"])
        .optional()
        .default("executive"),
    }),
    execute: async ({ style }) => {
      const context = getSelectedFilingContext(chatId);

      if (!context) {
        return {
          error:
            "No filing is selected in this chat yet. Please open a filing full text first.",
        };
      }

      const filing = await getFilingByIdentity({
        cik: context.cik,
        accessionNo: context.accessionNo,
      });

      if (!filing) {
        return {
          error: `Selected filing ${context.accessionNo} was not found in collector DB`,
        };
      }

      const documentResult = await loadFilingDocument({ filing });

      const normalizedStyle: SummaryStyle = style;
      const { summary, reasoningTrace } = await summarizeFilingByStyle({
        companyName: filing.companyName,
        formType: filing.formType,
        filingDate: filing.filingDate,
        sections: documentResult.sections,
        style: normalizedStyle,
      });

      return {
        filing,
        style: normalizedStyle,
        summary,
        reasoningTrace,
      };
    },
  });
