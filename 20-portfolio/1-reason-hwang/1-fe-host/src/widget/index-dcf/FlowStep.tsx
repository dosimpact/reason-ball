import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FlowStepProps = {
  children: ReactNode;
  description: string;
  id: string;
  step: number;
  title: string;
  className?: string;
};

export function FlowStep({
  children,
  className,
  description,
  id,
  step,
  title,
}: FlowStepProps) {
  return (
    <section aria-labelledby={`${id}-title`} className={className}>
      <Card className="gap-0 overflow-visible py-0">
        <CardHeader className="border-b py-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            >
              {step}
            </span>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base" id={`${id}-title`}>
                {title}
              </CardTitle>
              <CardDescription className="max-w-3xl text-xs leading-5">
                {description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-4">{children}</CardContent>
      </Card>
    </section>
  );
}

export function FlowConnector() {
  return (
    <div aria-hidden="true" className="hidden h-10 items-center justify-center sm:flex">
      <svg className="h-8 w-6 text-border" viewBox="0 0 24 32">
        <path
          d="M12 1v24m-6-6 6 6 6-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string;
  accent?: boolean;
  delta?: string;
  warning?: boolean;
};

export function Metric({ accent, delta, label, value, warning }: MetricProps) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background p-3",
        accent && "border-primary/30 bg-primary/5",
        warning && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
      )}
    >
      <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {delta ? (
        <dd className="mt-1 text-[0.6875rem] text-muted-foreground">{delta}</dd>
      ) : null}
    </div>
  );
}

export function CalculationUnavailable({
  reasons,
}: {
  reasons: readonly string[];
}) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium text-destructive">Calculation unavailable</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}
