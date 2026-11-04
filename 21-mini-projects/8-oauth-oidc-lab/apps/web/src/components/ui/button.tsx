import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-cyan-300 px-4 py-2.5 text-slate-950 hover:bg-cyan-200",
        secondary: "border border-slate-700 bg-slate-900 px-4 py-2.5 text-slate-100 hover:border-slate-500 hover:bg-slate-800",
        destructive: "border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-rose-200 hover:bg-rose-500/20",
        ghost: "px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white",
      },
      size: {
        default: "h-10",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
