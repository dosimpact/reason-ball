import { TestTube2 } from "lucide-react";

import type { useChatCodeEditor } from "./useChatCodeEditor";

type Props = Pick<
  ReturnType<typeof useChatCodeEditor>,
  | "testLog"
  | "testRecords"
>;

export function TestLog({
  testLog,
  testRecords,
}: Props) {
  return (
    <div className="code-test-panel" role="region" aria-label="Test Log">
      <div className="panel-title">
        <TestTube2 aria-hidden="true" size={16} />
        Test Log
      </div>
      <p className="final-line">{testLog || "No test log yet."}</p>
      <div className="code-test-list">
        {testRecords.map((record) => (
          <article key={`${record.phase}-${record.tool}`} className={`code-test-row ${record.status}`}>
            <strong>{record.phase}</strong>
            <span>{record.status}</span>
            <p>{record.detail}</p>
            <code>{record.tool}</code>
          </article>
        ))}
      </div>
    </div>
  );
}
