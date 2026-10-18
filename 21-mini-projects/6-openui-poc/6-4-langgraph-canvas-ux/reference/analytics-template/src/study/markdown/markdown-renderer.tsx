"use client";

import { cn } from "@/study/utils";
import { cva } from "class-variance-authority";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { z } from "zod/v3";

export const markdownArtifactSchema = z.object({
  title: z.string().optional(),
  content: z.string().describe("Markdown content to render"),
  variant: z.enum(["default", "bordered", "callout"]).optional(),
  className: z.string().optional(),
});

export type MarkdownRendererProps = z.infer<typeof markdownArtifactSchema>;

const markdownVariants = cva(
  "w-full rounded-lg bg-background text-foreground overflow-hidden",
  {
    variants: {
      variant: {
        default: "",
        bordered: "border border-border",
        callout: "border-l-4 border-l-primary bg-muted/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export const MarkdownRenderer = React.forwardRef<
  HTMLDivElement,
  MarkdownRendererProps
>(({ title, content, variant, className }, ref) => {
  return (
    <section
      ref={ref}
      className={cn(markdownVariants({ variant }), className)}
      data-testid="markdown-renderer"
    >
      <div className="p-4">
        {title && (
          <h3 className="text-lg font-medium mb-3 text-foreground">{title}</h3>
        )}
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-semibold mb-3">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold mb-2">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold mb-2">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-6 text-foreground mb-3 last:mb-0">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc pl-5 text-sm leading-6 mb-3">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal pl-5 text-sm leading-6 mb-3">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="mb-1">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground my-3">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="rounded-md bg-muted p-3 overflow-auto text-xs mb-3">
                {children}
              </pre>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                className="text-primary underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </section>
  );
});
MarkdownRenderer.displayName = "MarkdownRenderer";
