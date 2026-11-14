"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { useRef, useState, type ReactNode } from "react";

const DialogBlockSchema = z.object({
  triggerLabel: z.string(),
  title: z.string(),
  description: z.string().optional(),
  content: z.array(z.any()).default([]),
  triggerVariant: z
    .enum(["default", "destructive", "outline", "secondary", "ghost", "link"])
    .optional(),
});

export const DialogBlock = defineComponent({
  name: "DialogBlock",
  props: DialogBlockSchema,
  description:
    "Modal dialog triggered by a button. triggerLabel: button text, title/description in header, content: children rendered inside.",
  component: ({ props, renderNode }) => (
    <DialogPreview {...props}>{renderNode(props.content)}</DialogPreview>
  ),
});

function DialogPreview({
  triggerLabel, title, description, triggerVariant, children,
}: Omit<z.infer<typeof DialogBlockSchema>, "content"> & { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button ref={triggerRef} variant={triggerVariant ?? "outline"}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={() => setOpen(false)}
        onCloseAutoFocus={event => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
