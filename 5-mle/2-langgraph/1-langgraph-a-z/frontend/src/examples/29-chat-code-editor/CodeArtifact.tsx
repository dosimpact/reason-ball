import { Code2 } from "lucide-react";

import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "fileName"
  | "fileBefore"
  | "fileAfter"
  | "diffReason"
>;

export function CodeArtifact({
  fileName,
  fileBefore,
  fileAfter,
  diffReason,
}: Props) {
  return (
    <div className="code-artifact-panel" role="region" aria-label="Code Artifact">
      <div className="panel-title">
        <Code2 aria-hidden="true" size={16} />
        Code Artifact
      </div>
      <div className="code-editor-tabs">
        <span>{fileName}</span>
        <code>{diffReason || "no pending edit"}</code>
      </div>
      <pre>{fileAfter || fileBefore || "Run the code agent to load a sample artifact."}</pre>
    </div>
  );
}
