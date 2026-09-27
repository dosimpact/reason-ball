import * as React from "react";
import { cn } from "@/shared/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn("input", className)} {...props} />;
}
