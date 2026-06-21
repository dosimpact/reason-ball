import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { saveDocument } from "@/lib/db/queries";
import { loadFilingDocument } from "@/lib/sec/filing-loader";
import { getLatestFiling, searchCompanies } from "@/lib/sec/repository";
import { setSelectedFilingContext } from "@/lib/sec/session-context";
import { generateUUID } from "@/lib/utils";

type OpenLatestFilingFullTextProps = {
  chatId: string;
  session: Session;
};

export const openLatestFilingFullText = ({
  chatId,
  session,
}: OpenLatestFilingFullTextProps) =>
  tool({
    description:
      "Open the latest filing full text for a company. Use this when user asks to read the full report text (especially 10-K/10-Q).",
    inputSchema: z.object({
      companyQuery: z
        .string()
        .min(1)
        .describe("Company name, ticker, or CIK. Example: AAPL, Apple"),
      targetPeriod: z
        .enum(["annual", "quarterly", "auto"])
        .optional()
        .default("auto")
        .describe("quarterly prefers 10-Q, annual prefers 10-K"),
      preferForm: z
        .string()
        .optional()
        .describe("Optional explicit form preference. Example: 10-K"),
    }),
    execute: async ({ companyQuery, targetPeriod, preferForm }) => {
      const filing = await getLatestFiling({
        companyQuery,
        targetPeriod,
        preferForm,
      });

      if (!filing) {
        const candidates = await searchCompanies({ companyQuery, limit: 5 });

        return {
          error: `Could not find filing for "${companyQuery}"`,
          candidates,
        };
      }

      const documentResult = await loadFilingDocument({ filing });

      const documentId = generateUUID();
      const documentTitle = `${filing.companyName} ${filing.formType} ${filing.filingDate ?? "unknown-date"}`;

      if (session.user?.id) {
        await saveDocument({
          id: documentId,
          title: documentTitle,
          kind: "text",
          content: documentResult.markdown,
          userId: session.user.id,
        });
      }

      setSelectedFilingContext({
        chatId,
        cik: filing.cik,
        accessionNo: filing.accessionNo,
        formType: filing.formType,
        filingDate: filing.filingDate,
        reportDate: filing.reportDate,
        companyName: filing.companyName,
        ticker: filing.ticker,
        filingUrl: filing.filingUrl,
        filePath: filing.filePath,
        documentId,
        documentTitle,
        toc: documentResult.toc,
      });

      const selectedByRule =
        targetPeriod === "quarterly"
          ? "quarterly keyword -> 10-Q priority"
          : targetPeriod === "annual"
            ? "annual keyword -> 10-K priority"
            : "auto mode default priority";

      return {
        filing,
        document: {
          id: documentId,
          title: documentTitle,
          kind: "text",
        },
        reader: {
          toc: documentResult.toc,
          keyItems: documentResult.keyItems,
          preview: documentResult.markdown.slice(0, 1500),
        },
        reasoningTrace: {
          selectedOrder: ["1", "1A", "7", "8", "3"],
          steps: [
            {
              title: "Resolve company and filing",
              detail: `Selected ${filing.formType} filed on ${filing.filingDate ?? "unknown"}`,
              status: "used",
            },
            {
              title: "Selection rule",
              detail: selectedByRule,
              status: "derived",
            },
            {
              title: "Parse full text",
              detail: `Extracted ${documentResult.toc.length} Item sections`,
              status: "used",
            },
          ],
          toolLog: [
            "Selected latest filing from collector Postgres",
            "Loaded local filing file",
            "Normalized to Markdown and saved as document",
          ],
          uncertainties:
            documentResult.toc.length === 0
              ? [
                  "Item sections were not detected reliably; using full text fallback",
                ]
              : [],
        },
      };
    },
  });
