"use client";

import { defineComponent } from "@openuidev/react-lang";
import { useEffect, useState } from "react";
import { z } from "zod";

const CodeBlockSchema = z.object({
  code: z.string(),
  language: z.string().optional(),
  title: z.string().optional(),
});

export const CodeBlock = defineComponent({
  name: "CodeBlock",
  props: CodeBlockSchema,
  description: "Copyable syntax-highlighted code block. Unknown languages render as plain text.",
  component: function RenderCodeBlock({ props }) {
    const code = String(props.code ?? "");
    const [highlighted, setHighlighted] = useState<{code:string;language:string;html:string} | null>(null);
    const [copyStatus, setCopyStatus] = useState("");
    const language = props.language ?? "text";
    useEffect(() => {
      let active = true;
      import("@/lib/code-highlighter").then(({highlightCode}) => highlightCode(code, language))
        .then(html => { if (active) setHighlighted({code, language, html}); })
        .catch(() => { /* Plain text remains available when highlighting cannot load. */ });
      return () => { active = false; };
    }, [code, language]);
    const html = highlighted?.code === code && highlighted.language === language ? highlighted.html : null;
    return <section className="rounded-lg border bg-muted">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2 text-xs">
        <span>{props.title ?? language}</span>
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(code); setCopyStatus("Copied"); }
          catch { setCopyStatus("Copy unavailable; select the code to copy."); }
        }}>Copy code</button>
        <span role="status">{copyStatus}</span>
      </header>
      {html ? <div className="overflow-x-auto p-4 text-sm [&_pre]:!bg-transparent" dangerouslySetInnerHTML={{__html:html}} /> : <pre className="overflow-x-auto p-4"><code>{code}</code></pre>}
    </section>;
  },
});
