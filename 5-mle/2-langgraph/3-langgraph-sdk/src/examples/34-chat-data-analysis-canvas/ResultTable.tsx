import { Table2 } from "lucide-react";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "resultTable"
  | "resultColumns"
>;

export function ResultTable({
  resultTable,
  resultColumns,
}: Props) {
  return (
    <div className="result-table-panel" role="region" aria-label="Result Table">
      <div className="panel-title">
        <Table2 aria-hidden="true" size={18} />
        Result Table
      </div>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              {resultColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultTable.length === 0 ? (
              <tr>
                <td>No result table yet.</td>
              </tr>
            ) : (
              resultTable.map((row, index) => (
                <tr key={index}>
                  {resultColumns.map((column) => (
                    <td key={column}>{String(row[column] ?? "")}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
