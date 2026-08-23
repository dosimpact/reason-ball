import type { NodeResult, ValidationIssue } from "@/utils/index-dcf/types";

export function getNodeValue<T>(node: NodeResult<T>): T | null {
  return node.status === "available" ? node.value : null;
}

export function getNodeIssueMessages(
  node: NodeResult<unknown>,
  issues: readonly ValidationIssue[],
) {
  if (node.status === "available") {
    return issues
      .filter((issue) => node.warningIds?.includes(issue.id))
      .map((issue) => issue.message);
  }

  return node.issueIds
    .map((issueId) => issues.find((issue) => issue.id === issueId)?.message)
    .filter((message): message is string => Boolean(message));
}

export function getNodeWarningMessages(
  node: NodeResult<unknown>,
  issues: readonly ValidationIssue[],
) {
  return getNodeIssueMessages(node, issues).filter((message) =>
    issues.some((issue) => issue.severity === "warning" && issue.message === message),
  );
}

export function formatDelta(
  value: number,
  baseline: number | null,
  formatter: (value: number) => string,
) {
  if (baseline === null) {
    return undefined;
  }

  const delta = value - baseline;
  const sign = delta > 0 ? "+" : "";

  return `${sign}${formatter(delta)} vs Demo`;
}
