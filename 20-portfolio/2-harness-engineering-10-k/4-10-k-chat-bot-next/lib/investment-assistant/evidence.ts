import type { GraphEvidence } from "@/lib/investment-assistant/types";

export function dedupeGraphEvidence(
  evidenceBundle: GraphEvidence[] | null | undefined
) {
  if (!Array.isArray(evidenceBundle)) {
    return [];
  }

  const seen = new Set<string>();

  return evidenceBundle.filter((evidence) => {
    const key = [
      evidence.filingId ?? "filing",
      evidence.itemCode ?? "item",
      evidence.nodeType ?? "node",
      evidence.citationLabel ?? "citation",
      evidence.text.replace(/\s+/g, " ").trim(),
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
