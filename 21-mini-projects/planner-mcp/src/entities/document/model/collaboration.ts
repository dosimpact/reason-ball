import type { PlannerDocument } from "./schema";
export type CollaborationDocument = Pick<
  PlannerDocument,
  | "id"
  | "title"
  | "status"
  | "revision"
  | "updatedAt"
  | "openQuestions"
  | "comments"
> & { needsReview: boolean };
export type CollaborationProject = {
  id: string;
  documents: CollaborationDocument[];
  problems: string[];
};
