import { createParser, jsonToOpenUI, split, tokenize, type Library } from "@openuidev/lang-core";
import spec from "@/generated/spec.json";

/** Validate the exact generated catalog, plus the report's required composition. */
export function reportProblems(program: string, source?: string, profile: "vendor" | "general" = "vendor"): string[] {
  const parsed = createParser(spec.schema, spec.root).parse(program);
  const problems = parsed.meta.errors.map((error) => error.message);
  if (parsed.meta.incomplete) problems.push("Incomplete OpenUI program; finish every expression and component");
  if (/\?[^\n]*:\s*\n/.test(program)) problems.push("Put the ENTIRE ternary assignment on one physical line, including all branches; newline after ':' drops report tabs");
  if (/\]\s*\+\s*(?:@Each\(|\[)/.test(program)) problems.push("Join arrays with @Concat(list, more), not the + operator");
  if (!parsed.root) problems.push("Missing Col root");
  if (parsed.meta.unresolved.length) problems.push(`Undeclared references: ${parsed.meta.unresolved.join(", ")}`);
  if (parsed.meta.orphaned.length) problems.push(`Unreachable statements: ${parsed.meta.orphaned.join(", ")}`);
  const required = profile === "vendor" ? [["Chart", 3], ["Card", 4], ["Grid", 1], ["Select", 1], ["Slider", 1], ["Pressable", 1]] as const : [["Title", 3], ["Card", 2], ["Text", 2]] as const;
  for (const [name, minimum] of required) {
    if ((program.match(new RegExp(`\\b${name}\\(`, "g")) ?? []).length < minimum) {
      problems.push(`Report requires at least ${minimum} ${name} call(s)`);
    }
  }
  if (/\bSegmentedControl\(/.test(program)) problems.push("Render all report sections continuously; no SegmentedControl tabs");
  if (/[{,]\s*[가-힣]+\s*:\s*[a-zA-Z_]\w*\./.test(program)) problems.push("Quote non-ASCII projection keys to preserve chart values");
  if (profile === "vendor") {
    if (!program.includes("@CopyToClipboard(")) problems.push("Add a copyable action summary");
    if (!program.includes("@Toggle(")) problems.push("Checklist must toggle $done");
    if (!program.includes("@Filter(")) problems.push("Campaign Select must filter chart rows and diagnosis cards");
  }
  if (/\b(?:Query|Mutation|HtmlView)\(/.test(program)) problems.push("Use supplied literal source rows only; no Query/Mutation/HtmlView");
  if (source) {
    const missing = [...new Set(source.match(/(?:CAMP|VID)_\d+/g))].filter((id) => !program.includes(id));
    if (missing.length) problems.push(`Keep all source IDs accessible in report evidence: ${missing.join(", ")}`);
  }
  return problems;
}

/** Model-authored commentary cannot replace source-derived chart data or controls. */
export function insightExpression(program: string, equalBudget = false): string | null {
  const assignments = split(tokenize(program));
  if (assignments.length !== 1 || assignments[0].id !== "root" || !/^\s*root\s*=/.test(program)) return null;
  const parsed = createParser(spec.schema, spec.root).parse(program);
  if (!parsed.root || parsed.meta.incomplete || parsed.meta.errors.length || parsed.meta.unresolved.length) return null;
  const allowed = new Set(["Col", "Row", "Card", "Title", "Text", "Caption", "Badge", "Popover", "List", "ListItem", "Icon"]);
  let valid = true;
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, unknown>;
    if (object.type === "element" && !allowed.has(String(object.typeName))) valid = false;
    if ("k" in object) valid = false; // No state, functions, actions or expressions in commentary.
    if (object.type === "element" && object.props && typeof object.props === "object") {
      const props = object.props as Record<string, unknown>;
      if (typeof props.text === "string") {
        const text = props.text;
        const recommendsIncrease = /예산.{0,30}증액|증액.{0,30}예산/.test(text);
        const confirmsFirst = /(?:확인|검증|검토).{0,15}(?:필요|먼저|후)|동일|같으|증액.{0,15}(?:권장하지|권하지|보류|불가)/.test(text);
        if (equalBudget && recommendsIncrease && !confirmsFirst) {
          props.text = "현재 예산과 추천 예산이 같은 행이 있어 증액 실행 전 원문 수치 확인이 필요합니다. 이 문장은 원문 예산 동일 점검으로 대체되었습니다.";
        }
        props.text = String(props.text).replace(/(?<!`)\b(?:CAMP|VID)_\d+\b(?!`)/g, (id) => `\`${id}\``);
      }
    }
    for (const item of Object.values(object)) visit(item);
  };
  visit(parsed.root);
  if (!valid) return null;
  // The public serializer only consumes toJSONSchema; use the generated catalog
  // rather than importing browser components/CSS into a server route.
  const schemaLibrary = { toJSONSchema: () => spec.schema } as unknown as Library;
  return jsonToOpenUI(parsed.root, schemaLibrary).replace(/^\s*root\s*=\s*/, "").trim();
}
