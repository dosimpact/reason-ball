export type CanvasItemSelection = {
  id: string;
  title: string;
  program: string;
  initialState?: Record<string, unknown>;
};

type Statement = { name: string; value: string };

function splitTopLevel(source: string, separators: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth--;
    else if (depth === 0 && separators.includes(char)) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
}

function statementsOf(program: string): Statement[] {
  return splitTopLevel(program, ";\n").flatMap(source => {
    const match = /^(\$?[A-Za-z_][\w]*)\s*=\s*([\s\S]+)$/.exec(source);
    return match ? [{ name: match[1], value: match[2] }] : [];
  });
}

function maskStrings(source: string): string {
  return source.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, match => " ".repeat(match.length));
}

function canvasCalls(source: string): string[] {
  const masked = maskStrings(source);
  const calls: string[] = [];
  const pattern = /\bCanvasItem\s*\(/g;
  for (const match of masked.matchAll(pattern)) {
    const open = match.index + match[0].lastIndexOf("(");
    let depth = 1;
    let end = open + 1;
    while (end < masked.length && depth) {
      if (masked[end] === "(") depth++;
      if (masked[end] === ")") depth--;
      end++;
    }
    if (!depth) calls.push(source.slice(open + 1, end - 1));
  }
  return calls;
}

function referencesOf(expression: string, names: Set<string>): string[] {
  return [...new Set(maskStrings(expression).match(/\$?[A-Za-z_][\w]*/g) ?? [])].filter(name => names.has(name));
}

function dependentStatements(expression: string, statements: Statement[]): Statement[] {
  const byName = new Map(statements.filter(statement => statement.name !== "root").map(statement => [statement.name, statement]));
  const names = new Set(byName.keys());
  const needed = new Set<string>();
  const visit = (value: string) => {
    for (const name of referencesOf(value, names)) {
      if (needed.has(name)) continue;
      needed.add(name);
      visit(byName.get(name)!.value);
    }
  };
  visit(expression);
  return statements.filter(statement => needed.has(statement.name));
}

/** Extract independently renderable selections from a validated OpenUI program. */
export function extractCanvasItems(program: string): CanvasItemSelection[] {
  const statements = statementsOf(program);
  const ids = new Set<string>();
  return statements.flatMap(statement => canvasCalls(statement.value)).flatMap(call => {
    const args = splitTopLevel(call, ",");
    if (args.length !== 3) return [];
    let id: unknown;
    let title: unknown;
    try { id = JSON.parse(args[0]); title = JSON.parse(args[1]); } catch { return []; }
    if (typeof id !== "string" || !id.trim() || typeof title !== "string" || !title.trim() || ids.has(id)) return [];
    if (!args[2].startsWith("[") || !args[2].endsWith("]")) return [];
    ids.add(id);
    const dependencies = dependentStatements(args[2], statements);
    return [{ id, title, program: [...dependencies.map(({ name, value }) => `${name} = ${value}`), `root = Col(${args[2]})`].join("\n") }];
  });
}
