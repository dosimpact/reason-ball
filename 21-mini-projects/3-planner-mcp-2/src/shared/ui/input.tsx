// Adapted from shadcn/ui new-york-v4 registry (MIT); see SHADCN-LICENSE.md.
import * as React from "react";
import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("ui-input", className)}
      {...props}
    />
  );
}

export { Input };
