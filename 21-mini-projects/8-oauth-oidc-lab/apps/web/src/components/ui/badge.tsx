import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", {
  variants: {
    variant: {
      default: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
      success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      warning: "border-amber-400/30 bg-amber-400/10 text-amber-300",
      muted: "border-slate-700 bg-slate-800/60 text-slate-400",
      danger: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
