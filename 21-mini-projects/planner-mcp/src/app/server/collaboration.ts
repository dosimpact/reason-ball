import type { PlannerStore } from "./store";
import type { CollaborationProject } from "@/entities/document/model/collaboration";

export async function collaborationOverview(
  store: PlannerStore,
): Promise<CollaborationProject[]> {
  const projects = await store.listProjects();
  return Promise.all(
    projects.map(async (project) => {
      const index = await store.index(project.id);
      const problems = index.problems.map((p) => p.message);
      const documents: CollaborationProject["documents"] = [];
      // Sequential reads limit filesystem pressure on a local workspace.
      for (const entry of index.documents) {
        try {
          const doc = await store.getDocument(project.id, entry.id);
          const links = await store.relations(project.id, entry.id);
          const {
            id,
            title,
            status,
            revision,
            updatedAt,
            openQuestions,
            comments,
          } = doc;
          documents.push({
            id,
            title,
            status,
            revision,
            updatedAt,
            openQuestions,
            comments,
            needsReview: links.outgoing.some(
              (ref) => ref.needsReview || !!ref.error,
            ),
          });
        } catch {
          problems.push(`${entry.title}: 협업 정보를 읽지 못했습니다.`);
        }
      }
      documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return { id: project.id, documents, problems };
    }),
  );
}
