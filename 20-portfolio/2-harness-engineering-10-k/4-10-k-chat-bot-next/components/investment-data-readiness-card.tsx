"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  InvestmentDataReadiness,
  InvestmentDataReadinessStatus,
} from "@/lib/investment-assistant/readiness";

function statusVariant(status: InvestmentDataReadinessStatus) {
  if (status === "blocked") {
    return "destructive";
  }

  if (status === "ready") {
    return "secondary";
  }

  return "outline";
}

function statusText(status: InvestmentDataReadinessStatus) {
  if (status === "needs_action") {
    return "Action needed";
  }

  if (status === "ready") {
    return "Ready";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Unknown";
}

export function InvestmentDataReadinessCard({
  readiness,
  compact = false,
}: {
  readiness: InvestmentDataReadiness;
  compact?: boolean;
}) {
  return (
    <Card className="border-border bg-card/80 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className={compact ? "text-base" : "text-lg"}>
            Data Readiness
          </CardTitle>
          <Badge variant={statusVariant(readiness.status)}>
            {readiness.label}
          </Badge>
        </div>
        <CardDescription>
          Filing catalog, local text, parser graph, freshness, and runtime
          dependencies before analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{readiness.summary}</p>
        <div className="space-y-2">
          {readiness.items.map((item) => (
            <div
              className="rounded-lg border border-border bg-muted/45 px-3 py-2"
              key={item.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {item.label}
                </span>
                <Badge variant={statusVariant(item.status)}>
                  {statusText(item.status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.detail}
              </p>
              {item.action ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.action}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
