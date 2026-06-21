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
  DecisionQualityCheck,
  DecisionQualityState,
} from "@/lib/investment-assistant/types";

function formatStatus(status: DecisionQualityState["status"]) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "review-needed") {
    return "Review needed";
  }

  return "Blocked";
}

function formatCheckStatus(status: DecisionQualityCheck["status"]) {
  if (status === "pass") {
    return "Pass";
  }

  if (status === "warn") {
    return "Review";
  }

  return "Blocker";
}

function checkVariant(status: DecisionQualityCheck["status"]) {
  if (status === "pass") {
    return "secondary";
  }

  if (status === "warn") {
    return "outline";
  }

  return "destructive";
}

function headlineVariant(status: DecisionQualityState["status"]) {
  if (status === "ready") {
    return "default";
  }

  if (status === "review-needed") {
    return "secondary";
  }

  return "destructive";
}

export function InvestmentDecisionQualityCard({
  decisionQuality,
  compact = false,
}: {
  decisionQuality: DecisionQualityState | null | undefined;
  compact?: boolean;
}) {
  return (
    <Card className="border-border bg-card/80 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.25)]">
      <CardHeader className={compact ? "pb-3" : "pb-3"}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className={compact ? "text-base" : "text-lg"}>
            Decision Quality
          </CardTitle>
          {decisionQuality ? (
            <Badge variant={headlineVariant(decisionQuality.status)}>
              {formatStatus(decisionQuality.status)}
            </Badge>
          ) : (
            <Badge variant="outline">Not ready</Badge>
          )}
        </div>
        <CardDescription>
          Evidence, freshness, and runtime checks before using the brief.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {decisionQuality ? (
          <>
            <p className="text-muted-foreground">{decisionQuality.summary}</p>
            <div className="space-y-2">
              {decisionQuality.checks.map((check) => (
                <div
                  className="rounded-xl border border-border bg-muted/50 px-3 py-2"
                  key={`${check.label}-${check.status}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {check.label}
                    </span>
                    <Badge variant={checkVariant(check.status)}>
                      {formatCheckStatus(check.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {check.detail}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            Build an investment brief with filing text and graph evidence first.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
