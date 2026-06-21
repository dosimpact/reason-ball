import { tool } from "ai";
import { z } from "zod";
import {
  listCompanyFilings as listCompanyFilingsFromRepo,
  searchCompanies,
} from "@/lib/sec/repository";

export const listCompanyFilings = tool({
  description:
    "List SEC filing documents for a company. Use this when user asks for business report list, filing list, or recent 10-K/10-Q documents.",
  inputSchema: z.object({
    companyQuery: z
      .string()
      .min(1)
      .describe(
        "Company name, ticker, or CIK. Example: AAPL, Apple, 0000320193"
      ),
    forms: z
      .array(z.string())
      .optional()
      .describe("Optional form filter. Example: ['10-K', '10-Q']"),
    limit: z.number().int().min(1).max(30).optional().default(10),
    cursor: z.number().int().min(0).optional().default(0),
  }),
  execute: async ({ companyQuery, forms, limit, cursor }) => {
    const result = await listCompanyFilingsFromRepo({
      companyQuery,
      forms,
      limit,
      cursor,
    });

    if (!result) {
      const candidates = await searchCompanies({ companyQuery, limit: 5 });

      return {
        error: `Could not find a company matching "${companyQuery}"`,
        candidates,
      };
    }

    return {
      company: result.company,
      filings: result.filings,
      pagination: {
        cursor,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
      reasoningTrace: {
        selectedOrder: ["filing_date DESC"],
        steps: [
          {
            title: "Resolve company",
            detail: `Matched ${result.company.name} (${result.company.ticker ?? "N/A"})`,
            status: "used",
          },
          {
            title: "Apply form filter",
            detail:
              forms && forms.length > 0
                ? `Filtered by forms: ${forms.join(", ")}`
                : "No form filter; used all tracked forms",
            status: "used",
          },
        ],
        toolLog: [
          "Queried companies table",
          "Queried filings table ordered by recent date",
        ],
        uncertainties: [],
      },
    };
  },
});
