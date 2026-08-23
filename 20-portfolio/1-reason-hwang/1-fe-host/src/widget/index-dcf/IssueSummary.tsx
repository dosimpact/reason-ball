import { AlertCircle, AlertTriangle, CircleCheck } from "lucide-react";

import type { ValidationIssue } from "@/utils/index-dcf/types";

export function IssueSummary({ issues }: { issues: readonly ValidationIssue[] }) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return (
    <div className="grid gap-3 @2xl/dcf:grid-cols-2">
      <IssueRegion
        emptyMessage="All assumptions are valid."
        issues={errors}
        label="Errors"
        type="error"
      />
      <IssueRegion
        emptyMessage="No sensitivity or payout warnings."
        issues={warnings}
        label="Warnings"
        type="warning"
      />
    </div>
  );
}

function IssueRegion({
  emptyMessage,
  issues,
  label,
  type,
}: {
  emptyMessage: string;
  issues: readonly ValidationIssue[];
  label: string;
  type: "error" | "warning";
}) {
  const Icon = type === "error" ? AlertCircle : AlertTriangle;

  return (
    <section
      aria-label={label}
      className={
        type === "error"
          ? "rounded-md border border-destructive/30 bg-destructive/5 p-3"
          : "rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
      }
    >
      <h3 className="flex items-center gap-2 text-xs font-semibold text-foreground">
        {issues.length > 0 ? (
          <Icon
            aria-hidden="true"
            className={type === "error" ? "size-4 text-destructive" : "size-4 text-amber-700 dark:text-amber-400"}
          />
        ) : (
          <CircleCheck aria-hidden="true" className="size-4 text-emerald-700 dark:text-emerald-400" />
        )}
        {label} ({issues.length})
      </h3>
      {issues.length > 0 ? (
        <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
          {issues.map((issue) => (
            <li className="flex gap-2" key={issue.id}>
              <span aria-hidden="true">•</span>
              {issue.fieldId ? (
                <a className="underline decoration-dotted underline-offset-2" href={`#${toDomFieldId(issue.fieldId)}`}>
                  {issue.message}
                </a>
              ) : (
                <span>{issue.message}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </section>
  );
}

function toDomFieldId(fieldId: string) {
  if (fieldId === "indexName" || fieldId === "valuationDate") {
    return fieldId;
  }

  return `${fieldId.replaceAll(".", "-")}-number`;
}
