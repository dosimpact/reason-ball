// Adapted from shadcn/ui new-york-v4 registry (MIT); see SHADCN-LICENSE.md.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";
const badgeVariants = cva("ui-badge", {
  variants: {
    variant: {
      default: "ui-badge-default",
      secondary: "ui-badge-secondary",
      destructive: "ui-badge-destructive",
      outline: "ui-badge-outline",
    },
  },
  defaultVariants: { variant: "default" },
});
function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}
export { Badge, badgeVariants };
