import { Table2 } from "lucide-react";

import type { useChatDataAnalysisCanvas } from "./useChatDataAnalysisCanvas";

type Props = Pick<
  ReturnType<typeof useChatDataAnalysisCanvas>,
  | "datasetName"
  | "rowCount"
  | "columns"
  | "previewRows"
  | "previewColumns"
>;

export function DatasetPreview({
  datasetName,
  rowCount,
  columns,
  previewRows,
  previewColumns,
}: Props) {
  return (
    <div className="dataset-preview-panel" role="region" aria-label="Dataset Preview">
      <div className="panel-title">
        <Table2 aria-hidden="true" size={18} />
        Dataset Preview
      </div>
      <div className="dataset-meta-row">
        <strong>{datasetName}</strong>
        <span>{rowCount} rows</span>
        <span>{columns.length} columns</span>
      </div>
      <div className="data-table-scroll">
        <table>
          <thead>
            <tr>
              {previewColumns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.length === 0 ? (
              <tr>
                <td>No parsed rows yet.</td>
              </tr>
            ) : (
              previewRows.map((row, index) => (
                <tr key={index}>
                  {previewColumns.map((column) => (
                    <td key={column}>{String(row[column] ?? "")}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="column-chip-list">
        {columns.map((column) => (
          <code key={column.name}>{column.name}:{column.type}</code>
        ))}
      </div>
    </div>
  );
}
