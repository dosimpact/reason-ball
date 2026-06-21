import { tool } from "ai";
import { z } from "zod";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { buildInvestmentDecisionBriefFromFiling } from "@/lib/sec/investment-brief";
import { getFilingByIdentity } from "@/lib/sec/repository";
import { getSelectedFilingContext } from "@/lib/sec/session-context";

export const buildInvestmentDecisionBrief = ({ chatId }: { chatId: string }) =>
  tool({
    description:
      "Build an investment decision brief from the currently selected filing. Use this when user asks for investment judgement framework from 10-K/10-Q.",
    inputSchema: z.object({
      riskTolerance: z.string().optional(),
      timeHorizon: z.string().optional(),
    }),
    execute: async ({ riskTolerance, timeHorizon }) => {
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

      const { brief, reasoningTrace } =
        await buildInvestmentDecisionBriefFromFiling({
          companyName: filing.companyName,
          formType: filing.formType,
          filingDate: filing.filingDate,
          sections: documentResult.sections,
          riskTolerance,
          timeHorizon,
        });

      return {
        filing,
        brief,
        reasoningTrace,
      };
    },
  });
