import { createParser, type LibrarySpec } from "@openuidev/lang-core";
import spec from "@/generated/spec.json";
const library: LibrarySpec = spec;

const PDF_COMPONENTS = new Set([
  "Col", "Row", "Box", "Grid", "Card", "Divider", "Spacer", "Title", "Text", "Caption", "Label",
  "Badge", "List", "ListItem", "Markdown", "Quote", "Code", "Math", "Table", "Chart", "Icon",
  "Svg", "G", "Circle", "Ellipse", "Rect", "Line", "Path", "Polyline", "Polygon", "SvgText",
]);

export async function POST(request: Request) {
  try {
    const { program, mode = "interactive" } = await request.json();
    if (!["report", "interactive", "pdf", "ui"].includes(mode)) return Response.json({ errors: ["Invalid validation mode"] }, { status: 400 });
    if (typeof program !== "string" || program.length > 250000) return Response.json({ errors: ["Invalid program size"] }, { status: 400 });
    const result = createParser(library.schema!, library.root).parse(program);
    const errors = result.meta.errors.map(e => e.message);
    if (!result.root) errors.push("Missing root = Col(...) declaration");
    if (result.meta.unresolved.length) errors.push(`Unresolved references: ${result.meta.unresolved.join(", ")}`);
    const code = program.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/\/\/[^\n]*/g, "");
    if (/[^\x00-\x7F]/.test(code)) errors.push("Use ASCII-only identifiers and object keys. Korean belongs inside quoted text values, not data keys or property access.");
    if (mode !== "ui") {
      if ((code.match(/\bChart\s*\(/g) ?? []).length < 3) errors.push("Provide at least 3 meaningful charts with separate units.");
      if ((code.match(/\bTable\s*\(/g) ?? []).length > 2) errors.push("Use at most 2 detail tables. Replace primary tables with insight cards, charts, and ranked action cards.");
      if (mode === "pdf") {
        if (/\$[A-Za-z_]\w*/.test(code)) errors.push("PDF reports cannot contain $state or state-dependent filtering. Show all comparisons statically.");
        const unsupported = [...new Set([...code.matchAll(/(?<![@\w])([A-Z]\w*)\s*\(/g)].map(match => match[1]).filter(name => !PDF_COMPONENTS.has(name)))];
        if (unsupported.length) errors.push(`PDF reports allow static components only. Replace ${unsupported.join(", ")} with fully visible sections.`);
        if (/@(?:Set|Reset|ToAssistant|OpenUrl|CopyToClipboard|Query|Mutation)\s*\(/.test(code)) errors.push("PDF reports cannot require actions or data fetching.");
      } else if (!/\b(Select|SegmentedControl)\s*\(\s*\$/.test(code) || !/\$[A-Za-z_]\w*\s*=/.test(code)) {
        errors.push("Include a working $state-bound Select or SegmentedControl with a defined initial value and a chart/data filter that uses it.");
      }
    }
    return Response.json({ errors });
  } catch { return Response.json({ errors: ["OpenUI program could not be parsed"] }); }
}
