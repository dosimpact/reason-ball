/**
 * Investment decision brief generator.
 *
 * Builds a balanced Bull/Bear/Unknown/NextChecks frame from filing sections.
 * Uses LLM structured output first, then a rule-based fallback response.
 */
import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { hasUsableAiGatewayKey } from "@/lib/constants";
import { getPriorityItemOrder, pickPrioritySections } from "./filing-loader";
import type {
  InvestmentDecisionBrief,
  ItemSection,
  ReasoningTrace,
  ReasoningTraceStep,
} from "./types";

const briefSchema = z.object({
  stance: z.enum(["positive", "mixed", "cautious"]),
  conclusion: z.string().min(20),
  bull: z.array(z.string().min(5)).min(2).max(8),
  bear: z.array(z.string().min(5)).min(2).max(8),
  unknowns: z.array(z.string().min(5)).min(2).max(8),
  nextChecks: z.array(z.string().min(5)).min(3).max(8),
  evidence: z
    .array(
      z.object({
        itemCode: z.string(),
        rationale: z.string().min(5),
      })
    )
    .min(4)
    .max(12),
});

const POSITIVE_KEYWORDS = [
  "growth",
  "growing",
  "strong",
  "strength",
  "opportunity",
  "opportunities",
  "expand",
  "expanding",
  "innovation",
  "innovative",
  "demand",
  "customer",
  "customers",
  "ecosystem",
  "competitive",
  "brand",
  "cash",
  "liquidity",
  "profit",
  "profitable",
  "margin",
  "services",
];
const NEGATIVE_KEYWORDS = [
  "risk",
  "risks",
  "adverse",
  "adversely",
  "uncertain",
  "uncertainty",
  "competition",
  "volatile",
  "volatility",
  "supply",
  "shortage",
  "litigation",
  "legal",
  "regulatory",
  "foreign exchange",
  "interest rates",
  "debt",
  "impairment",
  "decline",
  "downward",
  "pressure",
  "loss",
];
const FINANCIAL_KEYWORDS = [
  "revenue",
  "net sales",
  "gross margin",
  "operating income",
  "net income",
  "cash flow",
  "liquidity",
  "debt",
  "capital return",
  "balance sheet",
];
const LEGAL_KEYWORDS = [
  "litigation",
  "legal",
  "regulatory",
  "investigation",
  "proceeding",
  "compliance",
  "penalty",
];

type BriefMode = "model" | "heuristic";
type EvidenceCandidate = {
  itemCode: string;
  title: string;
  snippet: string;
  score: number;
};

function getSummaryModelId() {
  return process.env.SEC_SUMMARY_MODEL || "openai/gpt-4.1-mini";
}

function truncateSectionContent(content: string, maxChars = 9000) {
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}\n\n[...truncated...]`;
}

function buildSectionContext(sections: ItemSection[]) {
  return sections
    .map((section) => {
      const titleSuffix = section.title ? ` - ${section.title}` : "";
      return [
        `### Item ${section.itemCode}${titleSuffix}`,
        truncateSectionContent(section.content),
      ].join("\n\n");
    })
    .join("\n\n");
}

function buildTrace({
  sections,
  mode,
}: {
  sections: ItemSection[];
  mode: BriefMode;
}): ReasoningTrace {
  const priorityOrder = getPriorityItemOrder();
  const byCode = new Map(
    sections.map((section) => [section.itemCode, section])
  );

  const steps: ReasoningTraceStep[] = priorityOrder.map((itemCode) => {
    const section = byCode.get(itemCode);

    if (!section) {
      return {
        title: `Item ${itemCode}`,
        detail: "Section not detected in parsed filing text",
        status: "missing",
      };
    }

    return {
      title: `Item ${itemCode}`,
      detail: `Used ${Math.min(section.content.length, 9000).toLocaleString()} chars from "${section.title || "Untitled"}"`,
      status: "used",
    };
  });

  return {
    selectedOrder: priorityOrder,
    steps,
    toolLog: [
      "Loaded filing text",
      "Prioritized Item 1, 1A, 7, 8 and optional 3",
      mode === "model"
        ? "Generated Bull/Bear/Unknown/Next checks with structured model output"
        : "Generated Bull/Bear/Unknown/Next checks with deterministic filing heuristics",
      "Attached evidence Item mapping",
    ],
    uncertainties: steps
      .filter((step) => step.status === "missing")
      .map((step) => `${step.title} section missing from parsed output`),
  };
}

function normalizeSnippetText(input: string) {
  return input
    .replaceAll(/\s+/g, " ")
    .replaceAll(/\s+([,.;:])/g, "$1")
    .trim();
}

function truncateForDisplay(input: string, maxChars = 220) {
  const normalized = normalizeSnippetText(input);

  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3).trim()}...`;
}

function splitSectionSnippets(content: string) {
  const rawParts = content
    .replaceAll(/\r\n?/g, "\n")
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((part) => normalizeSnippetText(part))
    .filter((part) => {
      if (part.length < 60 || part.length > 360) {
        return false;
      }

      if (/\|\s+\d{4}\s+form\s+10-[kq]/i.test(part)) {
        return false;
      }

      return !/^item\s+\d+/i.test(part);
    });

  if (rawParts.length === 0) {
    const fallback = truncateForDisplay(content, 260);
    return fallback ? [fallback] : [];
  }

  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const part of rawParts) {
    const key = part.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(part);
  }

  return deduped;
}

function countKeywordMatches(text: string, keywords: string[]) {
  const lowered = text.toLowerCase();
  let matches = 0;

  for (const keyword of keywords) {
    if (lowered.includes(keyword)) {
      matches += 1;
    }
  }

  return matches;
}

function pickEvidenceCandidate({
  section,
  primaryKeywords,
  secondaryKeywords = [],
  penaltyKeywords = [],
}: {
  section: ItemSection | undefined;
  primaryKeywords: string[];
  secondaryKeywords?: string[];
  penaltyKeywords?: string[];
}): EvidenceCandidate | null {
  if (!section) {
    return null;
  }

  const snippets = splitSectionSnippets(section.content);
  let bestCandidate: EvidenceCandidate | null = null;

  for (const snippet of snippets) {
    const primaryMatches = countKeywordMatches(snippet, primaryKeywords);
    const secondaryMatches = countKeywordMatches(snippet, secondaryKeywords);
    const penaltyMatches = countKeywordMatches(snippet, penaltyKeywords);
    const score =
      primaryMatches * 12 +
      secondaryMatches * 4 -
      penaltyMatches * 8 -
      Math.max(0, Math.floor((snippet.length - 180) / 60));

    if (score <= 0 && bestCandidate) {
      continue;
    }

    const candidate: EvidenceCandidate = {
      itemCode: section.itemCode,
      title: section.title,
      snippet: truncateForDisplay(snippet),
      score,
    };

    if (!bestCandidate || candidate.score > bestCandidate.score) {
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  const fallbackSnippet = truncateForDisplay(section.content, 220);
  if (!fallbackSnippet) {
    return null;
  }

  return {
    itemCode: section.itemCode,
    title: section.title,
    snippet: fallbackSnippet,
    score: 1,
  };
}

function dedupeCandidates(candidates: Array<EvidenceCandidate | null>) {
  const seen = new Set<string>();
  const deduped: EvidenceCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const key = `${candidate.itemCode}:${candidate.snippet.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function formatCandidateBullet(candidate: EvidenceCandidate) {
  return `Item ${candidate.itemCode}: ${candidate.snippet}`;
}

function hasObviousFinancialMetrics(section: ItemSection | undefined) {
  if (!section) {
    return false;
  }

  return countKeywordMatches(section.content, FINANCIAL_KEYWORDS) >= 2;
}

function buildHeuristicInvestmentBrief({
  companyName,
  formType,
  filingDate,
  sections,
}: {
  companyName: string;
  formType: string;
  filingDate: string | null;
  sections: ItemSection[];
}): InvestmentDecisionBrief {
  const byCode = new Map(
    sections.map((section) => [section.itemCode, section])
  );

  const bullCandidates = dedupeCandidates([
    pickEvidenceCandidate({
      section: byCode.get("1"),
      primaryKeywords: POSITIVE_KEYWORDS,
      secondaryKeywords: ["products", "services", "customers", "market"],
      penaltyKeywords: NEGATIVE_KEYWORDS,
    }),
    pickEvidenceCandidate({
      section: byCode.get("7"),
      primaryKeywords: FINANCIAL_KEYWORDS,
      secondaryKeywords: POSITIVE_KEYWORDS,
      penaltyKeywords: ["decline", "pressure", "risk"],
    }),
    pickEvidenceCandidate({
      section: byCode.get("8"),
      primaryKeywords: FINANCIAL_KEYWORDS,
      secondaryKeywords: ["cash", "liquidity", "capital return"],
      penaltyKeywords: ["loss", "impairment"],
    }),
  ]).slice(0, 3);

  const bearCandidates = dedupeCandidates([
    pickEvidenceCandidate({
      section: byCode.get("1A"),
      primaryKeywords: NEGATIVE_KEYWORDS,
      secondaryKeywords: ["supply", "competition", "regulatory", "demand"],
    }),
    pickEvidenceCandidate({
      section: byCode.get("7A"),
      primaryKeywords: [
        "market risk",
        "foreign exchange",
        "interest rates",
        "value-at-risk",
      ],
      secondaryKeywords: NEGATIVE_KEYWORDS,
    }),
    pickEvidenceCandidate({
      section: byCode.get("3"),
      primaryKeywords: LEGAL_KEYWORDS,
      secondaryKeywords: NEGATIVE_KEYWORDS,
    }),
    pickEvidenceCandidate({
      section: byCode.get("8"),
      primaryKeywords: ["debt", "liquidity", "loss", "impairment"],
      secondaryKeywords: NEGATIVE_KEYWORDS,
    }),
  ]).slice(0, 4);

  const bull =
    bullCandidates.length > 0
      ? bullCandidates.map(formatCandidateBullet)
      : [
          "Item 1 or Item 7 should be reviewed directly for evidence of durable demand, competitive position, and operating leverage.",
        ];

  const bear =
    bearCandidates.length > 0
      ? bearCandidates.map(formatCandidateBullet)
      : [
          "Risk-bearing sections were not captured cleanly enough; review Item 1A, Item 3, and Item 7A directly before relying on the thesis.",
        ];

  const unknowns = Array.from(
    new Set(
      [
        byCode.has("1A")
          ? "Compare current Item 1A wording against the prior annual filing to see whether key risks are broadening or becoming more severe."
          : "Item 1A risk factors were not detected reliably; confirm the raw filing before taking risk language at face value.",
        hasObviousFinancialMetrics(byCode.get("8"))
          ? "Item 8 contains financial statement context, but revenue, margin, and cash-flow trends should still be extracted into a simple table."
          : "Item 8 did not surface a clear revenue/margin/cash-flow trend in the captured text; direct financial statement review is still required.",
        byCode.has("3")
          ? "Item 3 exists, but routine disclosure and thesis-changing legal exposure still need to be separated manually."
          : "No clear Item 3 legal section was captured; verify whether litigation/regulatory exposure is immaterial or simply missed by parsing.",
      ].filter(Boolean)
    )
  ).slice(0, 3);

  const nextChecks = Array.from(
    new Set(
      [
        byCode.has("1A")
          ? "Compare Item 1A risk language with the prior filing and the latest quarterly filing."
          : "Recover and review the raw risk factors section directly from the filing source.",
        byCode.has("8")
          ? "Extract revenue, gross margin, operating cash flow, and net cash/debt from Item 8 into a trend table."
          : "Re-open Item 8 financial statements and verify balance-sheet and cash-flow durability.",
        byCode.has("3")
          ? "Review Item 3 to separate routine matters from issues that could change the investment thesis."
          : "Check whether material legal or regulatory matters appear outside the captured Item sections.",
        byCode.has("7A")
          ? "Stress-test the thesis for FX, rate, or market-risk sensitivity described in Item 7A."
          : "Check whether the filing includes a separate market-risk discussion that was not captured in the current parsing path.",
      ].filter(Boolean)
    )
  ).slice(0, 4);

  const bullScore = bullCandidates.reduce(
    (sum, candidate) => sum + candidate.score,
    0
  );
  const bearScore =
    bearCandidates.reduce((sum, candidate) => sum + candidate.score, 0) +
    (byCode.has("1A") ? 6 : 0) +
    (byCode.has("3") ? 3 : 0);

  const stance =
    bearScore >= bullScore + 10
      ? "cautious"
      : bullScore >= bearScore + 14 &&
          hasObviousFinancialMetrics(byCode.get("8"))
        ? "positive"
        : "mixed";

  const conclusion =
    stance === "cautious"
      ? `${companyName} ${formType} filed on ${filingDate ?? "unknown date"} reads as cautious. The filing still shows operating strengths, but the risk-bearing items and financial verification steps argue for a conservative stance until Item 8 metrics and current risk language are checked directly.`
      : stance === "positive"
        ? `${companyName} ${formType} filed on ${filingDate ?? "unknown date"} reads as positive, but only conditionally. The business and financial sections support the thesis, while the remaining work is mainly to confirm that risk-factor and legal disclosures are not worsening.`
        : `${companyName} ${formType} filed on ${filingDate ?? "unknown date"} reads as mixed. The filing supports a real operating base, but the investable thesis still depends on confirming risk-factor severity, legal exposure, and financial durability in Item 8.`;

  const evidence = dedupeCandidates([...bullCandidates, ...bearCandidates])
    .slice(0, 6)
    .map((candidate) => ({
      itemCode: candidate.itemCode,
      rationale: candidate.snippet,
    }));

  return {
    stance,
    conclusion,
    bull,
    bear,
    unknowns,
    nextChecks,
    evidence,
  };
}

export async function buildInvestmentDecisionBriefFromFiling({
  companyName,
  formType,
  filingDate,
  sections,
  riskTolerance,
  timeHorizon,
}: {
  companyName: string;
  formType: string;
  filingDate: string | null;
  sections: ItemSection[];
  riskTolerance?: string;
  timeHorizon?: string;
}): Promise<{
  brief: InvestmentDecisionBrief;
  reasoningTrace: ReasoningTrace;
}> {
  // Keep prompt context focused on priority SEC items (1, 1A, 7, 8, 3).
  const prioritizedSections = pickPrioritySections(sections);
  const sectionsForPrompt =
    prioritizedSections.length > 0 ? prioritizedSections : sections;

  const prompt = [
    `Company: ${companyName}`,
    `Form: ${formType}`,
    `Filing date: ${filingDate ?? "unknown"}`,
    `Risk tolerance: ${riskTolerance ?? "not specified"}`,
    `Time horizon: ${timeHorizon ?? "not specified"}`,
    "",
    "Task:",
    "Create an investment decision brief suitable for investor decision support.",
    "Output must be balanced and evidence-based.",
    "Do not make absolute claims. Include uncertainty and additional checks.",
    "Read with priority: Item 1 -> 1A -> 7 -> 8 -> 3.",
    "",
    "Sections:",
    buildSectionContext(sectionsForPrompt),
  ].join("\n");

  let brief: InvestmentDecisionBrief;
  let mode: BriefMode = "heuristic";

  if (hasUsableAiGatewayKey()) {
    try {
      const { object } = await generateObject({
        model: getLanguageModel(getSummaryModelId()),
        schema: briefSchema,
        prompt,
      });
      brief = object;
      mode = "model";
    } catch {
      brief = buildHeuristicInvestmentBrief({
        companyName,
        formType,
        filingDate,
        sections: sectionsForPrompt,
      });
    }
  } else {
    brief = buildHeuristicInvestmentBrief({
      companyName,
      formType,
      filingDate,
      sections: sectionsForPrompt,
    });
  }

  return {
    brief,
    reasoningTrace: buildTrace({ sections: sectionsForPrompt, mode }),
  };
}
