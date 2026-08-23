import type { NodeResult } from "./types";

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export function available<T>(
  value: T,
  warningIds: readonly string[] = [],
): NodeResult<T> {
  return { status: "available", value, warningIds: unique(warningIds) };
}

export function unavailable<T>(
  issueIds: readonly string[],
): NodeResult<T> {
  return { status: "unavailable", issueIds: unique(issueIds) };
}

export function isAvailable<T>(
  result: NodeResult<T>,
): result is Extract<NodeResult<T>, { status: "available" }> {
  return result.status === "available";
}

export function inheritedIssueIds(
  dependencies: readonly NodeResult<unknown>[],
): readonly string[] {
  return unique(
    dependencies.flatMap((dependency) =>
      dependency.status === "unavailable" ? dependency.issueIds : [],
    ),
  );
}

export function inheritedWarningIds(
  dependencies: readonly NodeResult<unknown>[],
): readonly string[] {
  return unique(
    dependencies.flatMap((dependency) =>
      dependency.status === "available" ? dependency.warningIds : [],
    ),
  );
}

