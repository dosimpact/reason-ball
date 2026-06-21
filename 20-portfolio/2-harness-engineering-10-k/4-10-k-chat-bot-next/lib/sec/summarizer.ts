/**
 * Filing summarization module.
 *
 * Input: parsed Item sections from filing-loader
 * Output: structured summary JSON + reasoning trace
 * Strategy: LLM primary path, deterministic fallback on model failure
 */
import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { getPriorityItemOrder, pickPrioritySections } from "./filing-loader";
import type {
  FilingSummary,
  ItemSection,
  ReasoningTrace,
  ReasoningTraceStep,
} from "./types";

const summarySchema = z.object({
  executiveSummary: z.string().min(20),
  keyBullets: z.array(z.string().min(5)).min(3).max(8),
  keyRisks: z.array(z.string().min(5)).min(2).max(8),
  evidence: z
    .array(
      z.object({
        itemCode: z.string(),
        rationale: z.string().min(5),
      })
    )
    .min(3)
    .max(10),
  oneLiner: z.string().min(10),
});

function getSummaryModelId() {
  return process.env.SEC_SUMMARY_MODEL || "openai/gpt-4.1-mini";
}

function getTitleForStyle(style: SummaryStyle) {
  if (style === "risk_focus") {
    return "Risk-focused summary";
  }

  if (style === "short") {
    return "Short investor summary";
  }

  if (style === "key_info_first") {
    return "Key info first summary";
  }

  return "Executive summary";
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
  style,
}: {
  sections: ItemSection[];
  style: SummaryStyle;
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

  const uncertainties = steps
    .filter((step) => step.status === "missing")
    .map((step) => `${step.title} section missing from parsed output`);

  return {
    selectedOrder: priorityOrder,
    steps,
    toolLog: [
      "Loaded filing text from collector local file",
      "Extracted Item sections with regex-first strategy",
      `Applied summary mode: ${style}`,
      "Generated grounded summary with Item evidence",
    ],
    uncertainties,
  };
}

export type SummaryStyle =
  | "executive"
  | "short"
  | "risk_focus"
  | "key_info_first";

export async function summarizeFilingByStyle({
  companyName,
  formType,
  filingDate,
  sections,
  style,
}: {
  companyName: string;
  formType: string;
  filingDate: string | null;
  sections: ItemSection[];
  style: SummaryStyle;
}): Promise<{ summary: FilingSummary; reasoningTrace: ReasoningTrace }> {
  // Optionally reorder sections to enforce item-priority reading strategy.
  const orderedSections =
    style === "key_info_first" ? pickPrioritySections(sections) : sections;

  const sectionsForPrompt =
    orderedSections.length > 0 ? orderedSections : sections;
  const trace = buildTrace({ sections: sectionsForPrompt, style });

  const sectionContext = buildSectionContext(sectionsForPrompt);

  const styleGuide = {
    executive:
      "Write balanced executive summary in plain Korean. Focus on business model, performance drivers, and downside risks.",
    short:
      "Write concise summary for quick read in Korean. Keep each bullet short and actionable.",
    risk_focus:
      "Prioritize downside scenarios, balance sheet constraints, and legal/regulatory risks in Korean.",
    key_info_first:
      "Read in this order: Item 1 -> 1A -> 7 -> 8 -> 3. Emphasize 1/1A/7/8. Treat 2/3 as supporting unless material issue.",
  }[style];

  const prompt = [
    `Company: ${companyName}`,
    `Form: ${formType}`,
    `Filing date: ${filingDate ?? "unknown"}`,
    `Mode: ${getTitleForStyle(style)}`,
    "",
    "Instructions:",
    styleGuide,
    "Return grounded facts only. If uncertain, mention uncertainty.",
    "Always include evidence item mapping.",
    "",
    "Filing sections:",
    sectionContext,
  ].join("\n");

  let summary: FilingSummary;

  try {
    const { object } = await generateObject({
      model: getLanguageModel(getSummaryModelId()),
      schema: summarySchema,
      prompt,
    });
    summary = object;
  } catch {
    const topSections = sectionsForPrompt.slice(0, 4);

    summary = {
      executiveSummary:
        `${companyName} ${formType} (${filingDate ?? "unknown date"}) 기준으로 핵심 Item을 우선 검토한 요약입니다. ` +
        "상세 모델 요약이 실패하여 규칙 기반 fallback 결과를 제공합니다.",
      keyBullets: topSections.map(
        (section) =>
          `Item ${section.itemCode}: ${section.content.slice(0, 180).replaceAll(/\n+/g, " ")}...`
      ),
      keyRisks: [
        "Item 1A 및 MD&A에서 직접 확인된 리스크 문구를 추가 검증하세요.",
        "원문 파싱 누락 가능성이 있어 Item 헤더 매핑 정확도를 점검하세요.",
      ],
      evidence: topSections.map((section) => ({
        itemCode: section.itemCode,
        rationale: section.title || "Section excerpt used in fallback summary",
      })),
      oneLiner: "핵심 Item(1/1A/7/8) 중심으로 재검토가 필요한 상태입니다.",
    };
  }

  return {
    summary,
    reasoningTrace: trace,
  };
}
