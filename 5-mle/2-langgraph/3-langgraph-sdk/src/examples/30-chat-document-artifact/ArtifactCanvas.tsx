import { Bot, FileText, Save } from "lucide-react";

import type { useChatDocumentArtifact } from "./useChatDocumentArtifact";

type Props = Pick<
  ReturnType<typeof useChatDocumentArtifact>,
  | "tone"
  | "targetLength"
  | "documentTitle"
  | "documentSummary"
  | "documentSections"
  | "lastEditor"
  | "userEditDirty"
  | "busy"
  | "hasProposal"
  | "canSaveUserEdits"
  | "canAiRevise"
  | "updateDocumentTitle"
  | "updateDocumentSummary"
  | "updateSectionText"
  | "saveUserEdits"
  | "reviseCanvasWithAi"
>;

export function ArtifactCanvas({
  tone,
  targetLength,
  documentTitle,
  documentSummary,
  documentSections,
  lastEditor,
  userEditDirty,
  busy,
  hasProposal,
  canSaveUserEdits,
  canAiRevise,
  updateDocumentTitle,
  updateDocumentSummary,
  updateSectionText,
  saveUserEdits,
  reviseCanvasWithAi,
}: Props) {
  return (
    <div className="document-canvas-panel" role="region" aria-label="Document Canvas">
      <div className="panel-title">
        <FileText aria-hidden="true" size={16} />
        Document Canvas
      </div>
      <div className="document-canvas-header">
        <label className="document-title-field">
          <span>Title</span>
          <input
            aria-label="Document title"
            value={documentTitle}
            onChange={(event) => updateDocumentTitle(event.target.value)}
            disabled={!hasProposal || busy}
          />
        </label>
        <span>{tone} / {targetLength}</span>
      </div>
      <label className="field document-summary-field">
        <span>Summary</span>
        <textarea
          aria-label="Document summary"
          value={documentSummary || "Run the document agent to generate a structured artifact."}
          onChange={(event) => updateDocumentSummary(event.target.value)}
          rows={3}
          disabled={!hasProposal || busy}
        />
      </label>
      <div className="document-canvas-actions">
        <button type="button" className="secondary-button" onClick={saveUserEdits} disabled={!canSaveUserEdits}>
          <Save size={16} />
          Save user edits
        </button>
        <button type="button" className="primary-button" onClick={reviseCanvasWithAi} disabled={!canAiRevise}>
          <Bot size={16} />
          Ask AI to revise canvas
        </button>
        <span className={userEditDirty ? "document-edit-state dirty" : "document-edit-state"}>
          {userEditDirty ? "Unsaved user edit" : `Last editor: ${lastEditor}`}
        </span>
      </div>
      <div className="document-section-list">
        {documentSections.map((section) => (
          <article key={section.id} className={`document-section-card ${section.status}`}>
            <div>
              <strong>{section.title}</strong>
              <span>{section.status}</span>
            </div>
            <textarea
              aria-label={`Edit ${section.title} section`}
              value={section.after}
              onChange={(event) => updateSectionText(section.id, event.target.value)}
              rows={5}
              disabled={busy}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
