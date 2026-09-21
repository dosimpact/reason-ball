// Adapted from shadcn/ui new-york-v4 registry (MIT); see SHADCN-LICENSE.md.
import * as React from "react";
import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn("ui-textarea", className)}
      {...props}
    />
  );
}

export { Textarea };
