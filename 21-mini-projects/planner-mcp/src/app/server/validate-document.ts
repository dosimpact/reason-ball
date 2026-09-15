import { validateDraft } from "@/app/lib/catalog";
import { PlannerError } from "@/shared/lib/errors";

export async function validateDocument(input: unknown) {
  const draft = validateDraft(input);
  if (draft.type === "db-entity") {
    try {
      const { default: mermaid } = await import("mermaid");
      await mermaid.parse((draft.content as { mermaid: string }).mermaid);
    } catch {
      throw new PlannerError(
        "SCHEMA_INVALID",
        "Mermaid ER 문법을 확인하세요.",
        {
          errors: [
            {
              path: "content.mermaid",
              message: "유효한 erDiagram이 필요합니다.",
            },
          ],
        },
      );
    }
  }
  return draft;
}
