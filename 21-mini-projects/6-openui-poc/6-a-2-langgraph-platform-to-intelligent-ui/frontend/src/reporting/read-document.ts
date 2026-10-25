import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_CHARS } from "./report-prompt";

/** Parse HTML in an inert document; send text/tables, never executable markup. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, iframe, object, template, nav, header, footer").forEach((node) => node.remove());
  const root = doc.querySelector("article, main") ?? doc.body;
  const inline = (node: Element) => (node.textContent ?? "").replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  function walk(node: Element) {
    if (node.tagName === "TABLE") {
      const rows = Array.from(node.querySelectorAll("tr"), (row) => Array.from(row.children, (cell) => inline(cell).replace(/\|/g, "\\|")));
      if (rows.length) {
        lines.push(`| ${rows[0].join(" | ")} |`, `| ${rows[0].map(() => "---").join(" | ")} |`,
          ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`), "");
      }
    } else if (/^H[1-6]$/.test(node.tagName)) {
      lines.push(`${"#".repeat(Number(node.tagName[1]))} ${inline(node)}`, "");
    } else if (["P", "BLOCKQUOTE", "LI"].includes(node.tagName)) {
      lines.push(inline(node), "");
    } else {
      for (const child of node.children) walk(child);
    }
  }
  walk(root);
  return lines.join("\n").trim();
}

export async function readReportDocument(file: File): Promise<string> {
  if (!/\.(md|markdown|txt|html?)$/i.test(file.name)) throw new Error("Markdown, HTML, TXT 파일을 선택해 주세요.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("파일 크기는 500KB까지 지원합니다.");
  const raw = await file.text();
  const text = /\.html?$/i.test(file.name) ? htmlToMarkdown(raw) : raw;
  if (!text.trim()) throw new Error("문서에 읽을 수 있는 본문이 없습니다.");
  if (text.length > MAX_DOCUMENT_CHARS) throw new Error("문서 본문은 120,000자까지 불러올 수 있습니다.");
  return text;
}
