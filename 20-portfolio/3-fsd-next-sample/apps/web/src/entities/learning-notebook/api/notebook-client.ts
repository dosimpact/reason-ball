import { z } from "zod";
import { notebookEntrySchema, notebookSchema, saveNotebookRequestSchema, type SaveNotebookRequest } from "../model/notebook";

export const notebookSaveResponseSchema = z.object({ entry: notebookEntrySchema, outcome: z.enum(["created", "duplicate", "replayed"]) }).strict();
export function remoteNotebookEnabled() {
  return process.env.NEXT_PUBLIC_APP_RUNTIME_MODE !== "mock" && process.env.NEXT_PUBLIC_DATA_PROVIDER === "supabase";
}

export function createHttpNotebook(fetcher: typeof fetch = fetch) {
  return {
    async read() {
      const response = await fetcher("/api/me/notebook", { cache: "no-store" });
      if (!response.ok) throw new Error("복습 기록을 불러오지 못했어요.");
      return notebookSchema.parse((await response.json()).notebook);
    },
    async save(raw: SaveNotebookRequest) {
      const request = saveNotebookRequestSchema.parse(raw);
      const response = await fetcher("/api/me/notebook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(response.status === 409 ? "저장 요청이 충돌했어요. 입력을 보존했습니다." : "복습 기록을 저장하지 못했어요. 같은 내용으로 다시 시도해 주세요.");
      return notebookSaveResponseSchema.parse(await response.json());
    },
  };
}
