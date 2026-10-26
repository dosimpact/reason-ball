import type { ValidationError } from "@openuidev/lang-core";
/** Mutable defaults must be values, not unevaluated expression ASTs. */
export function stateDefaultErrors(
  declarations: Record<string, unknown>,
): string[] {
  const expressionKinds = new Set([
    "Comp",
    "StateRef",
    "Ref",
    "RuntimeRef",
    "BinOp",
    "UnaryOp",
    "Ternary",
    "Member",
    "Index",
    "Assign",
  ]);
  return Object.entries(declarations).flatMap(([name, value]) => {
    if (
      value &&
      typeof value === "object" &&
      "k" in value &&
      expressionKinds.has(String(value.k))
    ) {
      return [
        `${name}: mutable state defaults must be literal values. Use a named expression without $ or calculate directly inside a component; do not store @functions or dependent expressions as $defaults.`,
      ];
    }
    return [];
  });
}

/** Check component-valued props against the catalog; parsing alone permits misplaced data nodes. */
export function componentPlacementErrors(
  root: unknown,
  schema: unknown,
): string[] {
  type Schema = {
    $ref?: string;
    anyOf?: Schema[];
    oneOf?: Schema[];
    items?: Schema;
    properties?: Record<string, Schema>;
    $defs?: Record<string, Schema>;
  };
  const definitions = (schema as Schema).$defs ?? {};
  const errors: string[] = [];
  const references = (rule?: Schema): string[] =>
    rule?.$ref
      ? [rule.$ref.split("/").at(-1)!]
      : (rule?.anyOf ?? rule?.oneOf ?? []).flatMap(references);
  const visit = (value: unknown, rule?: Schema, path = "root") => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, rule?.items, `${path}[${i}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as {
      type?: string;
      typeName?: string;
      props?: Record<string, unknown>;
    };
    if (node.type === "element" && node.typeName && node.props) {
      const allowed = references(rule);
      if (allowed.length && !allowed.includes(node.typeName))
        errors.push(
          `${path}: ${node.typeName} is not allowed here. Use its catalog parent component (for example SectionItem inside SectionBlock).`,
        );
      const definition = definitions[node.typeName];
      Object.entries(node.props).forEach(([key, child]) =>
        visit(child, definition?.properties?.[key], `${node.typeName}.${key}`),
      );
    } else {
      Object.entries(value).forEach(([key, child]) =>
        visit(child, rule?.properties?.[key], `${path}.${key}`),
      );
    }
  };
  visit(root);
  return errors;
}

export function blockingProgramErrors(
  errors: ValidationError[],
): ValidationError[] {
  return errors.filter(
    (error) =>
      error.severity !== "warning" ||
      error.code === "excess-args" ||
      error.code === "type-mismatch",
  );
}

export function artifactIdsFromRoot(root: unknown): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as {
      typeName?: string;
      props?: Record<string, unknown>;
    };
    if (
      node.typeName === "DashboardArtifact" &&
      typeof node.props?.artifactId === "string"
    )
      ids.add(node.props.artifactId);
    if (node.props) Object.values(node.props).forEach(visit);
  };
  visit(root);
  return [...ids];
}

/** Extract citations only from rendered component props, never unused declarations. */
export function sourcesFromRoot(root: unknown) {
  const sources = new Map<string, { title: string; sourceName: string; url?: string }>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const node = value as { type?: string; props?: Record<string, unknown> };
    if (node.type === "element" && Array.isArray(node.props?.sources)) {
      for (const item of node.props.sources) {
        if (!item || typeof item !== "object") continue;
        const source = item as Record<string, unknown>;
        if (typeof source.title !== "string" || typeof source.sourceName !== "string") continue;
        const citation = { title: source.title, sourceName: source.sourceName,
          ...(typeof source.url === "string" ? { url: source.url } : {}) };
        sources.set(JSON.stringify(citation), citation);
      }
    }
    Object.values(value).forEach(visit);
  };
  visit(root);
  return [...sources.values()];
}
