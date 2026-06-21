"use client";

import { Badge } from "@/components/ui/badge";
import type { FilingProvenanceState } from "@/lib/investment-assistant/types";

export function formatDocumentSourceLabel(
  source: FilingProvenanceState["documentSource"] | undefined
) {
  if (source === "downloaded-local-file") {
    return "Downloaded local file";
  }

  if (source === "sec-archive-url") {
    return "SEC archive";
  }

  return "Metadata only";
}

export function formatParserStatus(status: string | null | undefined) {
  const normalized = status?.trim();
  return normalized || "not parsed";
}

export function formatCollectorUpdatedAt(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

export function formatFreshnessStatus(
  status: FilingProvenanceState["freshnessStatus"] | undefined
) {
  if (status === "current") {
    return "current";
  }

  if (status === "stale") {
    return "refresh recommended";
  }

  return "unknown";
}

export function FilingProvenanceBadges({
  provenance,
}: {
  provenance: FilingProvenanceState | undefined;
}) {
  const freshnessVariant =
    provenance?.freshnessStatus === "stale"
      ? "destructive"
      : provenance?.freshnessStatus === "current"
        ? "secondary"
        : "outline";

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">Collector DB</Badge>
      <Badge variant={provenance?.hasLocalFile ? "secondary" : "outline"}>
        {formatDocumentSourceLabel(provenance?.documentSource)}
      </Badge>
      <Badge variant="outline">
        Parser: {formatParserStatus(provenance?.parserStatus)}
      </Badge>
      <Badge variant={freshnessVariant}>
        Freshness: {formatFreshnessStatus(provenance?.freshnessStatus)}
      </Badge>
    </div>
  );
}
