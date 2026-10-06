import { isPlainObject, isString } from "remeda";
import { z } from "zod";

export type WorkspaceChecklistItem = {
  label?: string;
  state?: string;
};

export type WorkspaceSection = {
  heading?: string;
  content?: string;
};

export type WorkspacePayload = {
  title?: string;
  status?: string;
  activeStep?: string;
  progress?: number;
  checklist?: WorkspaceChecklistItem[];
  sections?: WorkspaceSection[];
  summary?: string;
};

export function normalizeWorkspace(result: unknown): WorkspacePayload {
  if (isString(result)) {
    try {
      return normalizeWorkspace(JSON.parse(result));
    } catch {
      return {};
    }
  }

  if (isPlainObject(result)) {
    return result as WorkspacePayload;
  }

  return {};
}

export const buildTaskWorkspaceParameters = z.object({
  request: z.string(),
});
