import { GitPullRequest } from "lucide-react";

import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "proposalDiff"
>;

export function DiffProposal({
  proposalDiff,
}: Props) {
  return (
    <div className="code-diff-panel" role="region" aria-label="Diff Proposal">
      <div className="panel-title">
        <GitPullRequest aria-hidden="true" size={16} />
        Diff Proposal
      </div>
      <pre>{proposalDiff || "No diff proposal yet."}</pre>
    </div>
  );
}
