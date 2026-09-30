import { notebookSchema, saveNotebookEntry, type SaveNotebookRequest } from "../model/notebook";

export const localNotebookKey = "lingua-learning-notebook-v1";

export function createLocalNotebookRepository(storage: Pick<Storage, "getItem" | "setItem">) {
  function read() {
    const value = storage.getItem(localNotebookKey);
    return notebookSchema.parse(value === null ? { version: 1, entries: [] } : JSON.parse(value));
  }
  return {
    read,
    save(request: SaveNotebookRequest, createdAt: string) {
      const result = saveNotebookEntry(read(), request, createdAt);
      if (result.outcome !== "replayed") storage.setItem(localNotebookKey, JSON.stringify(result.notebook));
      return result;
    },
  };
}

export async function withLocalNotebook<T>(operation: (repository: ReturnType<typeof createLocalNotebookRepository>) => T) {
  if (!navigator.locks) throw new Error("이 브라우저에서는 안전한 복습 기록 저장을 지원하지 않아요.");
  return navigator.locks.request(localNotebookKey, () => operation(createLocalNotebookRepository(window.localStorage)));
}
